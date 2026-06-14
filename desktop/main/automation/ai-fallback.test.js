// ai-fallback.test.js — 内部純関数の node 単体テスト（W4・ネットワーク非依存）
// 実行: node main/automation/ai-fallback.test.js

const assert = require('assert');
const { _internals } = require('./ai-fallback');
const {
  splitDataUrl, parseAiJson, normalizeAction, normalizeVerify,
  buildDecidePrompt, buildVerifyPrompt, clampInt, clamp01,
} = _internals;

let pass = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  -', name); }
  catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
}

// ── splitDataUrl ──
t('splitDataUrl は mime と base64 を分離', () => {
  const r = splitDataUrl('data:image/jpeg;base64,AAAB');
  assert.strictEqual(r.mime, 'image/jpeg');
  assert.strictEqual(r.data, 'AAAB');
});
t('splitDataUrl 不正入力は null', () => {
  assert.strictEqual(splitDataUrl('not-a-data-url'), null);
  assert.strictEqual(splitDataUrl(''), null);
  assert.strictEqual(splitDataUrl(undefined), null);
});

// ── parseAiJson ──
t('素の JSON をパース', () => {
  assert.deepStrictEqual(parseAiJson('{"action":"wait"}'), { action: 'wait' });
});
t('コードフェンス付きをパース', () => {
  assert.deepStrictEqual(parseAiJson('```json\n{"action":"click","x":1}\n```'), { action: 'click', x: 1 });
});
t('前後に散文があっても最初の{...}を抽出', () => {
  assert.deepStrictEqual(parseAiJson('Here you go: {"status":"success"} done'), { status: 'success' });
});
t('壊れた応答は null', () => {
  assert.strictEqual(parseAiJson('totally not json'), null);
  assert.strictEqual(parseAiJson(null), null);
});

// ── clamp ──
t('clampInt は丸めて範囲制限、非数は null', () => {
  assert.strictEqual(clampInt('1200', 0, 1000), 1000);
  assert.strictEqual(clampInt(-5, 0, 1000), 0);
  assert.strictEqual(clampInt(3.6, 0, 1000), 4);
  assert.strictEqual(clampInt('abc', 0, 1000), null);
});
t('clamp01 は0..1、非数は0', () => {
  assert.strictEqual(clamp01(2), 1);
  assert.strictEqual(clamp01(-1), 0);
  assert.strictEqual(clamp01('x'), 0);
  assert.strictEqual(clamp01(0.4), 0.4);
});

// ── normalizeAction ──
t('正常な click を正規化', () => {
  const a = normalizeAction({ action: 'click', x: 500, y: 250, confidence: 0.9, reason: 'ok' });
  assert.deepStrictEqual(a, { action: 'click', confidence: 0.9, reason: 'ok', x: 500, y: 250 });
});
t('type は text を保持し座標不要', () => {
  const a = normalizeAction({ action: 'type', text: 'hello', confidence: 0.8 });
  assert.strictEqual(a.action, 'type');
  assert.strictEqual(a.text, 'hello');
});
t('click で座標欠落は fail に倒す', () => {
  const a = normalizeAction({ action: 'click', confidence: 0.9 });
  assert.strictEqual(a.action, 'fail');
  assert.strictEqual(a.reason, 'missing_coordinates');
});
t('ホワイトリスト外アクションは fail（インジェクション対策）', () => {
  for (const bad of ['exec', 'open', 'navigate', 'download', 'runCommand']) {
    const a = normalizeAction({ action: bad, x: 1, y: 1, confidence: 1 });
    assert.strictEqual(a.action, 'fail', `${bad} は fail であるべき`);
    assert.strictEqual(a.confidence, 0);
  }
});
t('座標は0..1000にクランプ', () => {
  const a = normalizeAction({ action: 'click', x: 5000, y: -3, confidence: 0.5 });
  assert.strictEqual(a.x, 1000);
  assert.strictEqual(a.y, 0);
});
t('null/壊れた入力は fail', () => {
  assert.strictEqual(normalizeAction(null).action, 'fail');
  assert.strictEqual(normalizeAction('x').action, 'fail');
});

// ── normalizeVerify ──
t('verify の status を検証、未知は uncertain', () => {
  assert.strictEqual(normalizeVerify({ status: 'success', reason: 'r' }).status, 'success');
  assert.strictEqual(normalizeVerify({ status: 'weird' }).status, 'uncertain');
  assert.strictEqual(normalizeVerify(null).status, 'uncertain');
});

// ── プロンプト ──
t('decideプロンプトに step 情報が入る', () => {
  const p = buildDecidePrompt({ label: '保存ボタン', action: 'click', inputText: 'abc', ocrContext: '保存 キャンセル' });
  assert.ok(p.includes('保存ボタン'));
  assert.ok(p.includes('abc'));
  assert.ok(p.includes('保存 キャンセル'));
  assert.ok(/0\.\.1000/.test(p));
});
t('verifyプロンプトに successCriteria が入る', () => {
  const p = buildVerifyPrompt({ label: '送信' }, '送信完了の表示が出る');
  assert.ok(p.includes('送信完了の表示が出る'));
});

console.log(`\n${pass} passed`);
