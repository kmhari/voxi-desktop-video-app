const { contextBridge, ipcRenderer } = require('electron');

// Expose native audio device APIs to renderer process
contextBridge.exposeInMainWorld('nativeAudio', {
  // Get native OS audio input devices
  getNativeDevices: () => ipcRenderer.invoke('get-native-audio-devices'),
  
  // Get native OS audio output devices
  getNativeOutputDevices: () => ipcRenderer.invoke('get-native-output-devices'),
  
  // Get cross-referenced devices (native + Web Audio API matching)
  getCrossReferencedDevices: () => ipcRenderer.invoke('get-cross-referenced-devices'),
  
  // Check microphone permission status
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  
  // Request microphone permission
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  
  // Check media access permission
  checkMediaAccess: (mediaType) => ipcRenderer.invoke('check-media-access', mediaType)
});

// Expose platform information
contextBridge.exposeInMainWorld('platform', {
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  getVersion: () => process.getSystemVersion ? process.getSystemVersion() : 'Unknown'
});