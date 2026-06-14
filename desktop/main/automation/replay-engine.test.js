// replay-engine.test.js — run() のステートマシンを依存注入で node 単体テスト（W5）
// 実行: node main/automation/replay-engine.test.js
// Electron/PowerShell 非依存（全依存をフェイクに差し替え）。

const assert = require('assert');
const engine = require('./replay-engine');

let pass = 0;
function t(name, fn) {
  return fn().then(() => { pass++; console.log('  ok  -', name); })
    .catch((e) => { console.error('FAIL -', name, '\n     ', e.stack || e.message); process.exitCode = 1; });
}

// ── フェイク依存ビルダ ───────────────────────────────────────────────────────
function makeDeps(over = {}) {
  const calls = [];
  const rec = (name) => (...args) => { calls.push({ name, args }); return Promise.resolve(); };

  const inputDriver = {
    isReady: () => true,
    init: rec('init'),
    activate: (...a) => { calls.push({ name: 'activate', args: a }); return Promise.resolve(true); },
    move: rec('move'),
    click: (...a) => { calls.push({ name: 'click', args: a }); return Promise.resolve(); },
    type: (...a) => { calls.push({ name: 'type', args: a }); return Promise.resolve(); },
    key: (...a) => { calls.push({ name: 'key', args: a }); return Promise.resolve(); },
    scroll: (...a) => { calls.push({ name: 'scroll', args: a }); return Promise.resolve(); },
    uiaFind: over.uiaFind || (async () => null),
  };
  const screenReader = {
    capture: over.capture || (async () => ({ dataUrl: 'data:image/png;base64,AA', width: 1000, height: 800, scaleFactor: 1 })),
    ocr: over.ocr || (async () => ({ words: [] })),
  };
  const matcher = {
    matchByUia: over.matchByUia || (async () => null),
    matchByOcr: over.matchByOcr || (() => null),
    toPhysical: (s) => ({ x: s.x, y: s.y }),
  };
  const ai = {
    isConfigured: () => over.aiConfigured || false,
    decideNextAction: over.decideNextAction || (async () => ({ action: 'fail', confidence: 0, reason: 'x' })),
    verifyResult: async () => ({ status: 'uncertain', reason: '' }),
  };
  const safety = {
    isDangerous: over.isDangerous || (() => false),
  };
  const sleep = () => Promise.resolve();
  return { deps: { inputDriver, screenReader, matcher, ai, safety, sleep }, calls };
}

const flow = (steps) => ({ id: 'f1', name: 'test', steps });

