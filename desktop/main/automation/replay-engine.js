// replay-engine.js — ハイブリッド実行ステートマシン（W5 本実装・統合点）
//
// ステップごと: ①ウィンドウ前面化 → ②安全/確認 → ③ロケーター階層
//   （UIA→OCR→AIフォールバック）→ ④実行（click/type/key/scroll/wait）。
//
// 【座標規約の境界をここに集約】
//   - matcher / screen-reader / input-driver はすべて「物理px」。
//   - ai-fallback は「スクショに対する 0..1000 正規化」→ ここで物理pxへ変換。
//
// 【安全方針】
//   - 3階層すべてで特定できなければブラインドクリックせず step を失敗にする（誤操作防止）。
//   - 危険操作（safety.isDangerous）は onConfirm 無しでは実行しない。
//   - 失敗・中断は即座にフローを停止（途中からの誤操作連鎖を防ぐ。フロー全体リトライ禁止）。
//
// 依存は注入可能（opts.deps）。Electron/PowerShell 非依存で単体テストするため。

const defaultDeps = {
  inputDriver: require('./input-driver'),
  screenReader: require('./screen-reader'),
  matcher: require('./matcher'),
  ai: require('./ai-fallback'),
  safety: require('./safety'),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

const OCR_ACCEPT = 0.6;       // この信頼度以上の OCR 一致は採用、未満は AI へ委ねる
const ACT_SETTLE_MS = 250;    // 前面化/操作後に画面が落ち着くのを待つ
const STEP_GAP_MS = 120;      // ステップ間の小休止
const VERIFY_SETTLE_MS = 450; // 検証用キャプチャ前にUI更新を待つ

/**
 * @param {object} flow  Flow
 * @param {object} opts  RunOptions（mode/onProgress/onConfirm/onRuntimeInput/shouldAbort/deps）
 * @returns {Promise<{status:'success'|'aborted'|'failed'|'engine_not_ready',results:object[],error?:string}>}
 */
async function run(flow, opts = {}) {
  const deps = { ...defaultDeps, ...(opts.deps || {}) };
  const { inputDriver, screenReader, matcher, ai, safety, sleep } = deps;

  if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    return { status: 'failed', results: [], error: 'empty_flow' };
  }
  if (!inputDriver.isReady || !inputDriver.isReady()) {
    return { status: 'engine_not_ready', results: [], error: 'input_driver_not_ready' };
  }

  const mode = opts.mode || 'supervised';
  const dryRun = !!opts.dryRun;
  const total = flow.steps.length;
  const results = [];
  const report = (stepNumber, phase, extra = {}) =>
    opts.onProgress && opts.onProgress({ stepNumber, total, phase, ...extra });
  const aborted = () => typeof opts.shouldAbort === 'function' && opts.shouldAbort();

  for (let i = 0; i < total; i++) {
    const step = flow.steps[i];
    const stepNumber = step.stepNumber || i + 1;
    const label = step.label || '';
    if (aborted()) return { status: 'aborted', results };

    // ① 進捗通知（前面化は確認/入力ダイアログ後に operation 直前で行う＝
    //    ダイアログがフォーカスを奪っても対象を取り違えないため。executeStep内で実施）
    report(stepNumber, 'locating', { label });
    if (aborted()) return { status: 'aborted', results };

    // ② 安全/確認（ドライランは実行しないので確認不要）
    const dangerous = safety.isDangerous(step);
    if (!dryRun) {
      const wantConfirm = dangerous || mode === 'step_by_step';
      if (wantConfirm) {
        if (typeof opts.onConfirm === 'function') {
          report(stepNumber, 'confirm', { label });
          const ok = await opts.onConfirm({ message: confirmMessage(step, dangerous), danger: dangerous, step });
          if (!ok) return { status: 'aborted', results };
        } else if (dangerous) {
          // 危険操作は確認手段が無ければ実行しない
          results.push({ stepNumber, action: step.action, status: 'failed', reason: 'confirmation_required' });
          return { status: 'failed', results, error: 'confirmation_required' };
        }
        // step_by_step かつ onConfirm 無し → そのまま続行
      }
    }
    if (aborted()) return { status: 'aborted', results };

    // ③ ロケーター + ④ 実行（dryRun時は特定のみ・実行しない）
    let res;
    try {
      res = await executeStep(step, { deps, report, opts, mode, dryRun });
    } catch (e) {
      res = { stepNumber, action: step.action, status: 'failed', reason: e.message };
    }
    if (dangerous) res.dangerous = true;
    res.stepIndex = i; // 呼び出し側が flow-store へ書き戻す際に使う（W12 自己修復）
    // ⑤ W11: AI結果検証（successCriteria があり成功した step のみ）
    if (!dryRun && res.status === 'ok' && step.successCriteria) {
      res = await verifyStep(step, res, { deps, report });
    }
    results.push(res);
    // ドライランは失敗でも止めず全ステップを評価。本実行は失敗で即停止。
    if (!dryRun && res.status !== 'ok') {
      return { status: 'failed', results, error: res.reason };
    }
    await sleep(dryRun ? 0 : STEP_GAP_MS);
  }

  const allOk = results.every((r) => r.status === 'ok');
  return { status: allOk ? 'success' : 'failed', results, dryRun };
}

