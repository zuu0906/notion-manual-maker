try { const _fs = require('fs'), _p = require('path'); const _load = f => { try { _fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(l => { const m = l.trim().match(/^([A-Z_][A-Z0-9_]*)=(.+)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }); } catch {} }; _load(_p.join(__dirname, '..', '.env.local')); if (process.resourcesPath) _load(_p.join(process.resourcesPath, '.env.local')); } catch {}

const {
  app, BrowserWindow, globalShortcut, Tray, Menu,
  ipcMain, nativeImage, shell, screen, desktopCapturer,
} = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const authGoogle = require('./auth-google');
const authNotion = require('./auth-notion');
const notion = require('./notion');
const { detectPiiAndWords, cleanupTempFiles } = require('./ocr-detector');
const { autoUpdater } = require('electron-updater');

// ── Single instance lock ───────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on('second-instance', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

// ── In-memory state ────────────────────────────────────────────────────────
let steps = [];
let pendingOcrWords = []; // OCR words for the current pending screenshot
let recordingStartAt = null; // Timestamp when first step was added

// ── Window refs ────────────────────────────────────────────────────────────
let mainWindow = null;
let overlayWindow = null;
let tray = null;

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();
  createTray();
  registerHotkeys();
  cleanupTempFiles();
  // アップデートチェック（起動から5秒後）
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.warn('[autoUpdater] check failed:', err.message);
    });
  }, 5000);
});

// ── Auto-updater events ────────────────────────────────────────────────────
autoUpdater.on('update-available', (info) => {
  console.log('[autoUpdater] update available:', info.version);
  sendToRenderer('app:update-available', { version: info.version });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[autoUpdater] update downloaded:', info.version);
  sendToRenderer('app:update-downloaded', { version: info.version });
  if (tray && process.platform === 'win32') {
    const isJa = app.getLocale().startsWith('ja');
    tray.displayBalloon({
      title: 'Notion Manual Maker',
      content: isJa
        ? `アップデート v${info.version} の準備ができました。次回起動時に適用されます。`
        : `Update v${info.version} is ready and will be applied on next launch.`,
      iconType: 'info',
    });
  }
});

autoUpdater.on('error', (err) => {
  console.warn('[autoUpdater] error:', err.message);
});

app.on('window-all-closed', (e) => {
  // Keep running in the system tray on all platforms
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ── Main window ────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    minWidth: 340,
    minHeight: 480,
    resizable: true,
    frame: true,
    title: 'Notion Manual Maker',
    icon: path.join(__dirname, '..', 'icon128.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'popup.html'));

  // Auto-approve getDisplayMedia (used by captureScreen in preload) — no OS dialog shown
  mainWindow.webContents.session.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0] });
    }).catch(() => callback({}));
  });

  // Hide instead of close — keeps running in tray
  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
    // 初回のみ「トレイで動作中」を通知（終了したと誤解されるのを防ぐ）
    if (!store.get('tray_hint_shown', false) && tray && process.platform === 'win32') {
      store.set('tray_hint_shown', true);
      const isJa = app.getLocale().startsWith('ja');
      tray.displayBalloon({
        title: 'Notion Manual Maker',
        content: isJa
          ? 'システムトレイで動作中です。トレイアイコンをクリックすると再表示できます。'
          : 'Still running in the system tray. Click the tray icon to reopen.',
        iconType: 'info',
      });
    }
  });
}

// ── System tray ────────────────────────────────────────────────────────────
// Minimal 16×16 red-circle PNG (base64) — used as fallback tray icon
const FALLBACK_TRAY_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAa0lEQVQ4T2NkIAIwEqGGgXoG/v//z8DAQI+hAWqAIVQ9VgPwGoChAWqAJVQ9VgPwGoChAWqAJVQ9VgPwGoChAWqAJVQ9Vh' +
  'PwGoChAWqAJVQ9VgPwGoChAWqAJVQ9VgPwGoChAWqAJQAAAABJRU5ErkJggg==';

function createTray() {
  const iconPath = path.join(__dirname, '..', 'icon16.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
    icon = icon.resize({ width: 16, height: 16 });
  } catch {
    try {
      // Embed a minimal icon so the tray works without an asset file
      icon = nativeImage.createFromDataURL(`data:image/png;base64,${FALLBACK_TRAY_B64}`);
    } catch {
      icon = nativeImage.createEmpty();
    }
  }

  try {
    tray = new Tray(icon);
  } catch (e) {
    console.warn('[tray] could not create tray:', e.message);
    return; // Tray is optional; app works without it
  }
  tray.setToolTip('Notion Manual Maker');

  const showMainWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
  };
  const menu = Menu.buildFromTemplate([
    { label: 'Notion Manual Maker を開く', click: showMainWindow },
    { type: 'separator' },
    { label: 'スクリーンショット撮影 (Ctrl+Shift+M)', click: () => takeScreenshot() },
    { type: 'separator' },
    { label: '終了', click: () => { tray.destroy(); app.exit(0); } },
  ]);
  tray.setContextMenu(menu);

  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Global hotkey ──────────────────────────────────────────────────────────
