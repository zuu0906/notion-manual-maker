// ai-fallback.js — Gemini による次アクション判断・結果検証（W4 本実装）
//
// dev : .env.local の GEMINI_API_KEY で generativelanguage.googleapis.com を直叩き
//       （main プロセス内のみ。renderer にキーを渡さない）。
// prod: AUTOMATION_AI_BACKEND=proxy で gemini-proxy 経由に切替（Phase 7・未実装）。
//
// 返却アクションは必ず safety.checkAction でホワイトリスト検証してから返す
// （間接プロンプトインジェクション対策。任意コマンド/ファイル/URL を実行させない）。
//
// 座標は「スクリーンショットに対する 0..1000 正規化整数」で返す。
// 物理pxへの変換は replay-engine（W5）がキャプチャ実寸を使って行う。
//
// callGemini のリトライ/バックオフは supabase/functions/gemini-proxy/index.ts から移植。

const { checkAction } = require('./safety');

const GEMINI_MODEL = 'gemini-2.5-flash';
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

function isConfigured() {
  return !!process.env.GEMINI_API_KEY || process.env.AUTOMATION_AI_BACKEND === 'proxy';
}

// ── data URL → {mime, data(base64)} ────────────────────────────────────────
function splitDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?;base64,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1] || 'image/png', data: m[2] };
}

function imagePart(dataUrl) {
  const img = splitDataUrl(dataUrl);
  if (!img) return null;
  return { inline_data: { mime_type: img.mime, data: img.data } };
}

// ── 応答テキストから JSON を頑健に取り出す ──────────────────────────────────
function parseAiJson(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  // ```json ... ``` のコードフェンスを除去
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1].trim();
  // 最初の { ... } を抽出（前後の説明文に強くする）
  const obj = /\{[\s\S]*\}/.exec(s);
  if (obj) s = obj[0];
  try { return JSON.parse(s); } catch { return null; }
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// AI の生オブジェクト → 検証済み AiAction。安全でなければ fail に倒す。
function normalizeAction(obj) {
  if (!obj || typeof obj !== 'object') {
    return { action: 'fail', confidence: 0, reason: 'unparseable_response' };
  }
  const action = String(obj.action || '').toLowerCase();
  const verdict = checkAction({ action });
  if (!verdict.allowed) {
    return { action: 'fail', confidence: 0, reason: verdict.reason || 'disallowed_action' };
  }

  const out = {
    action,
    confidence: clamp01(obj.confidence),
    reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 300) : '',
  };
  const x = clampInt(obj.x, 0, 1000);
  const y = clampInt(obj.y, 0, 1000);
  if (x !== null) out.x = x;
  if (y !== null) out.y = y;
  if (typeof obj.text === 'string') out.text = obj.text;

  // click/scroll は座標が要る。欠落していたら fail に倒す（誤クリック防止）。
  if ((action === 'click' || action === 'scroll') && (out.x === undefined || out.y === undefined)) {
    return { action: 'fail', confidence: 0, reason: 'missing_coordinates' };
  }
  return out;
}

function normalizeVerify(obj) {
  const allowed = ['success', 'fail', 'uncertain'];
  const status = obj && allowed.includes(String(obj.status)) ? String(obj.status) : 'uncertain';
  const reason = obj && typeof obj.reason === 'string' ? obj.reason.slice(0, 300) : '';
  return { status, reason };
}

