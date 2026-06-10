const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // electron-store (replaces chrome.storage)
  storeGet: (key, defaultVal = undefined) => ipcRenderer.invoke('store:get', key, defaultVal),
  storeGetMulti: (keys) => ipcRenderer.invoke('store:get-multi', keys),
  storeSet: (key, value) => ipcRenderer.send('store:set', key, value),
  storeSetMulti: (obj) => ipcRenderer.send('store:set-multi', obj),
  storeDelete: (key) => ipcRenderer.send('store:delete', key),
  storeDeleteMulti: (keys) => ipcRenderer.send('store:delete-multi', keys),

  // Google auth
  googleSignIn: () => ipcRenderer.invoke('auth:google-sign-in'),
  getGoogleToken: () => ipcRenderer.invoke('auth:get-google-token'),
  googleSignOut: () => ipcRenderer.invoke('auth:google-sign-out'),

  // Window control for capture
  hideForCapture: () => ipcRenderer.invoke('window:hide-for-capture'),
  showWindow: () => ipcRenderer.invoke('window:show'),

  // Notion auth
  notionConnect: () => ipcRenderer.invoke('auth:notion-connect'),

  // App state
  getState: () => ipcRenderer.invoke('state:get'),
  updateSteps: (steps) => ipcRenderer.send('state:update-steps', steps),
  clearSteps: () => ipcRenderer.send('state:clear'),

  // Screenshot capture via getDisplayMedia (Electron 25+)
  // setDisplayMediaRequestHandler in main.js auto-selects the screen without a dialog.
  captureScreen: async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 500);
        if ('requestVideoFrameCallback' in video) {
          video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(); });
        }
      });
      const w = window.screen.width;
      const h = window.screen.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
    } catch (e) {
      console.error('[captureScreen]', e);
      return null;
    }
  },
  loadI18n: (lang) => ipcRenderer.invoke('i18n:load', lang),
  takeScreenshot: () => ipcRenderer.invoke('capture:screenshot'),
  onCaptureTrigger: (cb) => ipcRenderer.on('capture:trigger', (_, data) => cb(data)),
  screenshotReady: () => ipcRenderer.send('capture:screenshot-ready'),

  // Notion save
  saveToNotion: (args) => ipcRenderer.invoke('notion:save', args),

  // PDF export
  exportPdf: (args) => ipcRenderer.invoke('pdf:export', args),

  // UI helpers
  openExternal: (url) => ipcRenderer.send('app:open-external', url),
  openPreview: (src) => ipcRenderer.send('preview:open', src),

  // Event subscriptions (renderer → main push)
  onStateUpdated: (cb) => {
    ipcRenderer.on('state:updated', (_, data) => cb(data));
  },
  // 汎用イベント購読（ホワイトリスト方式）— autoUpdater / OCRステータス通知用
  onAppEvent: (channel, cb) => {
    const allowed = ['app:update-available', 'app:update-downloaded', 'app:ocr-status', 'app:ocr-failed'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_, data) => cb(data));
    }
  },
  removeStateUpdatedListeners: () => {
    ipcRenderer.removeAllListeners('state:updated');
  },
});
