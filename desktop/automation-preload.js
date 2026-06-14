// automation-preload.js — 自動実行 管理/編集ウィンドウ用の contextBridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('automation', {
  // ── 一覧/実行（管理ウィンドウ）──
  listFlows: () => ipcRenderer.invoke('automation:list-flows'),
  getFlow: (id) => ipcRenderer.invoke('automation:get-flow', id),
  deleteFlow: (id) => ipcRenderer.invoke('automation:delete-flow', id),
  runFlow: (id, mode) => ipcRenderer.invoke('automation:run-flow', { id, mode }),
  onRunProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('automation:run-progress', handler);
    return () => ipcRenderer.removeListener('automation:run-progress', handler);
  },
  onFlowsChanged: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('automation:flows-changed', handler);
    return () => ipcRenderer.removeListener('automation:flows-changed', handler);
  },

  // ── W7: フロー編集 ──
  openEditor: (id) => ipcRenderer.invoke('automation:open-editor', id),
  renameFlow: (id, name) => ipcRenderer.invoke('automation:rename-flow', { id, name }),
  updateStep: (id, index, patch) => ipcRenderer.invoke('automation:update-step', { id, index, patch }),
  applyOps: (id, ops) => ipcRenderer.invoke('automation:apply-ops', { id, ops }),
  restoreFlow: (id) => ipcRenderer.invoke('automation:restore-flow', id),
  getStepImage: (id, file) => ipcRenderer.invoke('automation:get-step-image', { id, file }),
  onEditorInit: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('automation:editor-init', handler);
    return () => ipcRenderer.removeListener('automation:editor-init', handler);
  },
});
