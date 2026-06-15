// automation-editor.js — フロー編集UI（W7）。NL編集(W7b)/ドライラン(W8)は別関数で結線。
'use strict';

const els = {
  name: document.getElementById('flowName'),
  steps: document.getElementById('steps'),
  empty: document.getElementById('empty'),
  status: document.getElementById('status'),
  undo: document.getElementById('undo'),
  nlEdit: document.getElementById('nlEdit'),
  dryRun: document.getElementById('dryRun'),
  addLaunch: document.getElementById('addLaunch'),
};

let flowId = null;
let flow = null;

const ACTION_LABEL = { click: 'クリック', type: '入力', key: 'キー', scroll: 'スクロール', wait: '待機', launch: 'アプリ起動' };

function setStatus(msg, tone) {
  els.status.textContent = msg || '';
  els.status.className = 'status' + (tone ? ' ' + tone : '');
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function load() {
  const res = await window.automation.getFlow(flowId);
  if (!res.ok || !res.flow) { setStatus('フローを読み込めませんでした。', 'warn'); return; }
  flow = res.flow;
  els.name.value = flow.name || '';
  render();
}

function render() {
  const steps = flow.steps || [];
  els.empty.style.display = steps.length ? 'none' : '';
  els.steps.innerHTML = '';
  steps.forEach((s, i) => els.steps.appendChild(renderStep(s, i, steps.length)));
  els.undo.disabled = false;
}

function renderStep(step, i, total) {
  const action = (step.action || 'click').toLowerCase();
  const wrap = document.createElement('div');
  wrap.className = 'step';
  const isType = action === 'type';
  const isLaunch = action === 'launch';
  wrap.innerHTML = `
    <div class="srow">
      <div class="num">${i + 1}</div>
      <div class="thumb empty" data-thumb>${isLaunch ? '🚀' : (step.screenshotFile ? '読み込み中…' : '画像なし')}</div>
      <div class="fields">
        <div><span class="badge">${escapeHtml(ACTION_LABEL[action] || action)}</span>
          ${step.isSecret ? '<span class="badge danger">秘匿</span>' : ''}</div>
        <div>
          <label class="fl">ステップ名</label>
          <input type="text" data-f="label" value="${escapeHtml(step.label || '')}" placeholder="例: 保存ボタンをクリック" />
        </div>
        ${isLaunch ? `
        <div>
          <label class="fl">起動するアプリ（exe名 または フルパス）</label>
          <input type="text" data-f="launchTarget" value="${escapeHtml(step.launchTarget || '')}" placeholder="例: notepad.exe / C:\\Program Files\\...\\app.exe" />
        </div>` : ''}
        ${isType ? `
        <div>
          <label class="fl">入力する文字</label>
          <input type="text" data-f="inputText" value="${escapeHtml(step.isSecret ? '' : (step.inputText || ''))}"
                 placeholder="${step.isSecret ? '（秘匿：実行時に入力）' : ''}" ${step.isSecret ? 'disabled' : ''} />
        </div>
        <label class="secret"><input type="checkbox" data-f="isSecret" ${step.isSecret ? 'checked' : ''} /> 秘匿（パスワード等・保存せず実行時に入力）</label>
        ` : ''}
        <div>
          <label class="fl">メモ</label>
          <textarea data-f="memo" placeholder="補足">${escapeHtml(step.memo || '')}</textarea>
        </div>
        <div>
          <label class="fl">成功条件（任意・実行後にAIが達成を確認）</label>
          <input type="text" data-f="successCriteria" value="${escapeHtml(step.successCriteria || '')}" placeholder="例: 保存完了の表示が出る" />
        </div>
      </div>
      <div class="sactions">
        <button data-act="up" ${i === 0 ? 'disabled' : ''} title="上へ">↑</button>
        <button data-act="down" ${i === total - 1 ? 'disabled' : ''} title="下へ">↓</button>
        <button class="del" data-act="del" title="削除">✕</button>
      </div>
    </div>`;

  // フィールド編集 → blur/changeで保存
  wrap.querySelectorAll('[data-f]').forEach((inp) => {
    const field = inp.getAttribute('data-f');
    const ev = inp.type === 'checkbox' ? 'change' : 'blur';
    inp.addEventListener(ev, () => onFieldChange(i, field, inp));
  });
  // 並べ替え/削除
  wrap.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => onAction(i, btn.getAttribute('data-act')));
  });

  // サムネ遅延ロード
  if (step.screenshotFile) {
    window.automation.getStepImage(flowId, step.screenshotFile).then((r) => {
      const t = wrap.querySelector('[data-thumb]');
      if (r.ok && r.dataUrl && t) {
        t.outerHTML = `<img class="thumb" src="${r.dataUrl}" alt="step ${i + 1}" />`;
      } else if (t) { t.textContent = '画像なし'; }
    });
  }
  return wrap;
}

