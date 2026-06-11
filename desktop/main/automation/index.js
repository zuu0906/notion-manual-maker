// index.js — automation 機能のエントリ（W1）
//
// main.js から AUTOMATION_ENABLED=1 のときだけ require/init される。
// フラグ未設定なら main.js は require すらしないため、本番ビルドに混入しても完全無効。
//
// 役割:
//   - 自動実行管理ウィンドウ（automation.html）の生成
//   - フロー一覧/取得/削除/実行の IPC をレンダラーへ提供
//   - 実行は replay-engine に委譲（W5まではスタブが engine_not_ready を返す）

const path = require('path');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');

const flowStore = require('./flow-store');
const replayEngine = require('./replay-engine');
const inputDriver = require('./input-driver');
const safety = require('./safety');

let automationWindow = null;
let _ctx = null; // { getMainWindow, store }

function createAutomationWindow() {
  if (automationWindow && !automationWindow.isDestroyed()) {
    automationWindow.show();
    automationWindow.focus();
    return automationWindow;
  }
  automationWindow = new BrowserWindow({
    width: 520,
    height: 640,
    minWidth: 420,
    minHeight: 480,
    title: '自動実行（β）',
    icon: path.join(__dirname, '..', '..', 'icon128.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'automation-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  automationWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'automation.html'));
  automationWindow.on('closed', () => { automationWindow = null; });
  return automationWindow;
}

function registerIpc() {
  ipcMain.handle('automation:list-flows', () => {
    try { return { ok: true, flows: flowStore.listFlows() }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('automation:get-flow', (_e, id) => {
    try { return { ok: true, flow: flowStore.getFlow(id) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('automation:delete-flow', (_e, id) => {
    try { flowStore.deleteFlow(id); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  // 実行（W5まではスタブが engine_not_ready を返す）
  ipcMain.handle('automation:run-flow', async (_e, { id, mode }) => {
    const flow = flowStore.getFlow(id);
    if (!flow) return { ok: false, error: 'flow_not_found' };

    const send = (channel, payload) => {
      if (automationWindow && !automationWindow.isDestroyed()) {
        automationWindow.webContents.send(channel, payload);
      }
    };

    try {
      await inputDriver.init();
      safety.registerEmergencyStop(() => send('automation:run-progress', { phase: 'aborted' }));
      const result = await replayEngine.run(flow, {
        mode: mode || 'supervised',
        onProgress: (p) => send('automation:run-progress', p),
      });
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      safety.unregisterEmergencyStop();
      await inputDriver.dispose().catch(() => {});
    }
  });

  ipcMain.handle('automation:open-window', () => { createAutomationWindow(); return { ok: true }; });
}

/**
 * main.js から呼ばれる初期化。
 * @param {{getMainWindow:Function, store:object}} ctx
 */
function init(ctx) {
  _ctx = ctx;
  flowStore.init(app.getPath('userData'));
  registerIpc();
  console.log('[automation] enabled (AUTOMATION_ENABLED=1)');
}

/** トレイメニューへ差し込む項目（main.js の createTray から利用） */
function trayMenuItem() {
  return { label: '自動実行（β）', click: () => createAutomationWindow() };
}

module.exports = { init, createAutomationWindow, trayMenuItem };
