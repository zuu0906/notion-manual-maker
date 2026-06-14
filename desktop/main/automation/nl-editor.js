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

// 並べ替えは set_order（最終並び順を一発指定）で表現する。連鎖 reorder は
// 適用とプレビューで index がズレて曖昧になるため NL編集では使わせない。
const ALLOWED_OPS = Object.freeze(['delete_step', 'set_order', 'update']);
const ALLOWED_PATCH_KEYS = Object.freeze(['label', 'memo', 'inputText', 'isSecret']);

function buildPrompt(flow, instruction) {
  // ユーザーは「○番目」と1始まりで話す。AIにも1始まりの「number」で扱わせ、
  // 0始まりindexへの変換はこちら(sanitizeOps)で行う＝AIの番号取り違えを防ぐ。
  const steps = (flow.steps || []).map((s, i) => ({
    number: i + 1, // 1始まり（ユーザーの「○番目」と一致）
    action: s.action || 'click',
    label: s.label || '',
    inputText: s.isSecret ? null : (s.inputText || ''),
    isSecret: !!s.isSecret,
  }));
  return [
    'あなたは操作フローの編集アシスタントです。ユーザーの指示に従い、編集操作のリストを作ります。',
    'ステップ番号(number)はすべて 1 始まり（1番目=1, 2番目=2 ...）で、編集前の番号です。',
    '使える操作は次の3種類だけです:',
    '  {"op":"delete_step","number":N}            … N番目のステップを削除',
    '  {"op":"set_order","order":[...]}           … 並べ替え。全ステップの「新しい並び順」を',
    '                                               元の number の配列で表す（1始まり・全番号を1回ずつ）',
    '  {"op":"update","number":N,"patch":{...}}   … N番目のステップを更新',
    '',
    '並べ替えの例: ステップが [1,2,3,4] のとき、',
    '  「1番目と3番目を入れ替え」→ 1番目と3番目だけ交換 → order は [3,2,1,4]',
    '  「最後を先頭へ」→ [4,1,2,3]',
    'order には必ず全ステップの番号を漏れなく1回ずつ入れてください。',
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
    'STRICT JSON 配列のみを返してください（説明文なし）。例: [{"op":"delete_step","number":3}]',
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

// AI が返した ops（1始まり number）を、安全かつ 0始まり index の内部opへ変換・絞り込む。
// AI が誤って 0始まり index/from を返した場合にも一応対応（number 優先・無ければ index）。
function sanitizeOps(ops, stepCount) {
  const out = [];
  // 1始まりの number(1..stepCount) を 0始まりindexへ。number が無ければ index をそのまま採用。
  const toIndex = (op, key) => {
    if (isInt(op[key])) return op[key] - 1;          // 1始まり number
    if (isInt(op.index)) return op.index;             // 後方互換（0始まり）
    return NaN;
  };
  for (const op of Array.isArray(ops) ? ops : []) {
    if (!op || !ALLOWED_OPS.includes(op.op)) continue;
    if (op.op === 'delete_step') {
      const idx = toIndex(op, 'number');
      if (isInt(idx) && idx >= 0 && idx < stepCount) out.push({ op: 'delete_step', index: idx });
    } else if (op.op === 'set_order') {
      // order は 1始まり number の順列。0始まりへ変換し、長さ/重複/範囲を検証。
      const raw = op.order;
      if (Array.isArray(raw) && raw.length === stepCount && raw.every((n) => isInt(n))) {
        const order = raw.map((n) => n - 1);
        if (order.every((n) => n >= 0 && n < stepCount) && new Set(order).size === order.length) {
          if (order.some((n, i) => n !== i)) out.push({ op: 'set_order', order }); // 恒等は捨てる
        }
      }
    } else if (op.op === 'update') {
      const idx = toIndex(op, 'number');
      if (!isInt(idx) || idx < 0 || idx >= stepCount) continue;
      const patch = {};
      for (const k of ALLOWED_PATCH_KEYS) {
        if (op.patch && Object.prototype.hasOwnProperty.call(op.patch, k)) {
          const v = op.patch[k];
          if (k === 'isSecret') patch.isSecret = !!v;
          else if (typeof v === 'string') patch[k] = v;
          else if (v === null && k === 'inputText') patch.inputText = null;
        }
      }
      if (Object.keys(patch).length) out.push({ op: 'update', index: idx, patch });
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
    if (op.op === 'set_order') {
      const labels = op.order.map((i) => (steps[i] && steps[i].label) || (steps[i] && steps[i].action) || `元${i + 1}`);
      return `並び順を変更: ${labels.map((l, n) => `${n + 1}. ${l}`).join(' → ')}`;
    }
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