async function onFieldChange(index, field, inp) {
  const patch = {};
  if (field === 'isSecret') {
    patch.isSecret = inp.checked;
    if (inp.checked) patch.inputText = null;
  } else {
    patch[field] = inp.value;
  }
  // 値が変わっていなければ何もしない
  const cur = flow.steps[index];
  if (cur && cur[field] === patch[field]) return;

  const res = await window.automation.updateStep(flowId, index, patch);
  if (!res.ok) { setStatus('保存に失敗しました: ' + res.error, 'warn'); return; }
  flow = res.flow;
  setStatus('保存しました。', 'ok');
  if (field === 'isSecret') render(); // 入力欄の活性状態を反映
}

async function onAction(index, act) {
  let ops = null;
  if (act === 'up' && index > 0) ops = [{ op: 'reorder', from: index, to: index - 1 }];
  else if (act === 'down') ops = [{ op: 'reorder', from: index, to: index + 1 }];
  else if (act === 'del') {
    if (!confirm('このステップを削除しますか？')) return;
    ops = [{ op: 'delete_step', index }];
  }
  if (!ops) return;
  const res = await window.automation.applyOps(flowId, ops);
  if (!res.ok) { setStatus('操作に失敗しました: ' + res.error, 'warn'); return; }
  flow = res.flow;
  render();
  setStatus(act === 'del' ? '削除しました。' : '並べ替えました。', 'ok');
}

// フロー名
els.name.addEventListener('blur', async () => {
  const name = els.name.value.trim();
  if (!name || name === flow.name) return;
  const res = await window.automation.renameFlow(flowId, name);
  if (!res.ok) { setStatus('名前の変更に失敗しました。', 'warn'); return; }
  flow.name = name;
  setStatus('名前を変更しました。', 'ok');
});

// 元に戻す
els.undo.addEventListener('click', async () => {
  const res = await window.automation.restoreFlow(flowId);
  if (!res.ok) { setStatus('これ以上は戻せません。', 'warn'); return; }
  flow = res.flow;
  els.name.value = flow.name || '';
  render();
  setStatus('1つ前の状態に戻しました。', 'ok');
});

// ── W8: ドライラン（クリックせず各ステップを特定できるか確認）────────────────
async function runDryRun() {
  setStatus('ドライラン中… 対象ウィンドウを確認しています（クリックはしません）。');
  els.dryRun.disabled = true;
  clearDryBadges();
  try {
    const res = await window.automation.dryRunFlow(flowId);
    if (!res.ok) { setStatus('ドライランに失敗しました: ' + res.error, 'warn'); return; }
    const results = (res.result && res.result.results) || [];
    let okN = 0;
    results.forEach((r, i) => { if (showDryBadge(i, r)) okN++; });
    const total = results.length;
    if (okN === total) setStatus(`✓ 全 ${total} ステップを特定できました。実行できる見込みです。`, 'ok');
    else setStatus(`${okN}/${total} ステップを特定。✕の手順は実行時に失敗する可能性があります（名前/メモを直すか、対象アプリを開いて再確認）。`, 'warn');
  } finally {
    els.dryRun.disabled = false;
  }
}
function clearDryBadges() {
  els.steps.querySelectorAll('[data-dry]').forEach((e) => e.remove());
}
function showDryBadge(index, r) {
  const stepEl = els.steps.children[index];
  if (!stepEl) return r.status === 'ok';
  const found = r.status === 'ok';
  const badge = document.createElement('span');
  badge.setAttribute('data-dry', '1');
  badge.className = 'badge';
  badge.style.background = found ? '#1e9e54' : '#d93636';
  const how = r.method && r.method !== 'none' ? `（${r.method}${r.confidence != null ? ' ' + Math.round(r.confidence * 100) + '%' : ''}）`
            : r.reason === 'prompt_at_runtime' ? '（実行時に入力）' : '';
  badge.textContent = (found ? '✓ 特定' : '✕ 不可: ' + (r.reason || 'not_found')) + how;
  const head = stepEl.querySelector('.fields > div'); // 種別バッジ行
  if (head) head.appendChild(badge);
  return found;
}

