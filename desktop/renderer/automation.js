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
  const st = res.result && res.result.status;
  if (st === 'engine_not_ready') {
    setStatus('実行エンジンは準備中です（Phase 1 の実装が完了すると動作します）。', true);
  } else if (st === 'success') {
    setStatus('完了しました。');
  } else if (st === 'aborted') {
    setStatus('中断しました。');
  } else {
    setStatus(`終了: ${st}`);
  }
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
  window.automation.replyPrompt(activePrompt.reqId, value);
  activePrompt = null;
  modal.bg.classList.remove('show');
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