function registerHotkeys() {
  const ok = globalShortcut.register('CommandOrControl+Shift+M', () => {
    takeScreenshot();
  });
  if (!ok) {
    console.warn('[hotkey] Ctrl+Shift+M could not be registered');
    // 他アプリがホットキーを占有している場合、ユーザーに通知（アプリ内ボタンは使用可能）
    if (tray) {
      tray.displayBalloon({
        title: 'Notion Manual Maker',
        content: 'ホットキー Ctrl+Shift+M を登録できませんでした（他のアプリが使用中）。アプリ内の撮影ボタンをご利用ください。',
      });
    }
  }
}

// ── Screenshot capture ─────────────────────────────────────────────────────
// desktopCapturer is renderer-only (Electron 17+), so we ask the popup
// renderer to take the screenshot via preload, then receive the result here.
// 連続キャプチャ（ホットキー連打）で _pendingScreenshot が競合しないようガード
let _captureInProgress = false;
let _captureGuardTimer = null;

function setCaptureInProgress(value) {
  _captureInProgress = value;
  clearTimeout(_captureGuardTimer);
  if (value) {
    // 保険: レンダラーが応答しない場合でも10秒でロック解除
    _captureGuardTimer = setTimeout(() => { _captureInProgress = false; }, 10000);
  }
}

function takeScreenshot() {
  if (_captureInProgress) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    setCaptureInProgress(true);
    mainWindow.webContents.send('capture:trigger', {});
  }
}

// Renderer confirms screenshot is ready — use cached data to avoid large IPC roundtrip
ipcMain.on('capture:screenshot-ready', async () => {
  if (!_pendingScreenshot) return;
  const { dataUrl, width, height } = _pendingScreenshot;
  _pendingScreenshot = null;

  let piiRegions = [];
  pendingOcrWords = [];
  if (store.get('privacy_blur', true)) {
    const { scaleFactor } = screen.getPrimaryDisplay();
    // OCR中はレンダラーに処理中ステータスを表示（最大15秒かかる）
    sendToRenderer('app:ocr-status', { status: 'processing' });
    const result = await detectPiiAndWords(dataUrl, scaleFactor).catch(() => null);
    sendToRenderer('app:ocr-status', { status: 'done' });
    if (result) {
      piiRegions = result.piiRegions;
      pendingOcrWords = result.words;
    } else {
      // OCR失敗 — ぼかしが効かない可能性をユーザーに通知
      console.warn('[ocr] PII detection failed');
      sendToRenderer('app:ocr-failed', {});
    }
  }
  setCaptureInProgress(false);
  showOverlay(dataUrl, width, height, steps.length + 1, piiRegions);
});

function showOverlay(dataUrl, screenWidth, screenHeight, nextStepNumber, piiRegions = []) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }

  const { bounds } = screen.getPrimaryDisplay();

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: screenWidth,
    height: screenHeight,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.webContents.once('did-finish-load', () => {
    const plan = store.get('plan', 'free');
    const privacyBlurEnabled = store.get('privacy_blur', true);
    // dataUrl が大きいため piiRegions は別イベントで送る
    overlayWindow.webContents.send('overlay:init', {
      dataUrl,
      screenWidth,
      screenHeight,
      stepNumber: nextStepNumber,
      isFree: !['standard', 'pro', 'team'].includes(plan),
      privacyBlurEnabled,
    });
    if (piiRegions.length > 0) {
      overlayWindow.webContents.send('overlay:set-pii', piiRegions);
    }
    overlayWindow.focus();
  });
}

// ── IPC: overlay events ────────────────────────────────────────────────────
ipcMain.on('overlay:captured', (_, { annotatedDataUrl, rawDataUrl, x, y, screenWidth, screenHeight, stepNumber, piiRegions }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }

  // Extract OCR text near the click point as AI generation context
  const nearby = pendingOcrWords
    .filter(w => Math.abs((w.x + w.w / 2) - x) < 120 && Math.abs((w.y + w.h / 2) - y) < 80)
    .map(w => w.t).join(' ').trim();
  pendingOcrWords = [];
  if (!recordingStartAt) recordingStartAt = Date.now();

  steps.push({
    stepNumber,
    x, y,
    viewportWidth: screenWidth,
    viewportHeight: screenHeight,
    rawDataUrl,
    annotatedDataUrl,
    label: '',
    memo: '',
    piiRegions: piiRegions ?? [],
    hasPiiBlur: (piiRegions ?? []).length > 0,
    ocrContext: nearby || '',
  });

  notifyRenderer({ steps });

  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('overlay:cancel', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// ── IPC: screenshot (desktopCapturer直接取得 — getDisplayMediaより信頼性が高い) ────
// dataUrlをメイン側にキャッシュし、レンダラーへの往復送信を避ける
let _pendingScreenshot = null;

ipcMain.handle('capture:screenshot', async () => {
  setCaptureInProgress(true); // レンダラー側ボタン経由でもガードを有効化
  const display = screen.getPrimaryDisplay();
  const { bounds, scaleFactor } = display;
  const physW = Math.round(bounds.width * scaleFactor);
  const physH = Math.round(bounds.height * scaleFactor);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 200));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: physW, height: physH },
    });
    if (!sources || sources.length === 0) continue;
    const thumb = sources[0].thumbnail;
    if (thumb.isEmpty()) continue;
    const dataUrl = thumb.toDataURL();
    _pendingScreenshot = { dataUrl, width: bounds.width, height: bounds.height };
    return { width: bounds.width, height: bounds.height }; // dataUrlは送らない
  }
  setCaptureInProgress(false); // 取得失敗 — ロック解除
  return null;
});

