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
const hud = require('./hud');

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

    const total = Array.isArray(flow.steps) ? flow.steps.length : 0;
    const send = (channel, payload) => {
      if (automationWindow && !automationWindow.isDestroyed()) {
        automationWindow.webContents.send(channel, payload);
      }
    };
    // 進捗を管理ウィンドウと実行中HUDの両方へ流す
    const onProgress = (p) => {
      const payload = { total, ...p };
      send('automation:run-progress', payload);
      hud.update(payload);
    };

    try {
      await inputDriver.init();
      hud.show();
      onProgress({ phase: 'starting' });
      safety.registerEmergencyStop(() => onProgress({ phase: 'aborted' }));
      const result = await replayEngine.run(flow, {
        mode: mode || 'supervised',
        onProgress,
      });
      // 終端フェーズを HUD に反映してから少し見せて閉じる
      hud.update({ total, phase: (result && result.status) || 'done' });
      return { ok: true, result };
    } catch (e) {
      hud.update({ total, phase: 'failed', error: e.message });
      return { ok: false, error: e.message };
    } finally {
      safety.unregisterEmergencyStop();
      await inputDriver.dispose().catch(() => {});
      // 終端メッセージを一瞬見せてから HUD を閉じる
      setTimeout(() => hud.hide(), 1400);
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
