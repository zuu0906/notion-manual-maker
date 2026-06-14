// dev-test-worker.js — input-worker.ps1 / input-driver.js の手動検証用（開発専用）
//
// 使い方（プロジェクトの desktop/ で PowerShell から実行）:
//   node main/automation/dev-test-worker.js          … 読み取りのみ（安全）
//   node main/automation/dev-test-worker.js --type    … メモ帳を開いて文字入力（実際に操作）
//   node main/automation/dev-test-worker.js --uia X Y  … 画面座標(X,Y)のUIA要素を表示
//
// 本番には不要。動作確認後は削除して構わない。

const drv = require('./input-driver');

const args = process.argv.slice(2);
const wantType = args.includes('--type');
const uiaIdx = args.indexOf('--uia');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    console.log('init worker...');
    await drv.init();
    console.log('  ready:', drv.isReady());

    console.log('ping...');
    console.log('  ', JSON.stringify(await drv.ping()));

    console.log('foreground window...');
    console.log('  ', JSON.stringify(await drv.foreground()));

    if (uiaIdx >= 0) {
      const x = Number(args[uiaIdx + 1]); const y = Number(args[uiaIdx + 2]);
      console.log(`uiaInspect(${x}, ${y})...`);
      console.log('  ', JSON.stringify(await drv.uiaInspect(x, y), null, 2));
    } else {
      console.log('uiaInspect at (100,100)...');
      console.log('  ', JSON.stringify(await drv.uiaInspect(100, 100)));
    }

    if (wantType) {
      console.log('launch notepad...');
      await drv.launch('notepad.exe');
      await sleep(1500);

      // メモ帳を確実に前面化してからtypeする（launch直後はフォアグラウンド奪取防止で
      // 裏に開くため、activateしないと入力が他アプリへ漏れる）。
      console.log('activate notepad (processName=notepad)...');
      let activated = false;
      for (let i = 0; i < 3 && !activated; i++) {
        activated = await drv.activate({ processName: 'notepad' });
        if (!activated) await sleep(700);
      }
      console.log('  activated:', activated);
      await sleep(400);

      const fg = await drv.foreground();
      console.log('  foreground now:', JSON.stringify(fg));
      const onNotepad = /notepad/i.test(fg.processName || '');
      if (!onNotepad) {
        console.error('  ⚠️ メモ帳が前面になっていません。入力が他アプリへ漏れるため type をスキップします。');
        console.error('     → メモ帳を手動で前面にして再実行するか、activateの不調を調査してください。');
      } else {
        console.log('typing (IME非依存・日本語含む)...');
        await drv.type('自動入力テスト OK 12345\n');
        await sleep(300);
        await drv.key('enter');
        await drv.type('SendInput works.');
        console.log('  done — メモ帳に文字が入っていれば成功（保存せず閉じてください）');
      }
    }

    await drv.dispose();
    console.log('DONE');
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    try { await drv.dispose(); } catch {}
    process.exit(1);
  }
})();
