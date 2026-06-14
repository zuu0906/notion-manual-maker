// run-overlay.js — 実行中HUDの描画（W6）
// hud.js から 'hud:update' で {step,title,detail,tone,busy,done} を受け取り反映する。

const card = document.getElementById('card');
const dot = document.getElementById('dot');
const stepEl = document.getElementById('step');
const titleEl = document.getElementById('title');
const detailEl = document.getElementById('detail');

const TONES = ['tone-run', 'tone-warn', 'tone-ok', 'tone-error'];

function render(view) {
  if (!view) return;

  // tone クラスの差し替え
  card.classList.remove(...TONES);
  card.classList.add('tone-' + (view.tone || 'run'));

  // スピナー（busy）
  dot.classList.toggle('busy', !!view.busy);

  stepEl.textContent = view.step || '';
  titleEl.textContent = view.title || '';
  detailEl.textContent = view.detail || '';
  detailEl.style.display = view.detail ? '' : 'none';
}

if (window.hud && typeof window.hud.onUpdate === 'function') {
  window.hud.onUpdate(render);
}
