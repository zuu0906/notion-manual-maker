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
    uiaInspect: over.uiaInspect || (async () => null),
    // 既定では「対象が前面になっている」とみなす（needle 'np'/'メモ帳' を含める）
    foreground: over.foreground || (async () => ({ title: 'メモ帳', processName: 'np' })),
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
    verifyResult: over.verifyResult || (async () => ({ status: 'uncertain', reason: '' })),
    recoverFromObstacle: over.recoverFromObstacle || (async () => ({ action: 'fail', confidence: 0, reason: 'none' })),
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

  // ── W8: ドライラン ──
  await t('dryRun はクリック/入力せず特定だけ行う', async () => {
    const { deps, calls } = makeDeps({
      matchByUia: async () => ({ x: 5, y: 6, confidence: 1, method: 'uia', reason: '' }),
    });
    const r = await engine.run(flow([
      { stepNumber: 1, action: 'click', label: 'a' },
      { stepNumber: 2, action: 'type', inputText: 'x' },
    ]), { deps, dryRun: true });
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.status, 'success');
    assert.ok(!calls.find((c) => c.name === 'click'), 'dryRunでクリックしてはいけない');
    assert.ok(!calls.find((c) => c.name === 'type'), 'dryRunで入力してはいけない');
  });

  await t('dryRun は失敗しても止めず全ステップ評価', async () => {
    let n = 0;
    const { deps } = makeDeps({
      matchByUia: async () => { n++; return n === 1 ? null : { x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }; },
    });
    const r = await engine.run(flow([
      { stepNumber: 1, action: 'click', label: 'a' }, // 特定不可
      { stepNumber: 2, action: 'click', label: 'b' }, // 特定可
    ]), { deps, dryRun: true });
    assert.strictEqual(r.results.length, 2);
    assert.strictEqual(r.results[0].status, 'failed');
    assert.strictEqual(r.results[1].status, 'ok');
    assert.strictEqual(r.status, 'failed'); // 1つでも失敗なら全体failed
  });

  await t('dryRun の秘匿typeは prompt_at_runtime として ok', async () => {
    const { deps } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', isSecret: true, inputText: null }]),
      { deps, dryRun: true });
    assert.strictEqual(r.results[0].status, 'ok');
    assert.strictEqual(r.results[0].reason, 'prompt_at_runtime');
  });

  await t('dryRun は危険操作でも確認を求めず特定する', async () => {
    const { deps, calls } = makeDeps({
      isDangerous: () => true,
      matchByUia: async () => ({ x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: '削除' }]), { deps, dryRun: true });
    assert.strictEqual(r.results[0].status, 'ok');
    assert.strictEqual(r.results[0].dangerous, true);
    assert.ok(!calls.find((c) => c.name === 'click'));
  });

  // ── W9: 実行時入力/確認 後のフォーカス復帰（前面化タイミング）──
  const idxOf = (calls, name) => calls.findIndex((c) => c.name === name);
  await t('type は入力解決の後に前面化してから入力する', async () => {
    const { deps, calls } = makeDeps({});
    let inputResolved = -1, n = 0;
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', processName: 'np', isSecret: true, inputText: null }]),
      { deps, onRuntimeInput: async () => { inputResolved = n++; return 'pw'; } });
    assert.strictEqual(r.status, 'success');
    // activate は type の直前（=入力解決の後）に呼ばれる
    assert.ok(idxOf(calls, 'activate') < idxOf(calls, 'type'), 'activate は type より前');
    assert.deepStrictEqual(calls.find((c) => c.name === 'type').args, ['pw']);
  });

  await t('click は確認の後に前面化してから特定・クリックする', async () => {
    let confirmedAt = -1;
    const order = [];
    const { deps } = makeDeps({
      isDangerous: () => true,
      uiaFind: async () => ({ rect: { x: 0, y: 0, w: 10, h: 10 }, score: 1 }),
    });
    // matchByUia をデフォルト(null)から実物相当へ：uiaFind を使うため matcher を本物にしたいが、
    // ここではフェイク matcher の matchByUia を直接与える
    deps.matcher.matchByUia = async () => { order.push('locate'); return { x: 5, y: 5, confidence: 1, method: 'uia', reason: '' }; };
    deps.inputDriver.activate = async () => { order.push('activate'); return true; };
    deps.inputDriver.click = async () => { order.push('click'); };
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', processName: 'np', label: '削除' }]),
      { deps, onConfirm: async () => { order.push('confirm'); return true; } });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(order, ['confirm', 'activate', 'locate', 'click']);
  });

  // ── W9 修正: 前面化の確認とフェイルセーフ ──
  await t('前面化を確認できない type は入力せず activate_failed', async () => {
    const { deps, calls } = makeDeps({
      foreground: async () => ({ title: 'まったく別のアプリ', processName: 'other' }), // 対象でない
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', windowTitle: 'メモ帳', isSecret: true, inputText: null }]),
      { deps, onRuntimeInput: async () => 'secret' });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results[0].reason, 'activate_failed');
    assert.ok(!calls.find((c) => c.name === 'type'), '秘匿を誤ウィンドウへ入力してはいけない');
  });

  await t('前面化を確認できれば type する', async () => {
    const { deps, calls } = makeDeps({
      foreground: async () => ({ title: '無題 - メモ帳', processName: 'Notepad' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', windowTitle: 'メモ帳', inputText: 'hello' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(calls.find((c) => c.name === 'type').args, ['hello']);
  });

  await t('前面化は1発で通らなくてもリトライで成功', async () => {
    let n = 0;
    const { deps, calls } = makeDeps({
      foreground: async () => (++n >= 2 ? { title: 'メモ帳', processName: 'Notepad' } : { title: '別', processName: 'x' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', windowTitle: 'メモ帳', inputText: 'hi' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.ok(calls.filter((c) => c.name === 'activate').length >= 2, 'activateがリトライされる');
  });

  // ── W11: AI結果検証 ──
  await t('successCriteria + verify success → ok（verify記録）', async () => {
    let verifyCalled = false;
    const { deps } = makeDeps({
      aiConfigured: true,
      verifyResult: async () => { verifyCalled = true; return { status: 'success', reason: 'ok' }; },
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', inputText: 'x', successCriteria: '保存された' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.strictEqual(r.results[0].verify, 'success');
    assert.ok(verifyCalled);
  });

  await t('verify fail → step失敗(verification_failed)でフロー停止', async () => {
    const { deps } = makeDeps({
      aiConfigured: true,
      verifyResult: async () => ({ status: 'fail', reason: 'まだ保存されていない' }),
    });
    const r = await engine.run(flow([
      { stepNumber: 1, action: 'type', inputText: 'x', successCriteria: '保存された' },
      { stepNumber: 2, action: 'type', inputText: 'y' },
    ]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results[0].reason, 'verification_failed');
    assert.strictEqual(r.results.length, 1); // 後続は実行しない
  });

  await t('verify uncertain → 続行（誤停止しない）', async () => {
    const { deps } = makeDeps({
      aiConfigured: true,
      verifyResult: async () => ({ status: 'uncertain', reason: '判断できない' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', inputText: 'x', successCriteria: 'c' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.strictEqual(r.results[0].verify, 'uncertain');
  });

  await t('successCriteria なしなら検証しない', async () => {
    let called = false;
    const { deps } = makeDeps({ aiConfigured: true, verifyResult: async () => { called = true; return { status: 'fail' }; } });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', inputText: 'x' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.ok(!called, 'successCriteria無しでverifyを呼んではいけない');
  });

  await t('AI未設定なら検証スキップ', async () => {
    let called = false;
    const { deps } = makeDeps({ aiConfigured: false, verifyResult: async () => { called = true; return { status: 'fail' }; } });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', inputText: 'x', successCriteria: 'c' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.ok(!called);
  });

  await t('dryRun は検証しない', async () => {
    let called = false;
    const { deps } = makeDeps({ aiConfigured: true, verifyResult: async () => { called = true; return { status: 'fail' }; } });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'type', inputText: 'x', successCriteria: 'c' }]), { deps, dryRun: true });
    assert.ok(!called);
  });

  // ── W12: 自己修復 write-back ──
  await t('OCR特定の click は uiaInspect で healUia を返す', async () => {
    let inspectAt = null;
    const { deps } = makeDeps({
      matchByOcr: () => ({ x: 200, y: 120, confidence: 0.9, method: 'ocr', reason: 'ocr' }),
      uiaInspect: async (x, y) => { inspectAt = [x, y]; return { automationId: 'saveBtn', name: '保存', controlType: 'Button' }; },
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: '保存' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(inspectAt, [200, 120]);
    assert.deepStrictEqual(r.results[0].healUia, { automationId: 'saveBtn', name: '保存', controlType: 'Button', className: undefined });
    assert.strictEqual(r.results[0].stepIndex, 0);
  });

  await t('UIA特定の click は自己修復しない（healUiaなし）', async () => {
    let inspected = false;
    const { deps } = makeDeps({
      matchByUia: async () => ({ x: 1, y: 1, confidence: 1, method: 'uia', reason: '' }),
      uiaInspect: async () => { inspected = true; return { automationId: 'x' }; },
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click' }]), { deps });
    assert.ok(!r.results[0].healUia);
    assert.ok(!inspected, 'UIA特定時はuiaInspectを呼ばない');
  });

  await t('AI特定でも識別子が取れなければ healUia なし', async () => {
    const { deps } = makeDeps({
      aiConfigured: true,
      decideNextAction: async () => ({ action: 'click', x: 500, y: 250, confidence: 0.8, reason: 'ai' }),
      uiaInspect: async () => ({ name: '', automationId: '', controlType: '' }), // 識別子なし
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.ok(!r.results[0].healUia);
  });

  await t('dryRun は自己修復しない', async () => {
    let inspected = false;
    const { deps } = makeDeps({
      matchByOcr: () => ({ x: 1, y: 1, confidence: 0.9, method: 'ocr', reason: '' }),
      uiaInspect: async () => { inspected = true; return { automationId: 'x' }; },
    });
    await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps, dryRun: true });
    assert.ok(!inspected);
  });

  // ── W13: AI例外処理 ──
  await t('特定不能→AI復旧(click)→再特定で成功', async () => {
    let n = 0, recovered = false;
    const { deps, calls } = makeDeps({
      aiConfigured: true,
      matchByUia: async () => (++n >= 2 ? { x: 5, y: 6, confidence: 1, method: 'uia', reason: '' } : null),
      recoverFromObstacle: async () => { recovered = true; return { action: 'click', x: 500, y: 500, confidence: 0.9, reason: 'close dialog' }; },
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.ok(recovered, '復旧が呼ばれる');
    assert.strictEqual(calls.filter((c) => c.name === 'click').length, 2); // 復旧click + 本来click
  });

  await t('AI復旧がfail→target_not_found', async () => {
    const { deps } = makeDeps({
      aiConfigured: true,
      recoverFromObstacle: async () => ({ action: 'fail', confidence: 0, reason: 'none' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results[0].reason, 'target_not_found');
  });

  await t('復旧しても再特定できなければ失敗', async () => {
    const { deps } = makeDeps({
      aiConfigured: true,
      matchByUia: async () => null,
      recoverFromObstacle: async () => ({ action: 'key', text: 'esc', confidence: 0.8, reason: 'esc' }),
    });
    const r = await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.strictEqual(r.results[0].reason, 'target_not_found');
  });

  await t('AI未設定なら例外処理しない', async () => {
    let recovered = false;
    const { deps } = makeDeps({ aiConfigured: false, recoverFromObstacle: async () => { recovered = true; return { action: 'key', text: 'esc' }; } });
    await engine.run(flow([{ stepNumber: 1, action: 'click', label: 'x' }]), { deps });
    assert.ok(!recovered);
  });

  // ── launch ステップ（アプリ起動） ──
  await t('launch ステップは inputDriver.launch を呼ぶ', async () => {
    const { deps, calls } = makeDeps({});
    deps.inputDriver.launch = (...a) => { calls.push({ name: 'launch', args: a }); return Promise.resolve(); };
    const r = await engine.run(flow([{ stepNumber: 1, action: 'launch', launchTarget: 'notepad.exe', waitMs: 1 }]), { deps });
    assert.strictEqual(r.status, 'success');
    assert.deepStrictEqual(calls.find((c) => c.name === 'launch').args, ['notepad.exe']);
  });
  await t('launch ターゲット無しは失敗', async () => {
    const { deps } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'launch' }]), { deps });
    assert.strictEqual(r.status, 'failed');
    assert.strictEqual(r.results[0].reason, 'missing_launch_target');
  });
  await t('dryRun は実際に launch しない', async () => {
    let launched = false;
    const { deps } = makeDeps({});
    deps.inputDriver.launch = () => { launched = true; return Promise.resolve(); };
    await engine.run(flow([{ stepNumber: 1, action: 'launch', launchTarget: 'notepad.exe' }]), { deps, dryRun: true });
    assert.ok(!launched);
  });

  // ── W14: 実行レポート計時 ──
  await t('結果に計時(startedAt/finishedAt/durationMs)が付く', async () => {
    const { deps } = makeDeps({});
    const r = await engine.run(flow([{ stepNumber: 1, action: 'wait', waitMs: 1 }]), { deps });
    assert.strictEqual(typeof r.startedAt, 'number');
    assert.strictEqual(typeof r.finishedAt, 'number');
    assert.ok(r.durationMs >= 0);
  });

  console.log(`\n${pass} passed`);
})();
