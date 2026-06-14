// run-overlay-preload.js — 実行中HUD（run-overlay.html）用の contextBridge（W6）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hud', {
  onUpdate: (cb) => {
    const handler = (_e, view) => cb(view);
    ipcRenderer.on('hud:update', handler);
    return () => ipcRenderer.removeListener('hud:update', handler);
  },
});
