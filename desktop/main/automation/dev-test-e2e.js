// dev-test-e2e.js — Phase 1 通し検証（電卓 7+3=10）。開発専用・要対話的デスクトップ。
//
// 使い方（desktop/ で実行）:
//   node main/automation/dev-test-e2e.js
//
// 実 replay-engine ＋ 実 input-driver(SendInput) ＋ 実 UIA を通す。
// desktopCapturer(OCR/AIの土台)は Electron 専用のため node では使えないので、
// 本E2Eは UIA 経路だけで完結する電卓を対象にする（UIA特定の実証が主目的）。
// OCR/AIフォールバックの実画像検証は Electron 起動(npm start)時に別途行う。
//
// ⚠️ 実行中は実マウス/キーボードを一時的に占有する。

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// .env.local ロード（GEMINI等。今回のUIA経路では未使用だが揃える）
(function loadEnv() {
  try {
    fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8')
      .split(/\r?\n/).forEach((l) => {
        const m = l.trim().match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      });
  } catch {}
})();

const driver = require('./input-driver');
const engine = require('./replay-engine');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CalculatorResults を UIA で読む（言語非依存の AutomationId 指定・-EncodedCommandで安全に渡す）
function readCalcResult() {
  const ps = [
    'Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes',
    '$root=[System.Windows.Automation.AutomationElement]::RootElement',
    "$c=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'CalculatorResults')",
    '$el=$root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$c)',
    "if($el){[Console]::Out.WriteLine($el.Current.Name)}else{[Console]::Out.WriteLine('NOTFOUND')}",
  ].join('\n');
  const enc = Buffer.from(ps, 'utf16le').toString('base64');
  return new Promise((res) => {
    execFile('powershell', ['-NoProfile', '-Sta', '-EncodedCommand', enc],
      { timeout: 15000, windowsHide: true },
      (e, out) => res(String(out || '').trim()));
  });
}

const mk = (n, automationId, label) =>
  ({ stepNumber: n, action: 'click', windowTitle: '電卓', uia: { automationId }, label });

(async () => {
  try {
    console.log('init input-driver...');
    await driver.init();
    console.log('  ready:', driver.isReady());

    console.log('launch calculator (calc.exe)...');
    await driver.launch('calc.exe');
    await sleep(2800); // UWP コールドスタート待ち

    // 前面化（電卓 or Calculator）。失敗ならブラインドクリックを避けて中止。
    let fgOk = false;
    for (let i = 0; i < 6 && !fgOk; i++) {
      await driver.activate({ titleSubstr: '電卓' }).catch(() => {});
      await driver.activate({ titleSubstr: 'Calculator' }).catch(() => {});
      await sleep(500);
      const fg = await driver.foreground();
      console.log(`  fg[${i}]:`, fg.title, '/', fg.processName);
      fgOk = /電卓|calculator/i.test(`${fg.title} ${fg.processName}`);
    }
    if (!fgOk) {
      console.error('❌ 電卓を前面化できませんでした。誤クリック回避のため中止します。');
      await driver.dispose(); process.exit(1);
    }

    const flow = {
      id: 'e2e-calc', name: 'E2E 7+3=10',
      steps: [
        mk(1, 'num7Button', '7'),
        mk(2, 'plusButton', '+'),
        mk(3, 'num3Button', '3'),
        mk(4, 'equalButton', '='),
      ],
    };

    console.log('\nrun replay-engine (unattended, UIA経路)...');
    const r = await engine.run(flow, {
      mode: 'unattended',
      onProgress: (p) => console.log('  progress:', JSON.stringify(p)),
    });
    console.log('\nengine result:', JSON.stringify(r, null, 2));

    await sleep(600);
    const disp = await readCalcResult();
    console.log('calc display (UIA):', disp);

    await driver.dispose();

    const mathOk = /(^|\D)10(\D|$)/.test(disp);
    if (r.status === 'success' && mathOk) {
      console.log('\n✅ E2E PASS — 7+3=10 を UIA特定→SendInputクリックで達成');
      process.exit(0);
    } else {
      console.log('\n⚠️ E2E 要確認 — status=' + r.status + ' display=' + disp);
      process.exit(2);
    }
  } catch (e) {
    console.error('ERROR:', e.stack || e.message);
    try { await driver.dispose(); } catch {}
    process.exit(1);
  }
})();
