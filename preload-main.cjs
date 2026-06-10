const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInspectorPreloadPath: () => ipcRenderer.sendSync('get-inspector-preload-path')
});
