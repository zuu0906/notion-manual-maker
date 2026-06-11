// automation-preload.js — 自動実行管理ウィンドウ用の contextBridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('automation', {
  listFlows: () => ipcRenderer.invoke('automation:list-flows'),
  getFlow: (id) => ipcRenderer.invoke('automation:get-flow', id),
  deleteFlow: (id) => ipcRenderer.invoke('automation:delete-flow', id),
  runFlow: (id, mode) => ipcRenderer.invoke('automation:run-flow', { id, mode }),
  onRunProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('automation:run-progress', handler);
    return () => ipcRenderer.removeListener('automation:run-progress', handler);
  },
});
