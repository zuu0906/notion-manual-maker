// recorder.test.js — 記録の純関数＋オーケストレーションの node 単体テスト（W15）
// 実行: node main/automation/recorder.test.js

const assert = require('assert');
const recorder = require('./recorder');
const { detectSecret, buildClickStep, buildTypeStep, pickUia } = recorder._internals;

let pass = 0;
function t(name, fn) {
  try {
    const r = fn();
    if (r && r.then) return r.then(() => { pass++; console.log('  ok  -', name); })
      .catch((e) => { console.error('FAIL -', name, '\n     ', e.stack || e.message); process.exitCode = 1; });
    pass++; console.log('  ok  -', name);
  } catch (e) { console.error('FAIL -', name, '\n     ', e.message); process.exitCode = 1; }
}

// ── 秘匿4段 ──
t('Tier1: UIA IsPassword 最優先', () => {
  assert.deepStrictEqual(detectSecret({ isPassword: true, name: 'x' }), { secret: true, tier: 1 });
});
t('Tier2: name/automationId キーワード', () => {
  assert.strictEqual(detectSecret({ name: 'パスワード' }).tier, 2);
  assert.strictEqual(detectSecret({ automationId: 'PasswordBox' }).tier, 2);
  assert.strictEqual(detectSecret({ name: '暗証番号' }).tier, 2);
  assert.strictEqual(detectSecret({ automationId: 'pin' }).tier, 2);
});
t('Tier3: value がマスク文字', () => {
  assert.deepStrictEqual(detectSecret({ value: '●●●●●' }), { secret: true, tier: 3 });
  assert.deepStrictEqual(detectSecret({ value: '****' }), { secret: true, tier: 3 });
});
t('Tier4: 通常フィールドは非秘匿', () => {
  assert.deepStrictEqual(detectSecret({ name: 'メールアドレス', value: 'a@b.com' }), { secret: false, tier: 4 });
});
t('null は tier0 非秘匿', () => {
  assert.deepStrictEqual(detectSecret(null), { secret: false, tier: 0 });
});

// ── pickUia ──
t('pickUia は識別子を残し空は落とす', () => {
  assert.deepStrictEqual(pickUia({ automationId: 'a', name: '', controlType: 'Button', className: '' }),
    { automationId: 'a', controlType: 'Button' });
  assert.strictEqual(pickUia({ name: '' }), undefined);
  assert.strictEqual(pickUia(null), undefined);
});

// ── buildClickStep ──
t('buildClickStep: 物理px・UIA・スクショ・ラベル', () => {
  const s = buildClickStep({
    stepNumber: 1, x: 100, y: 50, button: 'left',
    fg: { title: 'メモ帳', processName: 'Notepad' },
    uia: { name: '保存', controlType: 'Button', automationId: 'saveBtn', isPassword: false },
    shot: { dataUrl: 'data:image/png;base64,AA', width: 1920, height: 1080 },
  });
  assert.strictEqual(s.action, 'click');
  assert.strictEqual(s.x, 100); assert.strictEqual(s.y, 50);
  assert.strictEqual(s.windowTitle, 'メモ帳');
  assert.strictEqual(s.viewportWidth, 1920);
  assert.strictEqual(s.label, '保存');
  assert.deepStrictEqual(s.uia, { automationId: 'saveBtn', name: '保存', controlType: 'Button' });
  assert.strictEqual(s.screenshotDataUrl, 'data:image/png;base64,AA');
  assert.ok(!('button' in s)); // left は省略
});
t('buildClickStep: 右クリックは button:right', () => {
  const s = buildClickStep({ stepNumber: 1, x: 1, y: 1, button: 'right', fg: null, uia: null, shot: null });
  assert.strictEqual(s.button, 'right');
  assert.strictEqual(s.label, 'クリック'); // 情報なしの既定
});