(async () => {
  // 1) UIA特定でクリック成功
  await t('UIA特定 → click 実行で success', async () => {
    const { deps, calls } = makeDeps({
      matchByUia: async () => ({ x: 100, y: 50, confidence: 0.9, method: 'uia', reason: 'uia' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', uia: { name: 'OK' } }]), { deps });
    assert.strictEqual(r.status, 'success');
    const click = calls.find((c) => c.name === 'click');
    assert.deepStrictEqual(click.args, [100, 50, 'left']);
  });

  // 2) UIA不発 → OCRで特定
  await t('UIA不発 → OCR特定で success', async () => {
    const { deps, calls } = makeDeps({
      matchByOcr: () => ({ x: 200, y: 120, confidence: 0.9, method: 'ocr', reason: 'ocr exact' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: '保存' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.ok(calls.find((c) => c.name === 'click').args[0] === 200);
    assert.strictEqual(r.results[0].method, 'ocr');
  });

  // 3) OCRが低信頼 → AIフォールバック（0..1000→物理px変換）
  await t('低信頼OCR → AI特定、座標を物理pxへ変換', async () => {
    const { deps, calls } = makeDeps({
      matchByOcr: () => ({ x: 1, y: 1, confidence: 0.4, method: 'ocr', reason: 'ambiguous' }),
      aiConfigured: true,
      decideNextAction: async () => ({ action: 'click', x: 500, y: 250, confidence: 0.8, reason: 'ai' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.strictEqual(r.status, 'success');
    const click = calls.find((c) => c.name === 'click');
    // width=1000,height=800 → x=500/1000*1000=500, y=250/1000*800=200
    assert.deepStrictEqual(click.args, [500, 200, 'left']);
    assert.strictEqual(r.results[0].method, 'ai');
  });

  // 4) 全階層失敗 → ブラインドクリックせず failed
  await t('特定不可ならクリックせず failed', async () => {
    const { deps, calls } = makeDeps({}); // 何も特定しない
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results[0].reason, 'target_not_found');
    assert.ok(!calls.find((c) => c.name === 'click'), 'クリックしてはいけない');
  });

  // 5) type / key / wait は座標不要で実行
  await t('type は inputText を入力', async () => {
    const { deps, calls } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', inputText: 'こんにちは' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(calls.find((c) => c.name === 'type').args, ['こんにちは']);
  });
  await t('key はvkを送出', async () => {
    const { deps, calls } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'key', vk: 'enter' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(calls.find((c) => c.name === 'key').args, ['enter']);
  });

  // 6) 秘匿 type は入力手段が無ければ失敗
  await t('秘匿typeで実行時入力手段なし → failed', async () => {
    const { deps } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', isSecret: true, inputText: null }]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results[0].reason, 'secret_input_required');
  });
  await t('秘匿type + onRuntimeInput で入力', async () => {
    const { deps, calls } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', isSecret: true, inputText: null }]),
      { deps, onRuntimeInput: async () => 'p@ss' });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(calls.find((c) => c.name === 'type').args, ['p@ss']);
  });

  // 7) 危険操作は確認手段が無ければ実行しない
  await t('危険操作 + onConfirmなし → failed(confirmation_required)', async () => {
    const { deps, calls } = makeDeps({
      isDangerous: () => true,
      matchByUia: async () => ({ x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: '削除' }]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.error, 'confirmation_required');
    assert.ok(!calls.find((c) => c.name === 'click'));
  });
  await t('危険操作 + onConfirm拒否 → aborted', async () => {
    const { deps } = makeDeps({
      isDangerous: () => true,
      matchByUia: async () => ({ x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: '削除' }]),
      { deps, onConfirm: async () => false });
    assert.strictEqual(r.status, 'aborted');
  });
  await t('危険操作 + onConfirm承認 → 実行', async () => {
    const { deps, calls } = makeDeps({
      isDangerous: () => true,
      matchByUia: async () => ({ x: 7, y: 8, confidence: 1, method: 'uia', reason: '' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: '削除' }]),
      { deps, onConfirm: async () => true });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(calls.find((c) => c.name === 'click').args, [7, 8, 'left']);
  });

  // 8) shouldAbort で中断
  await t('shouldAbort=true で即 aborted', async () => {
    const { deps, calls } = makeDeps({
      matchByUia: async () => ({ x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click' }]), { deps, shouldAbort: () => true });
    assert.strictEqual(r.status, 'aborted');
    assert.ok(!calls.find((c) => c.name === 'click'));
  });

  // 9) 失敗ステップで以降を止める
  await t('途中失敗で後続ステップを実行しない', async () => {
    let uiaCalls = 0;
    const { deps, calls } = makeDeps({
      matchByUia: async () => { uiaCalls++; return uiaCalls === 1 ? null : { x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }; },
    });
    const r = await engine.run(flow([
      { stepNumber: 1, action: 'click', label: 'a' }, // 特定不可→失敗
      { stepNumber: 2, action: 'click', label: 'b' }, // 実行されないはず
    ]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results.length, 1);
    assert.ok(!calls.find((c) => c.name === 'click'));
  });

  // 10) 空フロー / 未準備
  await t('空フローは failed(empty_flow)', async () => {
    const { deps } = makeDeps({});
    const r = await engine.run(flow([]), { deps });
    assert.strictEqual(r.error, 'empty_flow');
  });
  await t('input未準備は engine_not_ready', async () => {
    const { deps } = makeDeps({});
    deps.inputDriver.isReady = () => false;
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click' }]), { deps });
    assert.strictEqual(r.status, 'engine_not_ready');
  });

  // 11) wait アクション
  await t('wait は成功扱い', async () => {
    const { deps } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'wait', waitMs: 1 }]), { deps });
    assert.strictEqual(r.status, 'success');
  });

  console.log(`\n${pass} passed`);
})();
