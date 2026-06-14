// hud.js — 実行中HUDオーバーレイのウィンドウ管理（W6）
//
// フロー実行中だけ、画面下中央に小さな常時最前面オーバーレイを出す。
// 「今どのステップを実行しているか」「Escで止められる」ことを在席ユーザーに伝えるのが目的。
//
// 【設計】
//  - frameless + transparent + alwaysOnTop('screen-saver') + skipTaskbar。
//  - クリックスルー（setIgnoreMouseEvents true,{forward:true}）＝下のアプリ操作を一切邪魔しない。
//    停止は既存の safety.registerEmergencyStop（Esc）に委ねるため、HUD自体はボタンを持たない情報表示専用。
//  - focusable:false＝対象アプリのフォーカスを奪わない（SendInput先がズレない）。
//  - 座標は overlay と同じく primary display の論理座標で配置（HUDは情報表示のみで物理px規約の対象外）。
//
// hud-format.js（純関数）でテキストを整形し、renderer/run-overlay.js が描画する。

const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { formatProgress } = require('./hud-format');

const HUD_WIDTH = 380;
const HUD_HEIGHT = 96;
const MARGIN_BOTTOM = 64; // タスクバー等を避けて画面下から少し浮かせる

let hudWindow = null;
let pendingUpdate = null; // ロード完了前に来た update を保持

function isAlive() {
  return hudWindow && !hudWindow.isDestroyed();
}

/** HUD を表示（既出なら再利用）。flow 実行開始時に index.js から呼ぶ。 */
function show() {
  if (isAlive()) {
    hudWindow.showInactive();
    return hudWindow;
  }

  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  const winX = Math.round(x + (width - HUD_WIDTH) / 2);
  const winY = Math.round(y + height - HUD_HEIGHT - MARGIN_BOTTOM);

  hudWindow = new BrowserWindow({
    x: winX,
    y: winY,
    width: HUD_WIDTH,
    height: HUD_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,           // 対象アプリのフォーカスを奪わない
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'run-overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  hudWindow.setAlwaysOnTop(true, 'screen-saver');
  hudWindow.setIgnoreMouseEvents(true, { forward: true }); // クリックスルー
  hudWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'run-overlay.html'));

  hudWindow.webContents.once('did-finish-load', () => {
    if (!isAlive()) return;
    hudWindow.showInactive(); // フォーカスを与えずに表示
    if (pendingUpdate) {
      hudWindow.webContents.send('hud:update', pendingUpdate);
      pendingUpdate = null;
    }
  });

  hudWindow.on('closed', () => { hudWindow = null; });
  return hudWindow;
}

/**
 * 進捗を HUD に反映。onProgress のペイロードをそのまま渡せる。
 * @param {{stepNumber?:number,total?:number,phase?:string,label?:string,error?:string}} p
 */
function update(p) {
  const view = formatProgress(p);
  if (!isAlive()) { pendingUpdate = view; return; }
  if (hudWindow.webContents.isLoading()) { pendingUpdate = view; return; }
  hudWindow.webContents.send('hud:update', view);
}

/** HUD を閉じる。flow 実行終了/中断時に呼ぶ。 */
function hide() {
  pendingUpdate = null;
  if (isAlive()) hudWindow.close();
  hudWindow = null;
}

module.exports = { show, update, hide, isAlive };
