// automation.js — 自動実行管理ウィンドウ（最小版・W1）
// フロー一覧表示・実行・削除。編集UI/ドライランは Phase 2 で追加。

const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');
const modeEl = document.getElementById('mode');
const refreshBtn = document.getElementById('refresh');

function setStatus(msg, warn) {
  statusEl.textContent = msg || '';
  statusEl.classList.toggle('warn', !!warn);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
}

async function loadFlows() {
  setStatus('読み込み中…');
  const res = await window.automation.listFlows();
  if (!res.ok) { setStatus(`読み込みに失敗しました: ${res.error}`, true); return; }
  render(res.flows || []);
  setStatus('');
}

function render(flows) {
  listEl.innerHTML = '';
  if (!flows.length) {
    listEl.innerHTML = '<div class="empty">まだ自動実行できるフローがありません。<br>'
      + 'マニュアルを記録すると、ここから実行できるようになります。</div>';
    return;
  }
  for (const f of flows) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="meta">
        <div class="name">${escapeHtml(f.name)}</div>
        <div class="info">${f.stepCount} ステップ・${escapeHtml(fmtDate(f.updatedAt))}</div>
      </div>
      <div class="actions">
        <button class="primary" data-run="${escapeHtml(f.id)}">実行</button>
        <button data-edit="${escapeHtml(f.id)}" title="編集">編集</button>
        <button class="del" data-del="${escapeHtml(f.id)}" title="削除">削除</button>
      </div>`;
    listEl.appendChild(card);
  }
}

async function runFlow(id) {
  setStatus('実行を開始しています…');
  const res = await window.automation.runFlow(id, modeEl.value);
  if (!res.ok) { setStatus(`実行できませんでした: ${res.error}`, true); return; }
  setStatus(summarizeReport(res.result), res.result && res.result.status !== 'success');
}

// W14: 実行レポートを1行サマリにする
function summarizeReport(result) {
  if (!result) return '完了しました。';
  const st = result.status;
  if (st === 'engine_not_ready') return '実行エンジンは準備中です。';
  const rep = result.report;
  const sec = rep && rep.durationMs != null ? `・${(rep.durationMs / 1000).toFixed(1)}秒` : '';
  const healed = rep && rep.healed ? `・自己修復${rep.healed}件` : '';
  if (st === 'success') {
    const n = rep ? rep.total : '';
    return `✓ 完了（${n}ステップ${sec}${healed}）`;
  }
  if (st === 'aborted') return `中断しました${sec}`;
  // failed
  const failed = rep && rep.steps ? rep.steps.find((s) => s.status !== 'ok') : null;
  const where = failed ? `ステップ${failed.stepNumber}「${failed.label || failed.action}」で停止` : '失敗';
  const why = (rep && rep.failedReason) || (failed && failed.reason) || '';
  const whyJp = ({
    target_not_found: '対象が見つかりませんでした',
    activate_failed: '対象ウィンドウを前面化できませんでした',
    verification_failed: '成功条件を満たしませんでした',
    confirmation_required: '確認が必要な操作のため停止しました',
    secret_input_required: '秘匿入力が必要です',
  })[why] || why;
  return `${where}${whyJp ? '：' + whyJp : ''}${sec}`;
}

async function deleteFlow(id) {
  const res = await window.automation.deleteFlow(id);
  if (!res.ok) { setStatus(`削除に失敗しました: ${res.error}`, true); return; }
  loadFlows();
}

listEl.addEventListener('click', (e) => {
  const runId = e.target.getAttribute('data-run');
  const delId = e.target.getAttribute('data-del');
  const editId = e.target.getAttribute('data-edit');
  if (runId) runFlow(runId);
  else if (editId) window.automation.openEditor(editId);
  else if (delId) deleteFlow(delId);
});

// 編集ウィンドウでの変更を一覧へ反映
if (window.automation.onFlowsChanged) window.automation.onFlowsChanged(loadFlows);

// ── W9: 実行中の確認/入力プロンプト ──────────────────────────────────────────
const modal = {
  bg: document.getElementById('modalBg'),
  title: document.getElementById('modalTitle'),
  msg: document.getElementById('modalMsg'),
  input: document.getElementById('modalInput'),
  ok: document.getElementById('modalOk'),
  cancel: document.getElementById('modalCancel'),
};
let activePrompt = null; // { reqId, kind }

function showPrompt(p) {
  activePrompt = p;
  const isInput = p.kind === 'input';
  modal.title.textContent = isInput ? '入力してください' : (p.danger ? '確認（注意が必要な操作）' : '確認');
  modal.title.className = (!isInput && p.danger) ? 'danger' : '';
  modal.msg.textContent = p.message || (isInput ? (p.label || '値を入力してください') : 'この操作を実行しますか？');
  if (isInput) {
    modal.input.style.display = '';
    modal.input.type = p.isSecret ? 'password' : 'text';
    modal.input.value = '';
    modal.ok.textContent = '入力';
  } else {
    modal.input.style.display = 'none';
    modal.ok.textContent = p.danger ? '実行する' : 'OK';
  }
  modal.bg.classList.add('show');
  if (isInput) setTimeout(() => modal.input.focus(), 30);
  else setTimeout(() => modal.ok.focus(), 30);
}

function resolvePrompt(value) {
  if (!activePrompt) return;
  const ap = activePrompt;
  activePrompt = null;
  modal.bg.classList.remove('show');
  if (ap.local) { ap.resolve(value); return; } // ローカル入力
  window.automation.replyPrompt(ap.reqId, value); // main からの W9 プロンプト
}

// Electron は window.prompt() 非対応のため、モーダルでローカル入力を取る
function localPrompt(message, def) {
  return new Promise((resolve) => {
    activePrompt = { kind: 'input', local: true, resolve };
    modal.title.textContent = '入力してください';
    modal.title.className = '';
    modal.msg.textContent = message || '';
    modal.input.style.display = '';
    modal.input.type = 'text';
    modal.input.value = def || '';
    modal.ok.textContent = 'OK';
    modal.bg.classList.add('show');
    setTimeout(() => { modal.input.focus(); modal.input.select(); }, 30);
  });
}

modal.ok.addEventListener('click', () => {
  if (!activePrompt) return;
  if (activePrompt.kind === 'input') resolvePrompt(modal.input.value);
  else resolvePrompt(true);
});
modal.cancel.addEventListener('click', () => {
  if (!activePrompt) return;
  resolvePrompt(activePrompt.kind === 'input' ? null : false);
});
modal.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') modal.ok.click(); });

if (window.automation.onPrompt) window.automation.onPrompt(showPrompt);

// ── W15: 操作の自動記録 ───────────────────────────────────────────────────────
const recordBtn = document.getElementById('record');
const recBar = document.getElementById('recBar');
const recText = document.getElementById('recText');
const recStop = document.getElementById('recStop');

function setRecording(on) {
  recBar.style.display = on ? '' : 'none';
  recordBtn.style.display = on ? 'none' : '';
}

if (recordBtn) recordBtn.addEventListener('click', async () => {
  const input = await localPrompt('記録するフローの名前を入力してください', '新しいフロー');
  if (input === null) return; // キャンセル
  const name = input.trim();
  const res = await window.automation.startRecording(name || undefined);
  if (!res.ok) { setStatus('記録を開始できませんでした: ' + res.error, true); return; }
  recText.textContent = '記録中… ふだん通り操作してください（0 操作）';
  setRecording(true);
  setStatus('');
});

if (recStop) recStop.addEventListener('click', async () => {
  const res = await window.automation.stopRecording();
  setRecording(false);
  if (!res.ok) {
    setStatus(res.error === 'no_steps' ? '操作が記録されませんでした。' : '記録の保存に失敗しました: ' + res.error, true);
    return;
  }
  setStatus(`✓ 記録しました（${res.stepCount}操作）。編集で内容を確認・調整できます。`);
  loadFlows();
});

if (window.automation.onRecordingProgress) window.automation.onRecordingProgress((p) => {
  if (p && typeof p.steps === 'number') recText.textContent = `記録中… ふだん通り操作してください（${p.steps} 操作）`;
});

// 起動時に記録中状態を復元（ウィンドウ再オープン時）
(async () => {
  try { const r = await window.automation.recordingState(); if (r && r.recording) setRecording(true); } catch {}
})();

// ── W10: 初回オンボーディング ─────────────────────────────────────────────────
async function maybeShowOnboarding() {
  try {
    const res = await window.automation.onboardingState();
    if (res && res.ok && !res.done) {
      document.getElementById('onbBg').classList.add('show');
    }
  } catch {}
}
const onbStart = document.getElementById('onbStart');
if (onbStart) onbStart.addEventListener('click', async () => {
  document.getElementById('onbBg').classList.remove('show');
  try { await window.automation.onboardingDone(); } catch {}
});
maybeShowOnboarding();

refreshBtn.addEventListener('click', loadFlows);

window.automation.onRunProgress((p) => {
  if (!p) return;
  if (p.phase === 'aborted') { setStatus('緊急停止しました（Esc）。', true); return; }
  if (typeof p.stepNumber === 'number') {
    setStatus(`実行中… ステップ ${p.stepNumber}/${p.total || '?'}（${p.phase || ''}）`);
  }
});

loadFlows();
