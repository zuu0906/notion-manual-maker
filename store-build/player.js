// 自動実行プレイヤー — 記録済みステップを再生してブラウザ操作を代行する
// 確認ダイアログはページ内に注入する（ポップアップが閉じても再生を継続できる）

// 不可逆操作の可能性があるワード — モードに関わらず実行前に必ず確認を挟む
const DANGER_RE = /削除|消去|破棄|送信|購入|支払|決済|解約|退会|delete|remove|destroy|submit|purchase|pay\b|checkout|unsubscribe|logout|sign\s?out|サインアウト|ログアウト/i;

const STEP_SETTLE_MS = 800;      // クリック後のページ反映待ち
const SUPERVISED_INTERVAL_MS = 2000;
const NAV_TIMEOUT_MS = 10000;

let playback = null; // { steps, mode, index, tabId, stopped, notify }

export function isPlaying() {
  return !!playback && !playback.stopped && !playback.finished;
}

export function getPlaybackState() {
  if (!playback || playback.finished) return { playing: false };
  return {
    playing: !playback.stopped,
    current: playback.index + 1,
    total: playback.steps.length,
    mode: playback.mode,
  };
}

export function stopPlayback() {
  if (playback) playback.stopped = true;
}

export async function startPlayback(steps, mode, notify) {
  if (isPlaying()) return { error: 'already_playing' };
  const valid = (steps ?? []).filter(s => s.pageUrl && typeof s.x === 'number');
  if (valid.length === 0) return { error: 'no_steps' };
  playback = {
    steps: valid,
    mode: mode === 'supervised' ? 'supervised' : 'step_by_step',
    index: 0,
    tabId: null,
    stopped: false,
    finished: false,
    notify: notify ?? (() => {}),
  };
  runPlayback().catch(e => {
    console.error('[player]', e);
    if (playback) {
      playback.notify({ type: 'PLAY_ERROR', message: String(e?.message ?? e) });
      playback.finished = true;
    }
  });
  return { ok: true, total: valid.length };
}

async function runPlayback() {
  const p = playback;
  const first = p.steps[0];

  const tab = await chrome.tabs.create({ url: first.pageUrl, active: true });
  p.tabId = tab.id;
  await waitForTabLoad(p.tabId);

  for (let i = 0; i < p.steps.length; i++) {
    if (p.stopped) break;
    p.index = i;
    const step = p.steps[i];
    p.notify({ type: 'PLAY_PROGRESS', current: i + 1, total: p.steps.length });

    // URLが違えば遷移（前ステップのクリックで遷移済みのことが多い）
    const navigated = await ensureUrl(p.tabId, step.pageUrl);
    if (p.stopped) break;
    if (navigated) await waitForTabLoad(p.tabId);

    const isDanger = DANGER_RE.test(step.elementHint || '') || DANGER_RE.test(step.label || '');
    const needsConfirm = p.mode === 'step_by_step' || isDanger;

    if (needsConfirm) {
      const action = await showConfirm(p.tabId, {
        title: t('playerConfirmStep', [String(i + 1), String(p.steps.length)]),
        body: step.label || step.elementHint || step.memo || '',
        warning: isDanger ? t('playerDangerWarning') : '',
        buttons: [
          { value: 'run', label: t('playerBtnRun'), primary: true },
          { value: 'skip', label: t('playerBtnSkip') },
          { value: 'stop', label: t('playerBtnStop') },
        ],
      });
      if (action === 'stop' || p.stopped) { p.stopped = true; break; }
      if (action === 'skip') continue;
    }

    const result = await execStepInTab(p.tabId, step);

    if (!result?.ok) {
      const action = await showConfirm(p.tabId, {
        title: t('playerElementNotFound'),
        body: step.label || step.elementHint || `Step ${i + 1}`,
        warning: '',
        buttons: [
          { value: 'skip', label: t('playerBtnSkip'), primary: true },
          { value: 'stop', label: t('playerBtnStop') },
        ],
      });
      if (action === 'stop' || p.stopped) { p.stopped = true; break; }
      continue;
    }

    // パスワード欄: フォーカスだけして手動入力を待つ
    if (step.isPassword) {
      const action = await showConfirm(p.tabId, {
        title: t('playerPasswordPrompt'),
        body: '',
        warning: '',
        buttons: [
          { value: 'run', label: t('playerBtnNext'), primary: true },
          { value: 'stop', label: t('playerBtnStop') },
        ],
      });
      if (action === 'stop' || p.stopped) { p.stopped = true; break; }
    }

    await sleep(p.mode === 'supervised' ? SUPERVISED_INTERVAL_MS : STEP_SETTLE_MS);
  }

  const wasStopped = p.stopped;
  p.finished = true;
  p.notify({ type: 'PLAY_DONE', stopped: wasStopped, total: p.steps.length });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function t(key, subs) {
  return chrome.i18n.getMessage(key, subs) || key;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function sameUrl(a, b) {
  try {
    const ua = new URL(a); const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname === ub.pathname && ua.search === ub.search;
  } catch { return a === b; }
}

async function ensureUrl(tabId, url) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (sameUrl(tab.url ?? '', url)) return false;
    await chrome.tabs.update(tabId, { url });
    return true;
  } catch { return false; }
}

