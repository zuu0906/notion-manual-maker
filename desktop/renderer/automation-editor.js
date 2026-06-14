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
};

let flowId = null;
let flow = null;

const ACTION_LABEL = { click: 'クリック', type: '入力', key: 'キー', scroll: 'スクロール', wait: '待機' };

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
  const dangerBadge = ''; // 危険判定は実行側。ここでは種別バッジのみ
  wrap.innerHTML = `
    <div class="srow">
      <div class="num">${i + 1}</div>
      <div class="thumb empty" data-thumb>${step.screenshotFile ? '読み込み中…' : '画像なし'}</div>
      <div class="fields">
        <div><span class="badge">${escapeHtml(ACTION_LABEL[action] || action)}</span>
          ${step.isSecret ? '<span class="badge danger">秘匿</span>' : ''}</div>
        <div>
          <label class="fl">ステップ名</label>
          <input type="text" data-f="label" value="${escapeHtml(step.label || '')}" placeholder="例: 保存ボタンをクリック" />
        </div>
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

// W7b / W8 のフック（後続コミットで実装）
els.nlEdit.addEventListener('click', () => { if (window.openNlEditor) window.openNlEditor(); else setStatus('文章編集は準備中です。', 'warn'); });
els.dryRun.addEventListener('click', () => { if (window.runDryRun) window.runDryRun(); else setStatus('ドライランは準備中です。', 'warn'); });

window.automation.onEditorInit(({ flowId: id }) => { flowId = id; load(); });
// 既に init 済みの場合に備えフォールバック（通常は onEditorInit が先）
setStatus('読み込み中…');
