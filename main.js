const { app, BrowserWindow, ipcMain, systemPreferences } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Native audio device enumeration handlers
ipcMain.handle('get-native-audio-devices', async () => {
  const platform = os.platform();
  
  try {
    if (platform === 'darwin') {
      // macOS - use system_profiler
      return await getMacOSAudioDevices();
    } else if (platform === 'win32') {
      // Windows - use PowerShell
      return await getWindowsAudioDevices();
    } else if (platform === 'linux') {
      // Linux - use ALSA/PulseAudio
      return await getLinuxAudioDevices();
    }
  } catch (error) {
    console.error('Error getting native audio devices:', error);
    return { error: error.message, devices: [] };
  }
});

// Native audio output device enumeration handler
ipcMain.handle('get-native-output-devices', async () => {
  const platform = os.platform();
  
  try {
    if (platform === 'darwin') {
      return await getMacOSOutputDevices();
    } else if (platform === 'win32') {
      return await getWindowsOutputDevices();
    } else if (platform === 'linux') {
      return await getLinuxOutputDevices();
    }
  } catch (error) {
    console.error('Error getting native output devices:', error);
    return { error: error.message, devices: [] };
  }
});

// Check microphone permission status (macOS)
ipcMain.handle('check-microphone-permission', async () => {
  if (os.platform() === 'darwin') {
    try {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      return { status, platform: 'darwin' };
    } catch (error) {
      return { error: error.message, platform: 'darwin' };
    }
  }
  return { status: 'not-applicable', platform: os.platform() };
});

// Request microphone permission (macOS)
ipcMain.handle('request-microphone-permission', async () => {
  if (os.platform() === 'darwin') {
    try {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return { granted, platform: 'darwin' };
    } catch (error) {
      return { error: error.message, platform: 'darwin' };
    }
  }
  return { granted: true, platform: os.platform() };
});

// Helper function to classify device type and connectivity
function classifyAudioDevice(name, manufacturer) {
  const nameLower = name.toLowerCase();
  const manufLower = (manufacturer || '').toLowerCase();
  
  let deviceType = 'unknown';
  let connectivity = 'unknown';
  
  // Device type classification
  if (nameLower.includes('headphone') || nameLower.includes('headset') || 
      nameLower.includes('earphone') || nameLower.includes('earbud') ||
      nameLower.includes('airpods') || nameLower.includes('beats') ||
      nameLower.includes('sennheiser') || nameLower.includes('sony wh') ||
      nameLower.includes('bose') || nameLower.includes('skullcandy') ||
      nameLower.includes('jabra') || nameLower.includes('plantronics') ||
      nameLower.includes('steelseries') || nameLower.includes('hyperx') ||
      nameLower.includes('razer') || nameLower.includes('logitech g') ||
      nameLower.includes('corsair') || nameLower.includes('gaming headset')) {
    deviceType = 'headphone';
  } else if (nameLower.includes('speaker') || nameLower.includes('monitor') ||
             nameLower.includes('soundbar') || nameLower.includes('subwoofer') ||
             nameLower.includes('built-in speakers') || nameLower.includes('internal speakers') ||
             nameLower.includes('studio monitor') || nameLower.includes('bookshelf') ||
             nameLower.includes('desktop speaker') || nameLower.includes('computer speaker')) {
    deviceType = 'speaker';
  } else if (nameLower.includes('microphone') || nameLower.includes('mic') ||
             nameLower.includes('input') || nameLower.includes('capture') ||
             nameLower.includes('built-in mic') || nameLower.includes('internal mic') ||
             nameLower.includes('webcam') || nameLower.includes('camera')) {
    deviceType = 'microphone';
  }
  
  // Connectivity classification
  if (nameLower.includes('bluetooth') || nameLower.includes('wireless') ||
      nameLower.includes('airpods') || nameLower.includes('bt ') ||
      nameLower.includes('wifi') || nameLower.includes('2.4ghz') ||
      manufLower.includes('bluetooth') || nameLower.includes('true wireless')) {
    connectivity = 'wireless';
  } else if (nameLower.includes('usb') || nameLower.includes('analog') ||
             nameLower.includes('digital') || nameLower.includes('3.5mm') ||
             nameLower.includes('jack') || nameLower.includes('line') ||
             nameLower.includes('xlr') || nameLower.includes('trs') ||
             nameLower.includes('built-in') || nameLower.includes('internal') ||
             nameLower.includes('wired') || nameLower.includes('cable')) {
    connectivity = 'wired';
  }
  
  return { deviceType, connectivity };
}

