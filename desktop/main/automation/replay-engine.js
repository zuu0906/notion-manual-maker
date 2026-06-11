// replay-engine.js — ハイブリッド実行ステートマシン（W5で本実装・統合点）
//
// ステップごと: ①ウィンドウ確認 → ②UIA第1階層 → ③OCR第2階層 → ④安全チェック
//             → ⑤実行 → ⑥AIフォールバック（失敗時のみ）。
// 詳細はプラン「ハイブリッド実行エンジン」参照。
//
// ⚠️ W1スタブ: 依存モジュール（input-driver/screen-reader/matcher/ai-fallback）が
//   未実装のため、run() は即座に "engine_not_ready" を返す。UIはこれを見て
//   「実行エンジンは準備中です（Phase 1 W2-W5）」と表示する。

const inputDriver = require('./input-driver');

/**
 * @param {object} flow
 * @param {object} opts RunOptions
 * @returns {Promise<{status:string,results:object[]}>}
 */
async function run(flow, opts = {}) {
  if (!flow || !Array.isArray(flow.steps) || flow.steps.length === 0) {
    return { status: 'failed', results: [], error: 'empty_flow' };
  }
  if (!inputDriver.isReady || !inputDriver.isReady()) {
    return { status: 'engine_not_ready', results: [], error: 'input_driver_not_implemented' };
  }
  // W5: 実際のハイブリッド実行ループをここに実装
  return { status: 'engine_not_ready', results: [] };
}

module.exports = { run };
