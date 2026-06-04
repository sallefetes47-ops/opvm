const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
});
