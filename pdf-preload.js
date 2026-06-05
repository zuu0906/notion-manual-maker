const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pdfAPI', {
  onInit: (cb) => ipcRenderer.on('pdf:init', (_, data) => cb(data)),
});
