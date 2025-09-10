const { contextBridge, ipcRenderer } = require('electron');

// Expose native audio device APIs to renderer process
contextBridge.exposeInMainWorld('nativeAudio', {
  // Get native OS audio devices
  getNativeDevices: () => ipcRenderer.invoke('get-native-audio-devices'),
  
  // Check microphone permission status (macOS)
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  
  // Request microphone permission (macOS)
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission')
});

// Expose platform information
contextBridge.exposeInMainWorld('platform', {
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  getVersion: () => process.getSystemVersion ? process.getSystemVersion() : 'Unknown'
});