// hud-format.js — 実行中HUDの表示テキスト整形（W6・純関数）
//
// replay-engine の onProgress({stepNumber,total,phase,label}) を、
// HUD レンダラーが描画する {step,title,detail,tone,busy,done} へ変換する。
//
// 純関数のみ（Electron 非依存）なので node 単体テスト可能。
// 実際のウィンドウ管理は hud.js、描画は renderer/run-overlay.js が担う。

/**
 * フェーズ → 表示メタ情報。
 *   tone: 'run'（実行中・青）| 'warn'（確認待ち・橙）| 'ok'（成功・緑）| 'error'（失敗/中断・赤）
 *   busy: スピナー表示するか
 *   done: HUD を閉じてよい終端状態か
 */
const PHASE_META = Object.freeze({
  starting:    { title: '開始しています…',         tone: 'run',  busy: true,  done: false },
  locating:    { title: '対象を探しています…',     tone: 'run',  busy: true,  done: false },
  acting:      { title: '操作を実行中…',           tone: 'run',  busy: true,  done: false },
  verifying:   { title: '結果を確認中…',           tone: 'run',  busy: true,  done: false },
  'ai-fallback': { title: 'AIが判断しています…',   tone: 'run',  busy: true,  done: false },
  recovering:  { title: '画面の状態を整えています…', tone: 'warn', busy: true,  done: false },
  waiting:     { title: '入力をお待ちしています',   tone: 'warn', busy: false, done: false },
  confirm:     { title: '確認をお待ちしています',   tone: 'warn', busy: false, done: false },
  retry:       { title: 'やり直しています…',       tone: 'warn', busy: true,  done: false },
  success:     { title: '完了しました',             tone: 'ok',   busy: false, done: true  },
  done:        { title: '完了しました',             tone: 'ok',   busy: false, done: true  },
  aborted:     { title: '停止しました',             tone: 'error', busy: false, done: true },
  failed:      { title: '失敗しました',             tone: 'error', busy: false, done: true },
  empty_flow:  { title: 'ステップがありません',     tone: 'error', busy: false, done: true },
  engine_not_ready: { title: '実行エンジンは準備中です', tone: 'warn', busy: false, done: true },
});

const DEFAULT_META = Object.freeze({ title: '処理中…', tone: 'run', busy: true, done: false });

/**
 * @param {{stepNumber?:number,total?:number,phase?:string,label?:string,error?:string}} p
 * @returns {{step:string,title:string,detail:string,tone:string,busy:boolean,done:boolean}}
 */
function formatProgress(p = {}) {
  const meta = PHASE_META[p.phase] || DEFAULT_META;

  let step = '';
  const n = Number(p.stepNumber);
  const total = Number(p.total);
  if (Number.isFinite(n) && n > 0) {
    step = Number.isFinite(total) && total > 0 ? `${n} / ${total}` : `${n}`;
  }

  // detail はステップ名を優先。終端の失敗時は error 文言を添える。
  let detail = (p.label || '').toString().trim();
  if (meta.tone === 'error' && p.error) {
    detail = detail ? `${detail}（${p.error}）` : String(p.error);
  }

  return {
    step,
    title: meta.title,
    detail,
    tone: meta.tone,
    busy: meta.busy,
    done: meta.done,
  };
}

module.exports = { formatProgress, PHASE_META };