// ── 1ステップの特定＋実行（dryRun=true なら特定のみで実行しない）────────────
async function executeStep(step, { deps, report, opts, dryRun }) {
  const { inputDriver, screenReader, matcher, ai, sleep } = deps;
  const action = (step.action || 'click').toLowerCase();
  const stepNumber = step.stepNumber || 0;
  const label = step.label || '';

  // 操作直前に対象ウィンドウを前面化。確認/入力ダイアログがフォーカスを奪った直後は
  // SetForegroundWindow が1発で通らないことがあるためリトライ＋前面確認する。
  // dryRun は settle/確認を省く（実行しないため）。
  const activate = () => ensureForeground(step, deps, dryRun);

  // 座標を要さないアクションは先に処理
  if (action === 'wait') {
    report(stepNumber, 'acting', { label });
    if (!dryRun) await sleep(Math.max(0, Number(step.waitMs) || 500));
    return ok(step, { method: 'none' });
  }
  if (action === 'key') {
    report(stepNumber, 'acting', { label });
    const vk = String(step.vk || step.key || '').trim();
    if (!vk) return fail(step, 'missing_key');
    if (!dryRun) {
      const fg = await activate();
      if (!fg && hasWindowTarget(step)) return fail(step, 'activate_failed');
      await inputDriver.key(vk);
    }
    return ok(step, { method: 'none' });
  }
  if (action === 'type') {
    report(stepNumber, 'acting', { label });
    // ドライランは実際の値解決(プロンプト)をせず、実行時入力が要るかだけ判定
    if (dryRun) {
      const willPrompt = (step.isSecret && step.inputText == null) || step.promptAtRuntime;
      return ok(step, { method: 'none', reason: willPrompt ? 'prompt_at_runtime' : 'ready' });
    }
    const text = await resolveTypeText(step, opts); // 実行時入力プロンプト（フォーカスを奪う場合あり）
    if (text == null) return fail(step, 'secret_input_required');
    const fg = await activate();                     // プロンプトで奪ったフォーカスを対象へ戻す（リトライ付き）
    // ウィンドウ指定があり前面化を確認できない場合は入力しない（誤ウィンドウへの秘匿漏れ防止）
    if (!fg && hasWindowTarget(step)) return fail(step, 'activate_failed');
    await inputDriver.type(text);
    return ok(step, { method: 'none' });
  }

  // click / scroll は対象座標が必要 → ロケーター階層で物理pxを得る
  const fgForClick = await activate(); // 確認ダイアログ後でも正しい前面で特定する
  if (!fgForClick && hasWindowTarget(step)) return fail(step, 'activate_failed');
  const located = await locate(step, { deps, report });
  if (!located) return fail(step, 'target_not_found');

  report(stepNumber, 'acting', { label, method: located.method });
  if (!dryRun) {
    if (action === 'scroll') {
      await inputDriver.move(located.x, located.y);
      await inputDriver.scroll(resolveScrollDelta(step, located));
    } else {
      // click（既定）
      await inputDriver.click(located.x, located.y, step.button === 'right' ? 'right' : 'left');
    }
  }
  const result = ok(step, { method: located.method, confidence: located.confidence, x: located.x, y: located.y, reason: located.reason });

  // ⑥ W12: 自己修復 — UIA以外(OCR/AI)で特定できた＝記録時UIAがズレた。クリック位置の
  // UIA要素を取得し直し、識別子があれば healUia として返す（永続化は呼び出し側=index.js）。
  if (!dryRun && located.method !== 'uia' && typeof inputDriver.uiaInspect === 'function') {
    try {
      const fresh = await inputDriver.uiaInspect(located.x, located.y);
      if (fresh && (fresh.automationId || fresh.name || fresh.controlType)) {
        result.healUia = {
          automationId: fresh.automationId || undefined,
          name: fresh.name || undefined,
          controlType: fresh.controlType || undefined,
          className: fresh.className || undefined,
        };
      }
    } catch { /* 取得失敗は修復スキップ */ }
  }
  return result;
}

