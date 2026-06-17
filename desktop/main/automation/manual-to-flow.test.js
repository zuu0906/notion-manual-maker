// manual-to-flow.test.js — マニュアル→Flow 変換の node 単体テスト（ネットワーク非依存）
// 実行: node main/automation/manual-to-flow.test.js

const assert = require('assert');
const { convertManualToFlow, buildFlowStep } = require('./manual-to-flow');
const ai = require('./ai-fallback');
const { normalizeInfer, buildInferPrompt } = ai._internals;

let pass = 0;
const pending = [];
function t(name, fn) { pending.push([name, fn]); }

const manualStep = {
  stepNumber: 1, x: 100, y: 200, viewportWidth: 1920, viewportHeight: 1080,
  rawDataUrl: 'data:image/png;base64,AAAA',
  annotatedDataUrl: 'data:image/png;base64,ZZZZ',
  label: 'ログインボタン', memo: 'ここを押す', ocrContext: 'ログイン',
};

// ── buildFlowStep（純関数）──────────────────────────────────────────────────
t('buildFlowStep: 既定は click・座標と画面サイズを引き継ぐ', () => {
  const s = buildFlowStep(manualStep, {}, 0);
  assert.strictEqual(s.action, 'click');
  assert.strictEqual(s.x, 100);
  assert.strictEqual(s.y, 200);
  assert.strictEqual(s.viewportWidth, 1920);
  assert.strictEqual(s.stepNumber, 1);
});

t('buildFlowStep: label/memo/ocrContext を引き継ぐ', () => {
  const s = buildFlowStep(manualStep, {}, 0);
  assert.strictEqual(s.label, 'ログインボタン');
  assert.strictEqual(s.memo, 'ここを押す');
  assert.strictEqual(s.ocrContext, 'ログイン');
});

t('buildFlowStep: クリーンな rawDataUrl を screenshotDataUrl に（赤マーカー無し）', () => {
  const s = buildFlowStep(manualStep, {}, 0);
  assert.strictEqual(s.screenshotDataUrl, 'data:image/png;base64,AAAA');
});

t('buildFlowStep: type＋リテラル入力値', () => {
  const s = buildFlowStep(manualStep, { action: 'type', inputText: '営業部' }, 0);
  assert.strictEqual(s.action, 'type');
  assert.strictEqual(s.inputText, '営業部');
  assert.strictEqual(s.promptAtRuntime, false);
});

t('buildFlowStep: type＋秘匿 → 値を持たず実行時入力', () => {
  const s = buildFlowStep(manualStep, { action: 'type', isSecret: true, inputText: 'p@ss' }, 0);
  assert.strictEqual(s.isSecret, true);
  assert.strictEqual(s.inputText, null);
  assert.strictEqual(s.promptAtRuntime, true);
});

t('buildFlowStep: type＋入力内容不明 → 実行時に尋ねる', () => {
  const s = buildFlowStep(manualStep, { action: 'type', inputText: null }, 0);
  assert.strictEqual(s.action, 'type');
  assert.strictEqual(s.inputText, null);
  assert.strictEqual(s.promptAtRuntime, true);
});

t('buildFlowStep: uia があれば引き継ぐ（第1階層用）', () => {
  const ms = { ...manualStep, uia: { automationId: 'loginBtn', controlType: 'Button' } };
  const s = buildFlowStep(ms, {}, 0);
  assert.deepStrictEqual(s.uia, { automationId: 'loginBtn', controlType: 'Button' });
});

t('buildFlowStep: successCriteria を引き継ぐ', () => {
  const s = buildFlowStep(manualStep, { successCriteria: 'ダッシュボードが表示される' }, 0);
  assert.strictEqual(s.successCriteria, 'ダッシュボードが表示される');
});

t('buildFlowStep: stepNumber 欠落時は index+1', () => {
  const s = buildFlowStep({ x: 1, y: 2 }, {}, 4);
  assert.strictEqual(s.stepNumber, 5);
});

// ── normalizeInfer（ai-fallback 純関数）─────────────────────────────────────
t('normalizeInfer: type 以外/不正は click に倒す', () => {
  assert.strictEqual(normalizeInfer({ action: 'launch' }).action, 'click');
  assert.strictEqual(normalizeInfer(null).action, 'click');
  assert.strictEqual(normalizeInfer({}).action, 'click');
});

t('normalizeInfer: 秘匿 type は inputText を捨て promptAtRuntime', () => {
  const o = normalizeInfer({ action: 'type', isSecret: true, inputText: 'secret' });
  assert.strictEqual(o.inputText, null);
  assert.strictEqual(o.promptAtRuntime, true);
});

t('normalizeInfer: リテラル入力は保持', () => {
  const o = normalizeInfer({ action: 'type', inputText: ' 田中 ' });
  assert.strictEqual(o.inputText, '田中');
  assert.strictEqual(o.promptAtRuntime, false);
});

t('buildInferPrompt: STRICT JSON と click/type の指示を含む', () => {
  const p = buildInferPrompt({ label: 'x', ocrContext: 'y' });
  assert.ok(/STRICT JSON/.test(p));
  assert.ok(/"action":"click"\|"type"/.test(p));
});

// ── convertManualToFlow（モック AI）─────────────────────────────────────────
t('convertManualToFlow: AI 未設定なら全ステップ click', async () => {
  const flow = await convertManualToFlow({ name: 'M', steps: [manualStep, manualStep] }, {});
  assert.strictEqual(flow.steps.length, 2);
  assert.ok(flow.steps.every(s => s.action === 'click'));
  assert.strictEqual(flow.name, 'M');
});

t('convertManualToFlow: モック AI の推定を反映', async () => {
  const mockAi = {
    isConfigured: () => true,
    inferStepAction: async () => ({ action: 'type', inputText: 'abc', promptAtRuntime: false }),
  };
  const flow = await convertManualToFlow({ steps: [manualStep] }, { ai: mockAi });
  assert.strictEqual(flow.steps[0].action, 'type');
  assert.strictEqual(flow.steps[0].inputText, 'abc');
});

t('convertManualToFlow: AI が投げても click に倒して継続', async () => {
  const mockAi = {
    isConfigured: () => true,
    inferStepAction: async () => { throw new Error('boom'); },
  };
  const flow = await convertManualToFlow({ steps: [manualStep] }, { ai: mockAi });
  assert.strictEqual(flow.steps[0].action, 'click');
});

t('convertManualToFlow: 名前未指定は既定名・manualId を引き継ぐ', async () => {
  const flow = await convertManualToFlow({ steps: [], manualId: 'm123' }, {});
  assert.strictEqual(flow.name, '無題のマニュアル');
  assert.strictEqual(flow.manualId, 'm123');
});

// ── async ランナー ──────────────────────────────────────────────────────────
(async () => {
  for (const [name, fn] of pending) {
    try { await fn(); pass++; console.log('  ok  -', name); }
    catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
  }
  console.log(`\n${pass}/${pending.length} passed`);
})();
