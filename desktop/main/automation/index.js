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
let editorWindows = new Map(); // flowId -> BrowserWindow
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

// W7: フロー編集ウィンドウ（flowId ごとに1枚）
function createEditorWindow(flowId) {
  const existing = editorWindows.get(flowId);
  if (existing && !existing.isDestroyed()) { existing.show(); existing.focus(); return existing; }

  const win = new BrowserWindow({
    width: 680,
    height: 760,
    minWidth: 520,
    minHeight: 520,
    title: 'フローを編集',
    icon: path.join(__dirname, '..', '..', 'icon128.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'automation-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'automation-editor.html'));
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('automation:editor-init', { flowId });
  });
  win.on('closed', () => { editorWindows.delete(flowId); });
  editorWindows.set(flowId, win);
  return win;
}

// 編集後に一覧ウィンドウへ再読込を促す
function notifyFlowsChanged() {
  if (automationWindow && !automationWindow.isDestroyed()) {
    automationWindow.webContents.send('automation:flows-changed');
  }
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

    // W9: 実行中に確認/入力を管理ウィンドウへ尋ね、応答をワンショットIPCで待つ
    const ask = (kind, payload) => new Promise((resolve) => {
      if (!automationWindow || automationWindow.isDestroyed()) return resolve(null);
      const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      ipcMain.once(`automation:prompt-reply:${reqId}`, (_e, val) => resolve(val));
      try { automationWindow.show(); automationWindow.focus(); } catch {}
      automationWindow.webContents.send('automation:prompt', { reqId, kind, ...payload });
    });
    const onConfirm = ({ message, danger }) => ask('confirm', { message, danger });
    const onRuntimeInput = (step) =>
      ask('input', { label: step.label || '', isSecret: !!step.isSecret, message: step.promptMessage || '' })
        .then((v) => (v == null ? null : String(v)));

    let aborted = false;
    try {
      await inputDriver.init();
      hud.show();
      onProgress({ phase: 'starting' });
      safety.registerEmergencyStop(() => { aborted = true; onProgress({ phase: 'aborted' }); });
      const result = await replayEngine.run(flow, {
        mode: mode || 'supervised',
        onProgress,
        shouldAbort: () => aborted,
        onConfirm,
        onRuntimeInput,
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

  // ── W8: ドライラン（特定のみ・クリック/入力しない）────────────────────────
  ipcMain.handle('automation:dry-run-flow', async (_e, id) => {
    const flow = flowStore.getFlow(id);
    if (!flow) return { ok: false, error: 'flow_not_found' };
    try {
      await inputDriver.init();
      const result = await replayEngine.run(flow, { mode: 'supervised', dryRun: true });
      return { ok: true, result };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      await inputDriver.dispose().catch(() => {});
    }
  });

  // ── W7: フロー編集 ─────────────────────────────────────────────────────────
  ipcMain.handle('automation:open-editor', (_e, id) => {
    if (!flowStore.getFlow(id)) return { ok: false, error: 'flow_not_found' };
    createEditorWindow(id);
    return { ok: true };
  });

  ipcMain.handle('automation:rename-flow', (_e, { id, name }) => {
    try { flowStore.renameFlow(id, name); notifyFlowsChanged(); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('automation:update-step', (_e, { id, index, patch }) => {
    try { flowStore.updateStep(id, index, patch); notifyFlowsChanged(); return { ok: true, flow: flowStore.getFlow(id) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('automation:apply-ops', (_e, { id, ops }) => {
    try { flowStore.applyOps(id, ops); notifyFlowsChanged(); return { ok: true, flow: flowStore.getFlow(id) }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('automation:restore-flow', (_e, id) => {
    try { const ok = flowStore.restore(id); notifyFlowsChanged(); return { ok, flow: ok ? flowStore.getFlow(id) : null }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  // ステップのスクショを dataUrl で返す（編集UIプレビュー用・renderer は fs 不可のため）
  ipcMain.handle('automation:get-step-image', (_e, { id, file }) => {
    try {
      if (!file) return { ok: true, dataUrl: null };
      const p = flowStore.screenshotPath(id, file);
      const b64 = require('fs').readFileSync(p).toString('base64');
      return { ok: true, dataUrl: `data:image/png;base64,${b64}` };
    } catch (e) { return { ok: false, error: e.message }; }
  });
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