// ── W11: AI結果検証 ─────────────────────────────────────────────────────────
// step.successCriteria を満たしたか、操作後の画面を Gemini で確認する。
//   fail      → 誤動作の連鎖を防ぐため step を失敗に倒す（フロー停止）
//   uncertain → 続行（働いているフローを誤って止めない）。result.verify に記録
//   success   → 続行
// 検証はあくまで補助。capture/AI呼び出しに失敗したら検証をスキップして元の結果を返す。
async function verifyStep(step, result, { deps, report }) {
  const { ai, screenReader, sleep } = deps;
  if (!ai || !ai.isConfigured || !ai.isConfigured()) return result;
  report(step.stepNumber || 0, 'verifying', { label: step.label || '' });
  await sleep(VERIFY_SETTLE_MS); // 画面が更新されるのを待つ

  let cap;
  try { cap = await screenReader.capture(); } catch { return result; }
  if (!cap) return result;

  let v;
  try {
    v = await ai.verifyResult({ screenshotDataUrl: cap.dataUrl, successCriteria: step.successCriteria, step });
  } catch { return result; }
  if (!v) return result;

  result.verify = v.status;
  if (v.status === 'fail') {
    return { ...result, status: 'failed', reason: 'verification_failed', verifyReason: v.reason || '' };
  }
  return result; // success / uncertain は続行
}

// ── ロケーター3階層（UIA → OCR → AI）。返り値は物理px or null ──────────────
async function locate(step, { deps, report }) {
  const { inputDriver, screenReader, matcher, ai } = deps;
  const stepNumber = step.stepNumber || 0;

  // ① UIA
  const uiaLoc = await matcher.matchByUia(step, inputDriver.uiaFind);
  if (uiaLoc) return uiaLoc;

  // 現在画面を1回キャプチャ（OCR / AI で共用）
  let cap;
  try { cap = await screenReader.capture(); } catch { cap = null; }
  if (!cap) return null;

  // ② OCR
  let ocrLoc = null;
  try {
    const { words } = await screenReader.ocr(cap.dataUrl);
    ocrLoc = matcher.matchByOcr(step, words, { w: cap.width, h: cap.height });
  } catch { /* OCR失敗は無視してAIへ */ }
  if (ocrLoc && ocrLoc.confidence >= OCR_ACCEPT) return ocrLoc;

  // ③ AI フォールバック
  if (ai.isConfigured && ai.isConfigured()) {
    report(stepNumber, 'ai-fallback', { label: step.label || '' });
    try {
      const aiLoc = await aiLocate(step, cap, ai);
      if (aiLoc) return aiLoc;
    } catch { /* AI失敗は下の弱OCRへ */ }
  }

  // 最後の頼み: 信頼度の低い OCR 一致があればそれを使う（無ければ失敗）
  return ocrLoc || null;
}