// ── IPC: state ─────────────────────────────────────────────────────────────
ipcMain.handle('state:get', () => ({ steps }));

ipcMain.on('state:update-steps', (_, newSteps) => {
  steps = newSteps ?? [];
});

ipcMain.on('state:clear', () => {
  steps = [];
  recordingStartAt = null;
  notifyRenderer({ steps });
});

// ── IPC: i18n ──────────────────────────────────────────────────────────────
ipcMain.handle('i18n:load', (_, lang) => {
  const localesDir = app.isPackaged
    ? path.join(process.resourcesPath, '_locales')
    : path.join(__dirname, '..', '..', 'extension', '_locales');
  const tryRead = (l) => {
    try { return JSON.parse(fs.readFileSync(path.join(localesDir, l, 'messages.json'), 'utf8')); }
    catch { return null; }
  };
  return tryRead(lang) ?? tryRead('ja') ?? {};
});

// ── IPC: store ─────────────────────────────────────────────────────────────
ipcMain.handle('store:get', (_, key, defaultVal) => store.get(key, defaultVal));
ipcMain.handle('store:get-multi', (_, keys) => store.getMulti(keys));
ipcMain.on('store:set', (_, key, value) => store.set(key, value));
ipcMain.on('store:set-multi', (_, obj) => store.setMulti(obj));
ipcMain.on('store:delete', (_, key) => store.delete(key));
ipcMain.on('store:delete-multi', (_, keys) => store.deleteMulti(keys));

// ── IPC: auth ──────────────────────────────────────────────────────────────
ipcMain.handle('auth:google-sign-in', async () => {
  return authGoogle.signInWithGoogle();
});

ipcMain.handle('auth:get-google-token', async () => {
  return authGoogle.getToken();
});

ipcMain.handle('auth:google-sign-out', () => {
  authGoogle.signOut();
});

ipcMain.handle('window:hide-for-capture', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.handle('window:show', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });

ipcMain.handle('auth:notion-connect', async () => {
  return authNotion.connectNotion();
});

// ── IPC: Notion save ───────────────────────────────────────────────────────
ipcMain.handle('notion:save', async (_, args) => {
  const durationSec = recordingStartAt ? Math.round((Date.now() - recordingStartAt) / 1000) : null;
  const result = await notion.saveToNotion({ ...args, recordingDurationSec: durationSec });
  // 部分失敗（warning付き）の場合はステップを保持し、再保存できるようにする
  if (result.success && !result.warning) {
    steps = [];
    recordingStartAt = null;
    notifyRenderer({ steps });
  }
  return result;
});

// ── IPC: PDF export ────────────────────────────────────────────────────────
ipcMain.handle('pdf:export', async (_, { title, steps: exportSteps }) => {
  const pdfWin = new BrowserWindow({
    width: 860,
    height: 1000,
    title: 'PDF プレビュー',
    webPreferences: {
      preload: path.join(__dirname, '..', 'pdf-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  pdfWin.loadFile(path.join(__dirname, '..', 'renderer', 'pdf.html'));
  pdfWin.webContents.once('did-finish-load', () => {
    pdfWin.webContents.send('pdf:init', { title, steps: exportSteps });
  });
});

// ── IPC: capture button from renderer ─────────────────────────────────────
ipcMain.on('capture:take', () => takeScreenshot());

// ── IPC: UI ────────────────────────────────────────────────────────────────
ipcMain.on('app:open-external', (_, url) => {
  // http/https のみ許可（file:// 等によるローカル実行を防止）
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.on('preview:open', (_, src) => {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    title: 'Preview',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL('about:blank');
  win.webContents.once('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      document.documentElement.style.height = '100%';
      document.body.style.cssText = 'margin:0;background:#111;height:100%;display:flex;align-items:center;justify-content:center';
      const img = document.createElement('img');
      img.style.cssText = 'max-width:100%;max-height:100vh;object-fit:contain';
      img.src = ${JSON.stringify(src)};
      document.body.appendChild(img);
    `);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────
function notifyRenderer(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state:updated', data);
  }
}

// 任意のチャンネルでレンダラーへイベント送信（autoUpdater/OCRステータス等）
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
