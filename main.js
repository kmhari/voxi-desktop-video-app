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
                  audioDevices.push({
                    name: device._name,
                    manufacturer: device.coreaudio_device_manufacturer || 'Unknown',
                    id: device.coreaudio_device_id || 'unknown',
                    inputChannels: device.coreaudio_inputs || 'Unknown',
                    sampleRate: device.coreaudio_current_sample_rate || 'Unknown',
                    platform: 'darwin',
                    type: 'input'
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
        const audioDevices = (Array.isArray(devices) ? devices : [devices]).map(device => ({
          name: device.Name,
          manufacturer: device.Manufacturer || 'Unknown',
          id: device.DeviceID,
          status: device.Status,
          platform: 'win32',
          type: 'input'
        }));
        
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
              return {
                name: parts[1] || 'Unknown',
                id: parts[0] || 'unknown',
                driver: parts[2] || 'PulseAudio',
                platform: 'linux',
                type: 'input'
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
          devices.push({
            name: cardMatch[2],
            id: `hw:${cardMatch[1]}`,
            description: cardMatch[3],
            platform: 'linux',
            type: 'input'
          });
        }
      });
      
      resolve({ devices, platform: 'linux' });
    });
  });
}