// ── Gemini 呼び出し（直叩き・指数バックオフ）────────────────────────────────
async function callGemini(parts, { retries = 3 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY_not_set');
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(ENDPOINT(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const msg = data.error?.message || `Gemini error ${res.status}`;
    const retryable = res.status === 503 || res.status === 429 ||
      /high demand|overloaded/i.test(msg);
    if (!retryable || attempt === retries) throw new Error(msg);
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); // 1s,2s,4s
  }
  throw new Error('Gemini: max retries exceeded');
}

// ── プロンプト生成 ──────────────────────────────────────────────────────────
const ALLOWED_TXT = '"click", "type", "scroll", "wait", "fail"';

function buildDecidePrompt(step = {}) {
  const desc = step.label || step.memo || step.action || '(no description)';
  const lines = [
    'You operate a Windows desktop via low-level input.',
    'Look at the CURRENT screenshot and decide the SINGLE next action to perform the intended step.',
    `Allowed "action" values ONLY: ${ALLOWED_TXT}.`,
    'Use "fail" if the target is not clearly visible or you are unsure (do NOT guess coordinates).',
    'Coordinates MUST be integers 0..1000 normalized to the screenshot (x: left→right, y: top→bottom).',
    'For "type", put the text to enter in "text". For "scroll", put "up" or "down" in "text".',
    '',
    'Intended step:',
    `- description: ${desc}`,
    `- recorded action: ${step.action || 'click'}`,
  ];
  if (step.inputText) lines.push(`- text to type: ${step.inputText}`);
  if (step.ocrContext) lines.push(`- nearby text when recorded: ${step.ocrContext}`);
  lines.push(
    '',
    'Return STRICT JSON only, no prose:',
    '{"action": "...", "x": 0, "y": 0, "text": "...", "confidence": 0.0, "reason": "..."}',
    'Omit x/y/text when not relevant to the chosen action.'
  );
  return lines.join('\n');
}

function buildVerifyPrompt(step = {}, successCriteria = '') {
  return [
    'You verify whether a desktop automation step succeeded by inspecting the screenshot.',
    `Intended step: ${step.label || step.action || '(step)'}`,
    `Success criteria: ${successCriteria || '(the intended step appears completed)'}`,
    '',
    'Return STRICT JSON only:',
    '{"status": "success" | "fail" | "uncertain", "reason": "..."}',
    'Use "uncertain" if you cannot tell from the screenshot.',
  ].join('\n');
}

// ── 公開 API（interfaces.AiFallback）────────────────────────────────────────
/**
 * @param {{screenshotDataUrl:string,recordedCropDataUrl?:string,step:object,uiaTreeText?:string}} ctx
 * @returns {Promise<import('./interfaces')&{action:string}>}
 */
async function decideNextAction(ctx = {}) {
  if (process.env.AUTOMATION_AI_BACKEND === 'proxy') {
    throw new Error('proxy_backend_not_implemented'); // Phase 7
  }
  const parts = [{ text: buildDecidePrompt(ctx.step) }];

  const shot = imagePart(ctx.screenshotDataUrl);
  if (!shot) return { action: 'fail', confidence: 0, reason: 'no_screenshot' };
  parts.push({ text: 'CURRENT screenshot:' }, shot);

  const crop = ctx.recordedCropDataUrl && imagePart(ctx.recordedCropDataUrl);
  if (crop) parts.push({ text: 'For reference, the recorded target area looked like:' }, crop);

  if (ctx.uiaTreeText) {
    parts.push({ text: 'UI elements (UIA) currently on screen:\n' + String(ctx.uiaTreeText).slice(0, 4000) });
  }

  const raw = await callGemini(parts);
  return normalizeAction(parseAiJson(raw));
}

/**
 * @param {{screenshotDataUrl:string,successCriteria:string,step:object}} ctx
 * @returns {Promise<{status:'success'|'fail'|'uncertain',reason:string}>}
 */
async function verifyResult(ctx = {}) {
  if (process.env.AUTOMATION_AI_BACKEND === 'proxy') {
    throw new Error('proxy_backend_not_implemented');
  }
  const shot = imagePart(ctx.screenshotDataUrl);
  if (!shot) return { status: 'uncertain', reason: 'no_screenshot' };

  const parts = [{ text: buildVerifyPrompt(ctx.step, ctx.successCriteria) }, shot];
  const raw = await callGemini(parts);
  return normalizeVerify(parseAiJson(raw));
}

function buildRecoverPrompt(step = {}) {
  return [
    'A desktop automation step could not find its target element.',
    'Look at the screenshot for an UNEXPECTED obstacle blocking the screen:',
    'a dialog, popup, cookie/consent banner, permission prompt, notification, or error message.',
    `The step we are trying to do: ${step.label || step.action || '(step)'}`,
    'If an obstacle is present, return ONE action to dismiss/close it so the flow can continue:',
    '  - "click" its close/OK/cancel/dismiss button (x,y normalized 0..1000), or',
    '  - "key" with "text":"esc".',
    'If there is NO blocking obstacle (the target is simply missing), return {"action":"fail"}.',
    '',
    'Return STRICT JSON only:',
    '{"action": "click" | "key" | "fail", "x": 0, "y": 0, "text": "esc", "confidence": 0.0, "reason": "..."}',
    'Omit x/y/text when not relevant.',
  ].join('\n');
}

/**
 * 特定不能時の例外処理（W13）。画面の障害物を検知し、解消アクションを1つ返す。
 * @param {{screenshotDataUrl:string,step:object}} ctx
 * @returns {Promise<AiAction>} action='fail' なら障害物なし（復旧不要/不可）
 */
async function recoverFromObstacle(ctx = {}) {
  if (process.env.AUTOMATION_AI_BACKEND === 'proxy') {
    throw new Error('proxy_backend_not_implemented');
  }
  const shot = imagePart(ctx.screenshotDataUrl);
  if (!shot) return { action: 'fail', confidence: 0, reason: 'no_screenshot' };
  const parts = [{ text: buildRecoverPrompt(ctx.step) }, { text: 'CURRENT screenshot:' }, shot];
  const raw = await callGemini(parts);
  return normalizeAction(parseAiJson(raw));
}

/**
 * テキストのみのJSON補完（W7b NLエディタ用）。画像なし。
 * @param {string} promptText
 * @returns {Promise<string>} 生テキスト（JSON想定）
 */
async function completeJson(promptText) {
  if (process.env.AUTOMATION_AI_BACKEND === 'proxy') {
    throw new Error('proxy_backend_not_implemented');
  }
  return callGemini([{ text: String(promptText || '') }]);
}

module.exports = {
  isConfigured,
  decideNextAction,
  verifyResult,
  recoverFromObstacle,
  completeJson,
  // テスト用内部関数（ネットワーク非依存・純関数）
  _internals: {
    splitDataUrl, parseAiJson, normalizeAction, normalizeVerify,
    buildDecidePrompt, buildVerifyPrompt, buildRecoverPrompt, clampInt, clamp01,
  },
};
