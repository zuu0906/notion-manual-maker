// safety.js — 危険操作の確認・アクションのホワイトリスト・緊急停止（W5で本実装、W1で骨格）
//
// DANGER_RE は extension/player.js:5 の正規表現を移植（ブラウザ版と挙動を揃える）。

const { globalShortcut } = require('electron');
const { ALLOWED_ACTIONS } = require('./interfaces');

// 出典: extension/player.js — 削除/送信/購入等の不可逆操作を検出
const DANGER_RE = /削除|消去|破棄|送信|購入|支払|決済|解約|退会|delete|remove|destroy|submit|purchase|pay\b|checkout|unsubscribe|logout|sign\s?out|サインアウト|ログアウト/i;

/** ステップが危険操作か（elementHint/label/ocrContext を走査） */
function isDangerous(step) {
  if (!step) return false;
  const hay = [step.label, step.elementHint, step.ocrContext, step.memo]
    .filter(Boolean).join(' ');
  return DANGER_RE.test(hay);
}

/** AI/NLが返したアクションがホワイトリスト内か検証（プロンプトインジェクション対策） */
function checkAction(action) {
  const t = action && action.action;
  if (!ALLOWED_ACTIONS.includes(t) && t !== 'fail' && t !== 'wait') {
    return { allowed: false, reason: `disallowed action: ${t}` };
  }
  return { allowed: true };
}

let _escHandler = null;

/** 実行中のみ Esc を緊急停止に割り当てる */
function registerEmergencyStop(cb) {
  _escHandler = cb;
  try {
    globalShortcut.register('Escape', () => { if (_escHandler) _escHandler(); });
  } catch (e) {
    console.warn('[automation/safety] could not register Escape:', e.message);
  }
}

function unregisterEmergencyStop() {
  _escHandler = null;
  try { globalShortcut.unregister('Escape'); } catch {}
}

module.exports = {
  DANGER_RE, isDangerous, checkAction,
  registerEmergencyStop, unregisterEmergencyStop,
};