// ── W7b: 自然言語編集（提案→差分→承認）─────────────────────────────────────
const nl = {
  bg: document.getElementById('nlBg'),
  input: document.getElementById('nlInput'),
  suggest: document.getElementById('nlSuggest'),
  close: document.getElementById('nlClose'),
  changes: document.getElementById('nlChanges'),
  applyRow: document.getElementById('nlApplyRow'),
  apply: document.getElementById('nlApply'),
  cancel: document.getElementById('nlCancel'),
};
let proposedOps = null;

function openNlEditor() {
  proposedOps = null;
  nl.input.value = '';
  nl.changes.style.display = 'none';
  nl.changes.innerHTML = '';
  nl.applyRow.style.display = 'none';
  nl.bg.classList.add('show');
  setTimeout(() => nl.input.focus(), 30);
}
function closeNl() { nl.bg.classList.remove('show'); }

nl.close.addEventListener('click', closeNl);
nl.cancel.addEventListener('click', () => { proposedOps = null; nl.changes.style.display = 'none'; nl.applyRow.style.display = 'none'; });

nl.suggest.addEventListener('click', async () => {
  const instruction = nl.input.value.trim();
  if (!instruction) return;
  nl.suggest.disabled = true;
  setStatus('AIが編集内容を考えています…');
  try {
    const res = await window.automation.nlPropose(flowId, instruction);
    if (!res.ok) {
      const msg = { ai_not_configured: 'AI機能が設定されていません。', empty_instruction: '指示を入力してください。',
                    no_actionable_ops: '実行できる編集を見つけられませんでした。言い換えてみてください。' }[res.error] || ('提案に失敗しました: ' + res.error);
      setStatus(msg, 'warn');
      nl.changes.style.display = 'none'; nl.applyRow.style.display = 'none';
      return;
    }
    proposedOps = res.ops;
    nl.changes.innerHTML = '';
    res.changes.forEach((c) => { const li = document.createElement('li'); li.textContent = c; nl.changes.appendChild(li); });
    nl.changes.style.display = '';
    nl.applyRow.style.display = '';
    setStatus('内容を確認して「この内容で変更」を押してください。');
  } finally {
    nl.suggest.disabled = false;
  }
});

nl.apply.addEventListener('click', async () => {
  if (!proposedOps || !proposedOps.length) return;
  const res = await window.automation.applyOps(flowId, proposedOps);
  if (!res.ok) { setStatus('適用に失敗しました: ' + res.error, 'warn'); return; }
  flow = res.flow;
  render();
  closeNl();
  setStatus('文章編集を適用しました。問題があれば「元に戻す」で戻せます。', 'ok');
});

// 「アプリ起動を追加」: 先頭に launch ステップを挿入（フローを自己完結に）
els.addLaunch.addEventListener('click', async () => {
  const launchStep = { action: 'launch', label: 'アプリを起動', launchTarget: '', waitMs: 1500 };
  const res = await window.automation.applyOps(flowId, [{ op: 'insert_step', index: 0, step: launchStep }]);
  if (!res.ok) { setStatus('追加に失敗しました: ' + res.error, 'warn'); return; }
  flow = res.flow;
  render();
  setStatus('先頭に「アプリ起動」を追加しました。起動するアプリ名を入力してください（例: notepad.exe）。', 'ok');
});

// W7b / W8 のフック
els.nlEdit.addEventListener('click', openNlEditor);
els.dryRun.addEventListener('click', runDryRun);

window.automation.onEditorInit(({ flowId: id }) => { flowId = id; load(); });
// 既に init 済みの場合に備えフォールバック（通常は onEditorInit が先）
setStatus('読み込み中…');