// ── buildTypeStep ──
t('buildTypeStep: 通常は値を保存', () => {
  const s = buildTypeStep({ stepNumber: 2, focused: { name: '氏名', value: '山田太郎', controlType: 'Edit' }, fg: { title: 'フォーム' } });
  assert.strictEqual(s.action, 'type');
  assert.strictEqual(s.inputText, '山田太郎');
  assert.ok(!s.isSecret);
  assert.ok(s.label.includes('山田太郎'));
});
t('🔑 buildTypeStep: 秘匿は値を保存しない(inputText=null)', () => {
  const s = buildTypeStep({ stepNumber: 2, focused: { isPassword: true, value: 'p@ssw0rd', controlType: 'Edit' }, fg: null });
  assert.strictEqual(s.isSecret, true);
  assert.strictEqual(s.inputText, null);
  assert.ok(!s.label.includes('p@ssw0rd'));
});

// ── オーケストレーション（fake uiohook）──
function fakeHook() {
  const map = {};
  return {
    on: (ev, fn) => { (map[ev] = map[ev] || []).push(fn); },
    off: (ev, fn) => { map[ev] = (map[ev] || []).filter((f) => f !== fn); },
    start: () => {}, stop: () => {},
    emit: (ev, e) => (map[ev] || []).forEach((f) => f(e)),
  };
}
function fakeDeps(hook, saved) {
  return {
    uiohook: hook,
    inputDriver: {
      init: async () => {},
      foreground: async () => ({ title: '電卓', processName: 'Calc' }),
      procNames: async () => ['calc', 'explorer'], // 電卓は起動前から動作中扱い
      uiaInspect: async () => ({ name: '7', controlType: 'Button', automationId: 'num7Button' }),
      uiaFocused: async () => ({ name: '氏名', controlType: 'Edit', value: 'abc' }),
    },
    screenReader: { capture: async () => ({ dataUrl: 'data:image/png;base64,AA', width: 800, height: 600 }) },
    flowStore: { saveFlow: (f) => { saved.flow = f; return 'flow-id-1'; } },
  };
}

// recorder はモジュール単一stateなので、オーケストレーション系は逐次実行する
async function ta(name, fn) {
  try { await fn(); pass++; console.log('  ok  -', name); }
  catch (e) { console.error('FAIL -', name, '\n     ', e.stack || e.message); process.exitCode = 1; }
}

