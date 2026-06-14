// nl-editor.test.js — opsサニタイズ/パース/提案の node 単体テスト（W7b）
// 実行: node main/automation/nl-editor.test.js
//
// AI境界は 1始まり number / order（ユーザーの「○番目」と一致）。
// sanitizeOps が 0始まりの内部opへ変換する。

const assert = require('assert');
const nl = require('./nl-editor');
const { parseOpsJson, sanitizeOps, describeOps } = nl._internals;

let pass = 0;
function t(name, fn) {
  try {
    const r = fn();
    if (r && r.then) return r.then(() => { pass++; console.log('  ok  -', name); })
      .catch((e) => { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; });
    pass++; console.log('  ok  -', name);
  } catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
}

const flow = { steps: [
  { action: 'click', label: 'A' },
  { action: 'type', label: 'B', inputText: 'x' },
  { action: 'click', label: 'C' },
] };

t('parseOpsJson は配列を取り出す（フェンス/散文に強い）', () => {
  assert.deepStrictEqual(parseOpsJson('```json\n[{"op":"delete_step","number":2}]\n```'), [{ op: 'delete_step', number: 2 }]);
  assert.deepStrictEqual(parseOpsJson('結果: [{"op":"set_order","order":[3,2,1]}] です'), [{ op: 'set_order', order: [3, 2, 1] }]);
  assert.deepStrictEqual(parseOpsJson('not json'), []);
});

t('sanitizeOps は許可opのみ通し 1始まり→0始まりへ変換', () => {
  const ops = sanitizeOps([
    { op: 'delete_step', number: 2 },                    // → index 1
    { op: 'set_order', order: [3, 2, 1] },               // → [2,1,0]
    { op: 'update', number: 3, patch: { label: 'C2' } }, // → index 2
    { op: 'evil', index: 0 },
    { op: 'reorder', from: 0, to: 2 },                   // NL編集では不許可
  ], 3);
  assert.strictEqual(ops.length, 3);
  assert.deepStrictEqual(ops[0], { op: 'delete_step', index: 1 });
  assert.deepStrictEqual(ops[1], { op: 'set_order', order: [2, 1, 0] });
  assert.deepStrictEqual(ops[2], { op: 'update', index: 2, patch: { label: 'C2' } });
  assert.ok(!ops.find((o) => o.op === 'evil' || o.op === 'reorder'));
});

t('🔑 set_order は順列のみ許可（1番目と3番目を入れ替え）', () => {
  // 1始まり [3,2,1] = 1番目と3番目を交換 → 0始まり [2,1,0]
  assert.deepStrictEqual(sanitizeOps([{ op: 'set_order', order: [3, 2, 1] }], 3), [{ op: 'set_order', order: [2, 1, 0] }]);
});

t('set_order の不正（重複/長さ/範囲/恒等）は捨てる', () => {
  assert.deepStrictEqual(sanitizeOps([{ op: 'set_order', order: [1, 1, 2] }], 3), []); // 重複
  assert.deepStrictEqual(sanitizeOps([{ op: 'set_order', order: [1, 2] }], 3), []);    // 長さ不足
  assert.deepStrictEqual(sanitizeOps([{ op: 'set_order', order: [1, 2, 9] }], 3), []); // 範囲外
  assert.deepStrictEqual(sanitizeOps([{ op: 'set_order', order: [1, 2, 3] }], 3), []); // 恒等＝変更なし
});

t('後方互換: AIが0始まり index を返しても受理', () => {
  assert.deepStrictEqual(sanitizeOps([{ op: 'delete_step', index: 2 }], 3), [{ op: 'delete_step', index: 2 }]);
});

t('sanitizeOps は範囲外を捨てる', () => {
  assert.deepStrictEqual(sanitizeOps([{ op: 'delete_step', number: 9 }], 3), []);
});

t('🔑 update patch は許可キーのみ（x/y/uia/action を拒否）', () => {
  const ops = sanitizeOps([{ op: 'update', number: 1, patch: {
    label: 'new', x: 999, y: 999, action: 'exec', uia: { name: 'evil' }, windowTitle: 'z',
  } }], 3);
  assert.strictEqual(ops.length, 1);
  assert.strictEqual(ops[0].index, 0);
  assert.deepStrictEqual(ops[0].patch, { label: 'new' }); // 危険キーは全て除去
});

t('update patch が空になる op は捨てる', () => {
  assert.deepStrictEqual(sanitizeOps([{ op: 'update', number: 1, patch: { x: 1 } }], 3), []);
});

t('isSecret は真偽値化、inputText null許容', () => {
  const ops = sanitizeOps([{ op: 'update', number: 2, patch: { isSecret: 1, inputText: null } }], 3);
  assert.deepStrictEqual(ops[0].patch, { isSecret: true, inputText: null });
});

t('describeOps は日本語の差分説明を作る', () => {
  const d = describeOps(flow, [
    { op: 'delete_step', index: 0 },
    { op: 'update', index: 1, patch: { label: 'ログイン' } },
  ]);
  assert.ok(d[0].includes('削除'));
  assert.ok(d[1].includes('ログイン'));
});

t('describeOps set_order は最終並び順を元ラベルで示す', () => {
  const d = describeOps(flow, [{ op: 'set_order', order: [2, 1, 0] }]); // 新順序: C,B,A
  assert.ok(d[0].includes('並び順'));
  assert.ok(d[0].indexOf('C') < d[0].indexOf('A'));
});

t('回帰: 「1番目と3番目を入れ替え」を set_order(1始まり)で正しく提案', () => {
  const ai = { isConfigured: () => true, completeJson: async () => '[{"op":"set_order","order":[3,2,1]}]' };
  return nl.propose(flow, '1番目と3番目を入れ替えて', { ai }).then((r) => {
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.ops, [{ op: 'set_order', order: [2, 1, 0] }]);
    assert.strictEqual(r.changes.length, 1);
  });
});

t('propose: AI提案を検証して返す（fake ai・action:evilは除去）', () => {
  const ai = { isConfigured: () => true, completeJson: async () =>
    '[{"op":"delete_step","number":3},{"op":"update","number":1,"patch":{"label":"X","action":"evil"}}]' };
  return nl.propose(flow, '最後を消して最初の名前をXに', { ai }).then((r) => {
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.ops.length, 2);
    assert.deepStrictEqual(r.ops[0], { op: 'delete_step', index: 2 });
    assert.deepStrictEqual(r.ops[1].patch, { label: 'X' });
  });
});

t('propose: 実行可能opが無ければ ok:false', () => {
  const ai = { isConfigured: () => true, completeJson: async () => '[]' };
  return nl.propose(flow, 'よくわからない指示', { ai }).then((r) => {
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'no_actionable_ops');
  });
});

t('propose: AI未設定は ok:false', () => {
  const ai = { isConfigured: () => false, completeJson: async () => '[]' };
  return nl.propose(flow, 'x', { ai }).then((r) => {
    assert.strictEqual(r.error, 'ai_not_configured');
  });
});

setTimeout(() => console.log(`\n${pass} passed`), 120);
