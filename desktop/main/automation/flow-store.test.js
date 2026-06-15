// flow-store.test.js — 編集ops（W7基盤）の node 単体テスト
// 実行: node main/automation/flow-store.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./flow-store');

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  -', name); }
  catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmm-flowstore-'));
store.init(tmp);

function freshFlow() {
  return store.saveFlow({
    name: 'テスト',
    steps: [
      { action: 'click', label: 'A', x: 1, y: 1 },
      { action: 'type', label: 'B', inputText: 'foo' },
      { action: 'click', label: 'C' },
    ],
  });
}

t('saveFlow → getFlow ラウンドトリップ', () => {
  const id = freshFlow();
  const f = store.getFlow(id);
  assert.strictEqual(f.steps.length, 3);
  assert.strictEqual(f.name, 'テスト');
});

t('updateStep は該当ステップだけ更新しbackupを残す', () => {
  const id = freshFlow();
  store.updateStep(id, 1, { inputText: 'bar', memo: 'm' });
  const f = store.getFlow(id);
  assert.strictEqual(f.steps[1].inputText, 'bar');
  assert.strictEqual(f.steps[1].memo, 'm');
  assert.strictEqual(f.steps[0].label, 'A'); // 他は不変
});

t('updateStep の秘匿ステップは inputText を保存しない', () => {
  const id = freshFlow();
  store.updateStep(id, 1, { isSecret: true, inputText: 'secret' });
  assert.strictEqual(store.getFlow(id).steps[1].inputText, null);
});

t('applyOps delete_step で削除しstepNumber振り直し', () => {
  const id = freshFlow();
  store.applyOps(id, [{ op: 'delete_step', index: 0 }]);
  const f = store.getFlow(id);
  assert.strictEqual(f.steps.length, 2);
  assert.strictEqual(f.steps[0].label, 'B');
  assert.strictEqual(f.steps[0].stepNumber, 1);
  assert.strictEqual(f.steps[1].stepNumber, 2);
});

t('applyOps reorder で並べ替え', () => {
  const id = freshFlow();
  store.applyOps(id, [{ op: 'reorder', from: 0, to: 2 }]);
  const labels = store.getFlow(id).steps.map(s => s.label);
  assert.deepStrictEqual(labels, ['B', 'C', 'A']);
});

t('applyOps set_order で1番目と3番目を入れ替え', () => {
  const id = freshFlow(); // [A,B,C]
  store.applyOps(id, [{ op: 'set_order', order: [2, 1, 0] }]);
  const labels = store.getFlow(id).steps.map(s => s.label);
  assert.deepStrictEqual(labels, ['C', 'B', 'A']);
  // stepNumber も振り直し
  assert.deepStrictEqual(store.getFlow(id).steps.map(s => s.stepNumber), [1, 2, 3]);
});

t('applyOps set_order は不正な順列を無視', () => {
  const id = freshFlow();
  store.applyOps(id, [{ op: 'set_order', order: [0, 0, 1] }]);     // 重複
  assert.deepStrictEqual(store.getFlow(id).steps.map(s => s.label), ['A', 'B', 'C']);
  store.applyOps(id, [{ op: 'set_order', order: [0, 1] }]);        // 長さ不足
  assert.deepStrictEqual(store.getFlow(id).steps.map(s => s.label), ['A', 'B', 'C']);
});

t('applyOps update で patch 適用', () => {
  const id = freshFlow();
  store.applyOps(id, [{ op: 'update', index: 2, patch: { label: 'C2' } }]);
  assert.strictEqual(store.getFlow(id).steps[2].label, 'C2');
});

t('applyOps insert_step で先頭にlaunchステップ挿入', () => {
  const id = freshFlow(); // [A,B,C]
  store.applyOps(id, [{ op: 'insert_step', index: 0, step: { action: 'launch', label: '起動', launchTarget: 'notepad.exe' } }]);
  const f = store.getFlow(id);
  assert.strictEqual(f.steps.length, 4);
  assert.strictEqual(f.steps[0].action, 'launch');
  assert.strictEqual(f.steps[0].launchTarget, 'notepad.exe');
  assert.deepStrictEqual(f.steps.map(s => s.stepNumber), [1, 2, 3, 4]); // 振り直し
  assert.strictEqual(f.steps[1].label, 'A');
});

t('renameFlow で名前変更', () => {
  const id = freshFlow();
  store.renameFlow(id, '新しい名前');
  assert.strictEqual(store.getFlow(id).name, '新しい名前');
});

t('renameFlow 空文字は無視（既存名維持）', () => {
  const id = freshFlow();
  store.renameFlow(id, '   ');
  assert.strictEqual(store.getFlow(id).name, 'テスト');
});

t('restore で直前の編集を取り消せる', () => {
  const id = freshFlow();
  store.updateStep(id, 0, { label: 'Z' });
  assert.strictEqual(store.getFlow(id).steps[0].label, 'Z');
  assert.strictEqual(store.restore(id), true);
  assert.strictEqual(store.getFlow(id).steps[0].label, 'A'); // 元に戻る
});

t('listFlows は要約を更新日時降順で返す', () => {
  const id = freshFlow();
  const list = store.listFlows();
  assert.ok(list.length >= 1);
  const me = list.find(x => x.id === id);
  assert.strictEqual(me.stepCount, 3);
});

t('appendRunLog / getRunLog は新しい順で最大20件保持', () => {
  const id = freshFlow();
  for (let i = 0; i < 25; i++) store.appendRunLog(id, { status: 'success', n: i });
  const log = store.getRunLog(id);
  assert.strictEqual(log.length, 20);
  assert.strictEqual(log[0].n, 24); // 最新が先頭
  assert.strictEqual(log[19].n, 5);
});

t('getRunLog 履歴なしは空配列', () => {
  const id = freshFlow();
  assert.deepStrictEqual(store.getRunLog(id), []);
});

// 後始末
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

console.log(`\n${pass} passed`);
