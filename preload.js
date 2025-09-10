const { contextBridge, ipcRenderer } = require('electron');

// Expose native audio output device APIs to renderer process (input devices removed)
contextBridge.exposeInMainWorld('nativeAudio', {
  // Get native OS audio output devices
  getNativeOutputDevices: () => ipcRenderer.invoke('get-native-output-devices'),
  
  // Get cross-referenced devices (native + Web Audio API matching)
  getCrossReferencedDevices: () => ipcRenderer.invoke('get-cross-referenced-devices')
});

// Expose platform information
contextBridge.exposeInMainWorld('platform', {
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  getVersion: () => process.getSystemVersion ? process.getSystemVersion() : 'Unknown'
});