function waitForTabLoad(tabId, timeoutMs = NAV_TIMEOUT_MS) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      // SPA描画の猶予
      setTimeout(resolve, 500);
    };
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then(tab => { if (tab.status === 'complete') finish(); }).catch(finish);
    setTimeout(finish, timeoutMs);
  });
}

// ページ内に確認ダイアログを注入し、押されたボタンの value を返す
async function showConfirm(tabId, opts) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (o) => new Promise(resolve => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#1a1a1a;color:#fff;padding:14px 18px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.45);font-family:-apple-system,"Segoe UI",sans-serif;font-size:13px;max-width:420px;min-width:280px;';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700;margin-bottom:4px;font-size:13px;';
        title.textContent = o.title;
        box.appendChild(title);
        if (o.body) {
          const body = document.createElement('div');
          body.style.cssText = 'opacity:.75;margin-bottom:4px;font-size:12px;max-height:48px;overflow:hidden;';
          body.textContent = o.body;
          box.appendChild(body);
        }
        if (o.warning) {
          const warn = document.createElement('div');
          warn.style.cssText = 'color:#ffb4a8;font-weight:600;margin:4px 0;font-size:12px;';
          warn.textContent = o.warning;
          box.appendChild(warn);
        }
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;justify-content:flex-end;';
        const cleanup = (v) => { host.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cleanup('stop'); } };
        for (const b of o.buttons) {
          const btn = document.createElement('button');
          btn.textContent = b.label;
          btn.style.cssText = `border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;${b.primary ? 'background:#eb5757;color:#fff;' : 'background:rgba(255,255,255,.14);color:#fff;'}`;
          btn.addEventListener('click', () => cleanup(b.value));
          btnRow.appendChild(btn);
        }
        box.appendChild(btnRow);
        host.appendChild(box);
        document.documentElement.appendChild(host);
        document.addEventListener('keydown', onKey, true);
      }),
      args: [opts],
    });
    return result ?? 'stop';
  } catch (e) {
    console.warn('[player:confirm]', e?.message ?? e);
    return 'stop';
  }
}

// ステップをページ内で実行（要素特定 → ハイライト → クリック/入力）
async function execStepInTab(tabId, step) {
  const payload = {
    x: step.x, y: step.y,
    viewportWidth: step.viewportWidth, viewportHeight: step.viewportHeight,
    elementHint: step.elementHint || '',
    inputText: step.isPassword ? null : (step.inputText ?? null),
  };
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (s) => {
        const norm = (v) => (v ?? '').trim().replace(/\s+/g, ' ');

        function findElement() {
          const target = norm(s.elementHint);
          if (target) {
            let el = [...document.querySelectorAll('[aria-label]')]
              .find(e => norm(e.getAttribute('aria-label')) === target);
            if (el) return { el, method: 'aria-label' };
            el = [...document.querySelectorAll('[placeholder]')]
              .find(e => norm(e.getAttribute('placeholder')) === target);
            if (el) return { el, method: 'placeholder' };
            const clickables = [...document.querySelectorAll(
              'button, a, [role="button"], [role="menuitem"], [role="tab"], label, summary, input[type="submit"], input[type="button"], select, input, textarea'
            )];
            el = clickables.find(e => norm(e.innerText || e.value) === target);
            if (el) return { el, method: 'text' };
            el = clickables.find(e => {
              const txt = norm(e.innerText || e.value);
              return txt && txt.length < 100 && (txt.includes(target) || target.includes(txt));
            });
            if (el) return { el, method: 'text-partial' };
          }
          // 座標フォールバック（記録時とビューポート比率でスケール補正）
          const sx = window.innerWidth / (s.viewportWidth || window.innerWidth);
          const sy = window.innerHeight / (s.viewportHeight || window.innerHeight);
          const el = document.elementFromPoint(Math.round(s.x * sx), Math.round(s.y * sy));
          if (el && el !== document.body && el !== document.documentElement) return { el, method: 'point' };
          return null;
        }

        const found = findElement();
        if (!found) return { ok: false, reason: 'not_found' };
        const { el, method } = found;

        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const prevOutline = el.style.outline;
        const prevOffset = el.style.outlineOffset;
        el.style.outline = '3px solid #FF3B30';
        el.style.outlineOffset = '2px';
        await new Promise(r => setTimeout(r, 600));

        try {
          const tag = el.tagName.toLowerCase();
          if (s.inputText != null && (tag === 'input' || tag === 'textarea' || el.isContentEditable)) {
            el.focus();
            if (tag === 'input' || tag === 'textarea') {
              const proto = tag === 'input' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (setter) setter.call(el, s.inputText);
              else el.value = s.inputText;
            } else {
              el.textContent = s.inputText;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (s.inputText != null && tag === 'select') {
            const opt = [...el.options].find(op => norm(op.text) === norm(s.inputText));
            if (opt) {
              el.value = opt.value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              el.click();
            }
          } else {
            el.click();
          }
        } finally {
          setTimeout(() => {
            el.style.outline = prevOutline;
            el.style.outlineOffset = prevOffset;
          }, 700);
        }
        return { ok: true, method };
      },
      args: [payload],
    });
    return result;
  } catch (e) {
    console.warn('[player:exec]', e?.message ?? e);
    return { ok: false, reason: String(e?.message ?? e) };
  }
}
