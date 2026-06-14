// hud-format.test.js — formatProgress の node 単体テスト（W6）
// 実行: node main/automation/hud-format.test.js
// Electron 非依存（純関数のみ）。

const assert = require('assert');
const { formatProgress, PHASE_META } = require('./hud-format');

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  -', name); }
  catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
}

t('step を "n / total" に整形する', () => {
  const v = formatProgress({ stepNumber: 3, total: 10, phase: 'acting' });
  assert.strictEqual(v.step, '3 / 10');
  assert.strictEqual(v.title, '操作を実行中…');
  assert.strictEqual(v.tone, 'run');
  assert.strictEqual(v.busy, true);
  assert.strictEqual(v.done, false);
});

t('total 不明なら step 番号のみ', () => {
  assert.strictEqual(formatProgress({ stepNumber: 2, phase: 'locating' }).step, '2');
});

t('stepNumber 無し/0 なら step は空', () => {
  assert.strictEqual(formatProgress({ phase: 'starting' }).step, '');
  assert.strictEqual(formatProgress({ stepNumber: 0, total: 5, phase: 'starting' }).step, '');
});

t('label は detail に入る', () => {
  assert.strictEqual(formatProgress({ phase: 'acting', label: '保存ボタン' }).detail, '保存ボタン');
});

t('error トーンでは error 文言が detail に添えられる', () => {
  const v = formatProgress({ phase: 'failed', label: '送信', error: 'not_found' });
  assert.strictEqual(v.tone, 'error');
  assert.strictEqual(v.detail, '送信（not_found）');
  assert.strictEqual(v.done, true);
});

t('label 無しの失敗は error のみ', () => {
  assert.strictEqual(formatProgress({ phase: 'failed', error: 'x' }).detail, 'x');
});

t('未知フェーズは既定（処理中・run・継続）にフォールバック', () => {
  const v = formatProgress({ phase: 'unknown-xyz' });
  assert.strictEqual(v.title, '処理中…');
  assert.strictEqual(v.tone, 'run');
  assert.strictEqual(v.done, false);
});

t('引数なしでも落ちない', () => {
  const v = formatProgress();
  assert.strictEqual(typeof v.title, 'string');
  assert.strictEqual(v.step, '');
});

t('終端フェーズは done:true', () => {
  for (const ph of ['success', 'done', 'aborted', 'failed', 'empty_flow', 'engine_not_ready']) {
    assert.strictEqual(formatProgress({ phase: ph }).done, true, `${ph} は done であるべき`);
  }
});

t('実行系フェーズは done:false', () => {
  for (const ph of ['starting', 'locating', 'acting', 'verifying', 'ai-fallback', 'retry']) {
    assert.strictEqual(formatProgress({ phase: ph }).done, false, `${ph} は継続中であるべき`);
  }
});

t('PHASE_META の tone は既定4種のいずれか', () => {
  const allowed = new Set(['run', 'warn', 'ok', 'error']);
  for (const [k, m] of Object.entries(PHASE_META)) {
    assert.ok(allowed.has(m.tone), `${k} の tone が不正: ${m.tone}`);
  }
});

console.log(`\n${pass} passed`);