(async () => {
  await ta('記録: クリック→保存で click step 1件', async () => {
    const hook = fakeHook(); const saved = {};
    const r = await recorder.start({ deps: fakeDeps(hook, saved), name: 'テスト記録' });
    assert.strictEqual(r.ok, true);
    hook.emit('mousedown', { x: 10, y: 20, button: 1 });
    const res = await recorder.stop();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.stepCount, 1);
    assert.strictEqual(saved.flow.steps[0].action, 'click');
    assert.strictEqual(saved.flow.steps[0].x, 10);
    assert.strictEqual(saved.flow.steps[0].uia.automationId, 'num7Button');
    assert.strictEqual(saved.flow.name, 'テスト記録');
  });

  await ta('記録: ステップ0件なら保存しない', async () => {
    const hook = fakeHook(); const saved = {};
    await recorder.start({ deps: fakeDeps(hook, saved) });
    const res = await recorder.stop();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'no_steps');
    assert.ok(!saved.flow);
  });

  await ta('シェル系(Start/検索)のクリックは記録しない', async () => {
    const hook = fakeHook(); const saved = {};
    const deps = fakeDeps(hook, saved);
    deps.inputDriver.foreground = async () => ({ title: 'スタート', processName: 'StartMenuExperienceHost' });
    await recorder.start({ deps, name: 'shell' });
    hook.emit('mousedown', { x: 5, y: 5, button: 1 });   // スタートメニュー → 無視
    const res = await recorder.stop();
    assert.strictEqual(res.ok, false);      // 有効ステップ0
    assert.strictEqual(res.error, 'no_steps');
  });

  await ta('記録中に起動した新規アプリは launch ステップを自動挿入', async () => {
    const hook = fakeHook(); const saved = {};
    const deps = fakeDeps(hook, saved);
    // 記録前は calc/explorer のみ。Notepad は記録中に起動された新規アプリ。
    deps.inputDriver.foreground = async () => ({ title: 'メモ帳', processName: 'Notepad', path: 'C:\\Windows\\System32\\notepad.exe' });
    await recorder.start({ deps, name: 'launch-auto' });
    hook.emit('mousedown', { x: 100, y: 200, button: 1 });
    const res = await recorder.stop();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.stepCount, 2);
    assert.strictEqual(saved.flow.steps[0].action, 'launch');
    assert.strictEqual(saved.flow.steps[0].launchTarget, 'C:\\Windows\\System32\\notepad.exe');
    assert.strictEqual(saved.flow.steps[1].action, 'click');
  });

  await ta('Storeアプリ(WindowsApps)パスは processName.exe にフォールバック', async () => {
    const hook = fakeHook(); const saved = {};
    const deps = fakeDeps(hook, saved);
    deps.inputDriver.foreground = async () => ({ title: 'メモ帳', processName: 'Notepad',
      path: 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsNotepad_11.2604.5.0_x64__8wekyb3d8bbwe\\Notepad\\Notepad.exe' });
    await recorder.start({ deps, name: 'store' });
    hook.emit('mousedown', { x: 1, y: 1, button: 1 });
    const res = await recorder.stop();
    assert.strictEqual(saved.flow.steps[0].action, 'launch');
    assert.strictEqual(saved.flow.steps[0].launchTarget, 'Notepad.exe');
  });

  await ta('起動前から動いていたアプリは launch を入れない', async () => {
    const hook = fakeHook(); const saved = {};
    const deps = fakeDeps(hook, saved); // foreground=Calc, procNames に calc あり
    await recorder.start({ deps, name: 'already' });
    hook.emit('mousedown', { x: 1, y: 1, button: 1 });
    hook.emit('mousedown', { x: 2, y: 2, button: 1 });
    const res = await recorder.stop();
    assert.strictEqual(res.stepCount, 2); // click x2 のみ、launch なし
    assert.ok(!saved.flow.steps.some((s) => s.action === 'launch'));
  });

  await ta('launch はアプリごとに1回だけ挿入', async () => {
    const hook = fakeHook(); const saved = {};
    const deps = fakeDeps(hook, saved);
    deps.inputDriver.foreground = async () => ({ title: 'メモ帳', processName: 'Notepad', path: 'notepad.exe' });
    await recorder.start({ deps, name: 'once' });
    hook.emit('mousedown', { x: 1, y: 1, button: 1 });
    hook.emit('mousedown', { x: 2, y: 2, button: 1 });
    const res = await recorder.stop();
    assert.strictEqual(saved.flow.steps.filter((s) => s.action === 'launch').length, 1);
    assert.strictEqual(res.stepCount, 3); // launch + click x2
  });

  await ta('タスクバー(Shell_TrayWnd)のクリックは記録しない', async () => {
    const hook = fakeHook(); const saved = {};
    const deps = fakeDeps(hook, saved);
    deps.inputDriver.foreground = async () => ({ title: 'メモ帳', processName: 'Notepad' }); // proc は正当
    deps.inputDriver.uiaInspect = async () => ({ controlType: 'Pane', className: 'Shell_TrayWnd' }); // でもタスクバー
    await recorder.start({ deps, name: 'tray' });
    hook.emit('mousedown', { x: 1294, y: 1060, button: 1 });
    const res = await recorder.stop();
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.error, 'no_steps');
  });

  await ta('二重 start は弾く', async () => {
    const hook = fakeHook(); const saved = {};
    await recorder.start({ deps: fakeDeps(hook, saved) });
    const r2 = await recorder.start({ deps: fakeDeps(hook, saved) });
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(r2.error, 'already_recording');
    await recorder.stop();
  });

  console.log(`\n${pass} passed`);
})();