// AI の 0..1000 正規化座標を物理pxへ変換して LocateResult に整える。
async function aiLocate(step, cap, ai) {
  const recordedCropDataUrl = undefined; // W3のクロップ供給は後続（任意）
  const a = await ai.decideNextAction({
    screenshotDataUrl: cap.dataUrl,
    recordedCropDataUrl,
    step,
  });
  if (!a || a.action === 'fail') return null;
  if (a.x == null || a.y == null) return null;
  return {
    x: Math.round((a.x / 1000) * cap.width),
    y: Math.round((a.y / 1000) * cap.height),
    confidence: typeof a.confidence === 'number' ? a.confidence : 0.5,
    method: 'ai',
    reason: a.reason || 'ai',
  };
}

// ── ヘルパー ────────────────────────────────────────────────────────────────
function hasWindowTarget(step) {
  return !!(step && (step.processName || step.windowTitle));
}

function activateQuery(step) {
  if (step.processName) return { processName: step.processName };
  if (step.windowTitle) return { titleSubstr: step.windowTitle };
  return null;
}

async function activateWindow(step, inputDriver) {
  const q = activateQuery(step);
  if (!q) return false;
  try { return await inputDriver.activate(q); } catch { return false; }
}

/**
 * 対象ウィンドウを前面化し、実際に前面になったか確認する（最大3回リトライ）。
 * モーダル直後など SetForegroundWindow が1発で通らないケースに対応。
 * @returns {Promise<boolean>} 前面化できた（or ウィンドウ指定なし＝現フォーカスに委ねる）
 */
async function ensureForeground(step, deps, dryRun) {
  const { inputDriver, sleep } = deps;
  const q = activateQuery(step);
  if (!q) return true; // ウィンドウ指定なし＝現在のフォーカスに任せる
  const needle = String(step.processName || step.windowTitle || '').toLowerCase();

  for (let attempt = 0; attempt < 3; attempt++) {
    try { await inputDriver.activate(q); } catch {}
    if (!dryRun) await sleep(ACT_SETTLE_MS);
    // 確認手段（foreground）が無ければ activate を信じて続行
    if (typeof inputDriver.foreground !== 'function') return true;
    let fg = null;
    try { fg = await inputDriver.foreground(); } catch {}
    if (!fg) return true;
    const hay = `${fg.title || ''} ${fg.processName || ''}`.toLowerCase();
    if (!needle || hay.includes(needle)) return true;
    // まだ前面でない → 短く待って再試行
    if (!dryRun) await sleep(150);
  }
  try { console.warn('[automation] ensureForeground failed for', needle); } catch {}
  return false;
}

async function resolveTypeText(step, opts) {
  if (step.isSecret && (step.inputText == null)) {
    if (typeof opts.onRuntimeInput === 'function') {
      const v = await opts.onRuntimeInput(step);
      return v == null ? null : String(v);
    }
    return null; // 秘匿値が無く、実行時入力手段も無い
  }
  if (step.promptAtRuntime && typeof opts.onRuntimeInput === 'function') {
    const v = await opts.onRuntimeInput(step);
    if (v != null) return String(v);
  }
  return String(step.inputText != null ? step.inputText : '');
}

function resolveScrollDelta(step, located) {
  if (Number.isFinite(Number(step.scrollDelta))) return Number(step.scrollDelta);
  // AIが text に 'up'/'down' を入れた場合に対応
  const dir = (located && located.dir) || step.scrollDir;
  return dir === 'up' ? -300 : 300;
}

function confirmMessage(step, dangerous) {
  const what = step.label || step.action || '操作';
  return dangerous ? `「${what}」は取り消せない操作の可能性があります。実行しますか？` : `「${what}」を実行しますか？`;
}

function ok(step, extra) {
  return { stepNumber: step.stepNumber || 0, action: step.action || 'click', status: 'ok', ...extra };
}
function fail(step, reason) {
  return { stepNumber: step.stepNumber || 0, action: step.action || 'click', status: 'failed', reason };
}

module.exports = { run };
