// nl-editor.js — 自然言語によるフロー編集（W7b）
//
// ユーザーの指示文（例:「3番目を削除して、最初のステップ名を"ログイン"に」）を
// Gemini に渡し、操作リスト(ops)の提案を得る → 差分を提示 → 承認後に flow-store.applyOps。
//
// 【安全方針】
//   - 許可opは delete_step / reorder / update のみ。
//   - update の patch は label/memo/inputText/isSecret に限定。
//     座標(x/y)・uia・action・windowTitle 等は AI に変更させない（破壊・インジェクション防止）。
//   - index 範囲外・型不正な op は捨てる。AI出力は必ずこのサニタイズを通す。

const ALLOWED_OPS = Object.freeze(['delete_step', 'reorder', 'update']);
const ALLOWED_PATCH_KEYS = Object.freeze(['label', 'memo', 'inputText', 'isSecret']);

function buildPrompt(flow, instruction) {
  const steps = (flow.steps || []).map((s, i) => ({
    index: i,
    action: s.action || 'click',
    label: s.label || '',
    inputText: s.isSecret ? null : (s.inputText || ''),
    isSecret: !!s.isSecret,
  }));
  return [
    'あなたは操作フローの編集アシスタントです。ユーザーの指示に従い、編集操作のリストを作ります。',
    '使える操作は次の3種類だけです:',
    '  {"op":"delete_step","index":N}            … N番目(0始まり)のステップを削除',
    '  {"op":"reorder","from":A,"to":B}          … A番目をB番目へ移動',
    '  {"op":"update","index":N,"patch":{...}}   … N番目のステップを更新',
    'update の patch に書けるキーは label / memo / inputText / isSecret のみ。',
    '座標やクリック対象、アクション種別は変更できません。',
    '指示が曖昧で操作を決められない場合は空配列 [] を返してください。',
    '',
    '現在のステップ(JSON):',
    JSON.stringify(steps, null, 2),
    '',
    'ユーザーの指示:',
    String(instruction || ''),
    '',
    'STRICT JSON 配列のみを返してください（説明文なし）。例: [{"op":"delete_step","index":2}]',
  ].join('\n');
}

// 応答テキストから JSON 配列を取り出す
function parseOpsJson(raw) {
  if (typeof raw !== 'string') return [];
  let s = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1].trim();
  const arr = /\[[\s\S]*\]/.exec(s);
  if (arr) s = arr[0];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

const isInt = (v) => Number.isInteger(v);

// AI が返した ops を安全な形だけに絞り込む
function sanitizeOps(ops, stepCount) {
  const out = [];
  for (const op of Array.isArray(ops) ? ops : []) {
    if (!op || !ALLOWED_OPS.includes(op.op)) continue;
    if (op.op === 'delete_step') {
      if (isInt(op.index) && op.index >= 0 && op.index < stepCount) out.push({ op: 'delete_step', index: op.index });
    } else if (op.op === 'reorder') {
      if (isInt(op.from) && isInt(op.to) && op.from >= 0 && op.from < stepCount && op.to >= 0 && op.to < stepCount && op.from !== op.to) {
        out.push({ op: 'reorder', from: op.from, to: op.to });
      }
    } else if (op.op === 'update') {
      if (!isInt(op.index) || op.index < 0 || op.index >= stepCount) continue;
      const patch = {};
      for (const k of ALLOWED_PATCH_KEYS) {
        if (op.patch && Object.prototype.hasOwnProperty.call(op.patch, k)) {
          const v = op.patch[k];
          if (k === 'isSecret') patch.isSecret = !!v;
          else if (typeof v === 'string') patch[k] = v;
          else if (v === null && k === 'inputText') patch.inputText = null;
        }
      }
      if (Object.keys(patch).length) out.push({ op: 'update', index: op.index, patch });
    }
  }
  return out;
}

// 人間可読の差分説明（承認画面に出す）
function describeOps(flow, ops) {
  const steps = flow.steps || [];
  const nameOf = (i) => `${i + 1}. ${(steps[i] && steps[i].label) || (steps[i] && steps[i].action) || 'ステップ'}`;
  return ops.map((op) => {
    if (op.op === 'delete_step') return `「${nameOf(op.index)}」を削除`;
    if (op.op === 'reorder') return `「${nameOf(op.from)}」を ${op.to + 1} 番目へ移動`;
    if (op.op === 'update') {
      const parts = Object.entries(op.patch).map(([k, v]) => {
        const label = { label: 'ステップ名', memo: 'メモ', inputText: '入力値', isSecret: '秘匿' }[k] || k;
        const val = k === 'isSecret' ? (v ? 'オン' : 'オフ') : (v === null ? '（消去）' : `「${v}」`);
        return `${label}を ${val}`;
      });
      return `「${nameOf(op.index)}」の ${parts.join(' / ')} に変更`;
    }
    return JSON.stringify(op);
  });
}

/**
 * 指示文から編集opsを提案する。
 * @param {object} flow
 * @param {string} instruction
 * @param {{ai?:{completeJson:Function}}} [deps]
 * @returns {Promise<{ok:boolean,ops:object[],changes:string[],error?:string}>}
 */
async function propose(flow, instruction, deps = {}) {
  const ai = deps.ai || require('./ai-fallback');
  if (!ai.isConfigured || !ai.isConfigured()) return { ok: false, ops: [], changes: [], error: 'ai_not_configured' };
  if (!instruction || !String(instruction).trim()) return { ok: false, ops: [], changes: [], error: 'empty_instruction' };

  let raw;
  try { raw = await ai.completeJson(buildPrompt(flow, instruction)); }
  catch (e) { return { ok: false, ops: [], changes: [], error: e.message }; }

  const ops = sanitizeOps(parseOpsJson(raw), (flow.steps || []).length);
  if (!ops.length) return { ok: false, ops: [], changes: [], error: 'no_actionable_ops' };
  return { ok: true, ops, changes: describeOps(flow, ops) };
}

module.exports = {
  propose,
  ALLOWED_OPS, ALLOWED_PATCH_KEYS,
  _internals: { buildPrompt, parseOpsJson, sanitizeOps, describeOps },
};
