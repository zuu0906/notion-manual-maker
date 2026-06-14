// automation-preload.js — 自動実行 管理/編集ウィンドウ用の contextBridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('automation', {
  // ── 一覧/実行（管理ウィンドウ）──
  listFlows: () => ipcRenderer.invoke('automation:list-flows'),
  getFlow: (id) => ipcRenderer.invoke('automation:get-flow', id),
  deleteFlow: (id) => ipcRenderer.invoke('automation:delete-flow', id),
  runFlow: (id, mode) => ipcRenderer.invoke('automation:run-flow', { id, mode }),
  getRunLog: (id) => ipcRenderer.invoke('automation:get-run-log', id),

  // ── W15: 操作の自動記録 ──
  recordingState: () => ipcRenderer.invoke('automation:recording-state'),
  startRecording: (name) => ipcRenderer.invoke('automation:start-recording', { name }),
  stopRecording: () => ipcRenderer.invoke('automation:stop-recording'),
  onRecordingProgress: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('automation:recording-progress', handler);
    return () => ipcRenderer.removeListener('automation:recording-progress', handler);
  },
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

  // ── W9: 実行中の確認/入力プロンプト ──
  onPrompt: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('automation:prompt', handler);
    return () => ipcRenderer.removeListener('automation:prompt', handler);
  },
  replyPrompt: (reqId, value) => ipcRenderer.send(`automation:prompt-reply:${reqId}`, value),

  // ── W10: オンボーディング ──
  onboardingState: () => ipcRenderer.invoke('automation:onboarding-state'),
  onboardingDone: () => ipcRenderer.invoke('automation:onboarding-done'),

  // ── W7: フロー編集 ──
  openEditor: (id) => ipcRenderer.invoke('automation:open-editor', id),
  renameFlow: (id, name) => ipcRenderer.invoke('automation:rename-flow', { id, name }),
  updateStep: (id, index, patch) => ipcRenderer.invoke('automation:update-step', { id, index, patch }),
  applyOps: (id, ops) => ipcRenderer.invoke('automation:apply-ops', { id, ops }),
  restoreFlow: (id) => ipcRenderer.invoke('automation:restore-flow', id),
  getStepImage: (id, file) => ipcRenderer.invoke('automation:get-step-image', { id, file }),
  dryRunFlow: (id) => ipcRenderer.invoke('automation:dry-run-flow', id),
  nlPropose: (id, instruction) => ipcRenderer.invoke('automation:nl-propose', { id, instruction }),
  onEditorInit: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('automation:editor-init', handler);
    return () => ipcRenderer.removeListener('automation:editor-init', handler);
  },
});