// macOS audio device enumeration
async function getMacOSAudioDevices() {
  return new Promise((resolve, reject) => {
    exec('system_profiler SPAudioDataType -json', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const audioDevices = [];
        
        if (data.SPAudioDataType) {
          data.SPAudioDataType.forEach(item => {
            if (item._items) {
              item._items.forEach(device => {
                if (device._name && device._name.includes('Input') || 
                    (device.coreaudio_input_source && device.coreaudio_input_source !== 'No')) {
                  
                  const classification = classifyAudioDevice(device._name, device.coreaudio_device_manufacturer);
                  
                  audioDevices.push({
                    name: device._name,
                    manufacturer: device.coreaudio_device_manufacturer || 'Unknown',
                    id: device.coreaudio_device_id || 'unknown',
                    inputChannels: device.coreaudio_inputs || 'Unknown',
                    sampleRate: device.coreaudio_current_sample_rate || 'Unknown',
                    platform: 'darwin',
                    type: 'input',
                    deviceType: classification.deviceType,
                    connectivity: classification.connectivity
                  });
                }
              });
            }
          });
        }
        
        resolve({ devices: audioDevices, platform: 'darwin' });
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

// macOS audio output device enumeration
async function getMacOSOutputDevices() {
  return new Promise((resolve, reject) => {
    exec('system_profiler SPAudioDataType -json', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      try {
        const data = JSON.parse(stdout);
        const audioDevices = [];
        
        if (data.SPAudioDataType) {
          data.SPAudioDataType.forEach(item => {
            if (item._items) {
              item._items.forEach(device => {
                if (device._name && (device._name.includes('Output') || 
                    device.coreaudio_output_source || 
                    device.coreaudio_outputs)) {
                  
                  const classification = classifyAudioDevice(device._name, device.coreaudio_device_manufacturer);
                  
                  audioDevices.push({
                    name: device._name,
                    manufacturer: device.coreaudio_device_manufacturer || 'Unknown',
                    id: device.coreaudio_device_id || 'unknown',
                    outputChannels: device.coreaudio_outputs || 'Unknown',
                    sampleRate: device.coreaudio_current_sample_rate || 'Unknown',
                    platform: 'darwin',
                    type: 'output',
                    deviceType: classification.deviceType,
                    connectivity: classification.connectivity
                  });
                }
              });
            }
          });
        }
        
        resolve({ devices: audioDevices, platform: 'darwin' });
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

// Windows audio device enumeration
async function getWindowsAudioDevices() {
  return new Promise((resolve, reject) => {
    const powershellCmd = `
      Get-CimInstance -ClassName Win32_SoundDevice | 
      Where-Object {$_.DeviceID -like "*CAPTURE*" -or $_.Name -like "*Microphone*" -or $_.Name -like "*Input*"} |
      Select-Object Name, Manufacturer, DeviceID, Status |
      ConvertTo-Json
    `;
    
    exec(`powershell -Command "${powershellCmd}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      try {
        const devices = JSON.parse(stdout) || [];
        const audioDevices = (Array.isArray(devices) ? devices : [devices]).map(device => {
          const classification = classifyAudioDevice(device.Name, device.Manufacturer);
          
          return {
            name: device.Name,
            manufacturer: device.Manufacturer || 'Unknown',
            id: device.DeviceID,
            status: device.Status,
            platform: 'win32',
            type: 'input',
            deviceType: classification.deviceType,
            connectivity: classification.connectivity
          };
        });
        
        resolve({ devices: audioDevices, platform: 'win32' });
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

// Windows audio output device enumeration
async function getWindowsOutputDevices() {
  return new Promise((resolve, reject) => {
    const powershellCmd = `
      Get-CimInstance -ClassName Win32_SoundDevice | 
      Where-Object {$_.DeviceID -like "*RENDER*" -or $_.Name -like "*Speaker*" -or $_.Name -like "*Output*" -or $_.Name -like "*Headphone*"} |
      Select-Object Name, Manufacturer, DeviceID, Status |
      ConvertTo-Json
    `;
    
    exec(`powershell -Command "${powershellCmd}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      try {
        const devices = JSON.parse(stdout) || [];
        const audioDevices = (Array.isArray(devices) ? devices : [devices]).map(device => {
          const classification = classifyAudioDevice(device.Name, device.Manufacturer);
          
          return {
            name: device.Name,
            manufacturer: device.Manufacturer || 'Unknown',
            id: device.DeviceID,
            status: device.Status,
            platform: 'win32',
            type: 'output',
            deviceType: classification.deviceType,
            connectivity: classification.connectivity
          };
        });
        
        resolve({ devices: audioDevices, platform: 'win32' });
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

// Linux audio device enumeration
async function getLinuxAudioDevices() {
  return new Promise((resolve, reject) => {
    exec('arecord -l', (error, stdout, stderr) => {
      if (error) {
        // Try PulseAudio if ALSA fails
        exec('pactl list sources short', (paError, paStdout, paStderr) => {
          if (paError) {
            reject(new Error('Neither ALSA nor PulseAudio found'));
            return;
          }
          
          const devices = paStdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split('\t');
              const deviceName = parts[1] || 'Unknown';
              const classification = classifyAudioDevice(deviceName, '');
              
              return {
                name: deviceName,
                id: parts[0] || 'unknown',
                driver: parts[2] || 'PulseAudio',
                platform: 'linux',
                type: 'input',
                deviceType: classification.deviceType,
                connectivity: classification.connectivity
              };
            });
          
          resolve({ devices, platform: 'linux' });
        });
        return;
      }
      
      const devices = [];
      const lines = stdout.split('\n');
      
      lines.forEach(line => {
        const cardMatch = line.match(/card (\d+): (.+?) \[(.+?)\]/);
        if (cardMatch) {
          const classification = classifyAudioDevice(cardMatch[2], '');
          
          devices.push({
            name: cardMatch[2],
            id: `hw:${cardMatch[1]}`,
            description: cardMatch[3],
            platform: 'linux',
            type: 'input',
            deviceType: classification.deviceType,
            connectivity: classification.connectivity
          });
        }
      });
      
      resolve({ devices, platform: 'linux' });
    });
  });
}

// Linux audio output device enumeration
async function getLinuxOutputDevices() {
  return new Promise((resolve, reject) => {
    exec('aplay -l', (error, stdout, stderr) => {
      if (error) {
        // Try PulseAudio if ALSA fails
        exec('pactl list sinks short', (paError, paStdout, paStderr) => {
          if (paError) {
            reject(new Error('Neither ALSA nor PulseAudio found'));
            return;
          }
          
          const devices = paStdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split('\t');
              const deviceName = parts[1] || 'Unknown';
              const classification = classifyAudioDevice(deviceName, '');
              
              return {
                name: deviceName,
                id: parts[0] || 'unknown',
                driver: parts[2] || 'PulseAudio',
                platform: 'linux',
                type: 'output',
                deviceType: classification.deviceType,
                connectivity: classification.connectivity
              };
            });
          
          resolve({ devices, platform: 'linux' });
        });
        return;
      }
      
      const devices = [];
      const lines = stdout.split('\n');
      
      lines.forEach(line => {
        const cardMatch = line.match(/card (\d+): (.+?) \[(.+?)\]/);
        if (cardMatch) {
          const classification = classifyAudioDevice(cardMatch[2], '');
          
          devices.push({
            name: cardMatch[2],
            id: `hw:${cardMatch[1]}`,
            description: cardMatch[3],
            platform: 'linux',
            type: 'output',
            deviceType: classification.deviceType,
            connectivity: classification.connectivity
          });
        }
      });
      
      resolve({ devices, platform: 'linux' });
    });
  });
}