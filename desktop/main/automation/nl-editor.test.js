// nl-editor.test.js — opsサニタイズ/パース/提案の node 単体テスト（W7b）
// 実行: node main/automation/nl-editor.test.js

const assert = require('assert');
const nl = require('./nl-editor');
const { parseOpsJson, sanitizeOps, describeOps } = nl._internals;

let pass = 0;
function t(name, fn) {
  const run = () => fn();
  try {
    const r = run();
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
  assert.deepStrictEqual(parseOpsJson('```json\n[{"op":"delete_step","index":1}]\n```'), [{ op: 'delete_step', index: 1 }]);
  assert.deepStrictEqual(parseOpsJson('結果: [{"op":"reorder","from":0,"to":2}] です'), [{ op: 'reorder', from: 0, to: 2 }]);
  assert.deepStrictEqual(parseOpsJson('not json'), []);
});

t('sanitizeOps は許可opのみ通す', () => {
  const ops = sanitizeOps([
    { op: 'delete_step', index: 1 },
    { op: 'reorder', from: 0, to: 2 },
    { op: 'update', index: 2, patch: { label: 'C2' } },
    { op: 'evil', index: 0 },
  ], 3);
  assert.strictEqual(ops.length, 3);
  assert.ok(!ops.find((o) => o.op === 'evil'));
});

t('sanitizeOps は範囲外indexを捨てる', () => {
  assert.deepStrictEqual(sanitizeOps([{ op: 'delete_step', index: 9 }], 3), []);
  assert.deepStrictEqual(sanitizeOps([{ op: 'reorder', from: 0, to: 9 }], 3), []);
  assert.deepStrictEqual(sanitizeOps([{ op: 'reorder', from: 1, to: 1 }], 3), []); // 同一は無意味
});

t('🔑 update patch は許可キーのみ（x/y/uia/action を拒否）', () => {
  const ops = sanitizeOps([{ op: 'update', index: 0, patch: {
    label: 'new', x: 999, y: 999, action: 'exec', uia: { name: 'evil' }, windowTitle: 'z',
  } }], 3);
  assert.strictEqual(ops.length, 1);
  assert.deepStrictEqual(ops[0].patch, { label: 'new' }); // 危険キーは全て除去
});

t('update patch が空になる op は捨てる', () => {
  assert.deepStrictEqual(sanitizeOps([{ op: 'update', index: 0, patch: { x: 1 } }], 3), []);
});

t('isSecret は真偽値化、inputText null許容', () => {
  const ops = sanitizeOps([{ op: 'update', index: 1, patch: { isSecret: 1, inputText: null } }], 3);
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

t('propose: AI提案を検証して返す（fake ai）', () => {
  const ai = { isConfigured: () => true, completeJson: async () => '[{"op":"delete_step","index":2},{"op":"update","index":0,"patch":{"label":"X","action":"evil"}}]' };
  return nl.propose(flow, '最後を消して最初の名前をXに', { ai }).then((r) => {
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.ops.length, 2);
    assert.deepStrictEqual(r.ops[1].patch, { label: 'X' }); // action:evil は除去
    assert.strictEqual(r.changes.length, 2);
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

setTimeout(() => console.log(`\n${pass} passed`), 100);
