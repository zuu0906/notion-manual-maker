// ai-fallback.js — Gemini による次アクション判断・結果検証（W4で本実装）
//
// dev: .env.local の GEMINI_API_KEY で generativelanguage.googleapis.com を直叩き
//      （main プロセス内のみ。renderer にキーを渡さない）。
//      ⚠️ 現状 .env.local に GEMINI_API_KEY は無い → dev検証時に追加が必要。
// prod: AUTOMATION_AI_BACKEND=proxy で gemini-proxy 経由に切替（Phase 7 設計）。
//
// リトライ/バックオフは supabase/functions/gemini-proxy/index.ts の callGemini を移植。
// 返却アクションは safety.checkAction でホワイトリスト検証してからエンジンが実行する。
//
// ⚠️ W1スタブ。

const NI = (name) => { throw new Error(`ai-fallback.${name}: NOT_IMPLEMENTED (W4)`); };

function isConfigured() {
  return !!process.env.GEMINI_API_KEY || process.env.AUTOMATION_AI_BACKEND === 'proxy';
}

module.exports = {
  isConfigured,
  /** @returns {Promise<AiAction>} */
  async decideNextAction(/* ctx */) { return NI('decideNextAction'); },
  /** @returns {Promise<{status,reason}>} */
  async verifyResult(/* ctx */) { return NI('verifyResult'); },
};
