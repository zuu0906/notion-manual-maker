const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  onInit: (cb) => ipcRenderer.on('overlay:init', (_, data) => cb(data)),
  onSetPii: (cb) => ipcRenderer.on('overlay:set-pii', (_, regions) => cb(regions)),
  sendCaptured: (data) => ipcRenderer.send('overlay:captured', data),
  cancel: () => ipcRenderer.send('overlay:cancel'),
});
