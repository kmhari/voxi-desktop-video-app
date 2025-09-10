const { app, BrowserWindow, ipcMain, systemPreferences, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

// Disable GPU acceleration to prevent GPU process errors
app.disableHardwareAcceleration();

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

// Permission handlers
ipcMain.handle('check-media-access', async (event, mediaType) => {
  if (process.platform === 'darwin') {
    // macOS requires explicit permission
    const status = systemPreferences.getMediaAccessStatus(mediaType);
    if (status !== 'granted') {
      const granted = await systemPreferences.askForMediaAccess(mediaType);
      return granted;
    }
    return true;
  } else if (process.platform === 'win32') {
    // Windows typically grants permissions automatically, but we'll check
    try {
      // Check Windows privacy settings
      const { exec: execSync } = require('child_process');
      return new Promise((resolve) => {
        execSync('powershell -Command "Get-PnpDevice -Class AudioEndpoint -Status OK"', (error) => {
          resolve(!error);
        });
      });
    } catch {
      return true; // Assume granted if we can't check
    }
  }
  return true; // Linux and others
});

// Native audio device enumeration handlers
ipcMain.handle('get-native-audio-devices', async () => {
  const platform = os.platform();
  
  try {
    // Check for microphone permission first
    if (platform === 'darwin') {
      const microphoneAccess = systemPreferences.getMediaAccessStatus('microphone');
      if (microphoneAccess !== 'granted') {
        const granted = await systemPreferences.askForMediaAccess('microphone');
        if (!granted) {
          return { 
            error: 'Microphone access denied. Please grant permission in System Preferences.', 
            devices: [],
            permissionDenied: true 
          };
        }
      }
    }
    
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

// Check microphone permission handler
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return { status };
  } else if (process.platform === 'win32') {
    // Windows typically auto-grants permissions
    return { status: 'granted' };
  }
  return { status: 'granted' };
});

// Request microphone permission handler
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { granted };
  } else if (process.platform === 'win32') {
    // Show a dialog to guide user to Windows settings if needed
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Microphone Access',
      message: 'Please ensure microphone access is enabled in Windows Settings',
      detail: 'Go to Settings > Privacy > Microphone and ensure apps can access your microphone.',
      buttons: ['OK']
    });
    return { granted: true };
  }
  return { granted: true };
});

// Native audio output device enumeration handler
ipcMain.handle('get-native-output-devices', async () => {
  const platform = os.platform();
  
  try {
    // First try the native C library
    const nativeResult = await getNativeAudioDevices();
    if (nativeResult && nativeResult.devices && nativeResult.devices.length > 0) {
      return nativeResult;
    }
    
    // Fall back to platform-specific implementations
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

// Native C library integration
async function getNativeAudioDevices() {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    let binaryPath;
    
    // Set binary path based on platform
    if (platform === 'win32') {
      binaryPath = path.join(__dirname, 'cross', 'list_audio_devices.exe');
    } else {
      binaryPath = path.join(__dirname, 'cross', 'list_audio_devices');
    }
    
    // Check if binary exists first
    const fs = require('fs');
    if (!fs.existsSync(binaryPath)) {
      console.log(`Native binary not found at ${binaryPath}, falling back to platform-specific detection`);
      resolve(null);
      return;
    }
    
    exec(binaryPath, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 'ENOENT') {
          console.log('Native binary not executable, falling back to platform-specific detection');
        } else if (error.signal === 'SIGTERM') {
          console.log('Native binary timed out, falling back to platform-specific detection');
        } else {
          console.log(`Native binary error: ${error.message}, falling back to platform-specific detection`);
        }
        resolve(null);
        return;
      }
      
      if (stderr) {
        console.warn('Native binary stderr:', stderr);
      }
      
      try {
        // Validate output is not empty
        if (!stdout || stdout.trim() === '') {
          console.log('Native binary returned empty output, falling back to platform-specific detection');
          resolve(null);
          return;
        }
        
        // Parse the JSON output from the native binary
        const result = JSON.parse(stdout);
        
        // Validate result structure
        if (!result || !Array.isArray(result.devices)) {
          console.log('Native binary returned invalid structure, falling back to platform-specific detection');
          resolve(null);
          return;
        }
        
        // Convert to our expected format
        const devices = result.devices.map(device => ({
          name: device.name || 'Unknown Device',
          id: device.id || 'unknown',
          deviceType: mapNativeDeviceType(device.type),
          connectivity: mapNativeConnectionType(device.connection),
          isDefault: device.is_default || false,
          platform: os.platform(),
          type: 'output',
          source: 'native-c'
        }));
        
        console.log(`Native C library detected ${devices.length} audio output devices`);
        resolve({ devices, platform: os.platform(), source: 'native-c' });
      } catch (parseError) {
        console.error('Error parsing native binary output:', parseError.message);
        console.log('Raw output:', stdout);
        resolve(null);
      }
    });
  });
}

// Map native device types to our classification
function mapNativeDeviceType(nativeType) {
  const typeMap = {
    'Speakers': 'speaker',
    'SPEAKERS': 'speaker',
    'Headphones': 'headphone', 
    'HEADPHONES': 'headphone',
    'HDMI': 'speaker',
    'USB': 'speaker',
    'Bluetooth': 'headphone',
    'BLUETOOTH': 'headphone',
    'Virtual': 'speaker',
    'VIRTUAL': 'speaker',
    'Unknown': 'unknown'
  };
  return typeMap[nativeType] || 'unknown';
}

// Map native connection types to our classification
function mapNativeConnectionType(nativeConnection) {
  const connectionMap = {
    'Built-in': 'wired',
    'BUILTIN': 'wired',
    'Wired': 'wired',
    'WIRED': 'wired',
    'Wireless': 'wireless',
    'WIRELESS': 'wireless',
    'Unknown': 'unknown'
  };
  return connectionMap[nativeConnection] || 'unknown';
}


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
  } else if (nameLower.includes('audio') || nameLower.includes('sound') ||
             nameLower.includes('realtek') || nameLower.includes('amd') ||
             nameLower.includes('nvidia') || nameLower.includes('intel')) {
    // Generic audio devices - typically integrated sound cards that handle both input and output
    deviceType = 'speaker';  // Default to speaker for generic audio devices
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
             nameLower.includes('wired') || nameLower.includes('cable') ||
             nameLower.includes('realtek') || nameLower.includes('amd') ||
             nameLower.includes('nvidia') || nameLower.includes('intel') ||
             nameLower.includes('high definition audio')) {
    connectivity = 'wired';  // Integrated audio devices are considered wired
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
      Select-Object Name, Manufacturer, DeviceID, Status |
      ConvertTo-Json
    `;
    
    exec(`powershell -Command "${powershellCmd}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      try {
        // Handle empty output from PowerShell
        const trimmedOutput = stdout.trim();
        if (!trimmedOutput) {
          resolve({ devices: [], platform: 'win32' });
          return;
        }
        
        const devices = JSON.parse(trimmedOutput) || [];
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

// Windows audio output device enumeration (Enhanced for Windows 10/11)
async function getWindowsOutputDevices() {
  return new Promise((resolve, reject) => {
    // Enhanced PowerShell command for better Windows audio detection
    const enhancedCmd = `
      $ErrorActionPreference = 'SilentlyContinue'
      try {
        # Try modern Windows Audio cmdlets first
        $devices = Get-AudioDevice -List -ErrorAction Stop | Where-Object {$_.Type -eq "Playback"}
        $devices | Select-Object Name, ID, Default | ConvertTo-Json -Depth 2
      } catch {
        # Fallback to WMI for older systems
        Get-CimInstance -ClassName Win32_SoundDevice | 
        Where-Object {$_.Name -notlike "*input*" -and $_.Name -notlike "*microphone*"} |
        Select-Object Name, Manufacturer, DeviceID, Status | ConvertTo-Json -Depth 2
      }
    `;
    
    exec(`powershell -ExecutionPolicy Bypass -Command "${enhancedCmd}"`, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        // Final fallback command
        const fallbackCmd = `Get-WmiObject -Class Win32_SoundDevice | Select-Object Name, Manufacturer, DeviceID, Status | ConvertTo-Json`;
        exec(`powershell -Command "${fallbackCmd}"`, (fallbackError, fallbackStdout) => {
          if (fallbackError) {
            reject(new Error(`All PowerShell commands failed: ${error.message}`));
            return;
          }
          processWindowsAudioOutput(fallbackStdout, resolve, reject, false);
        });
        return;
      }
      
      processWindowsAudioOutput(stdout, resolve, reject, true);
    });
  });
}

function processWindowsAudioOutput(stdout, resolve, reject, isModernAPI) {
  try {
    const trimmedOutput = stdout.trim();
    if (!trimmedOutput) {
      resolve({ devices: [], platform: 'win32', source: 'windows-api' });
      return;
    }
    
    const devices = JSON.parse(trimmedOutput) || [];
    const deviceArray = Array.isArray(devices) ? devices : [devices];
    
    const audioDevices = deviceArray
      .filter(device => device && (device.Name || device.name)) // Filter out null/invalid devices
      .map(device => {
        const deviceName = device.Name || device.name || 'Unknown Device';
        const deviceId = device.ID || device.DeviceID || device.id || 'unknown';
        const classification = classifyAudioDevice(deviceName, device.Manufacturer);
        
        // Enhanced Windows-specific device classification
        let enhancedType = classification.deviceType;
        let enhancedConnectivity = classification.connectivity;
        
        // Windows-specific enhancements
        const nameLower = deviceName.toLowerCase();
        if (nameLower.includes('realtek')) {
          enhancedType = nameLower.includes('headphone') ? 'headphone' : 'speaker';
          enhancedConnectivity = 'wired';
        } else if (nameLower.includes('nvidia') || nameLower.includes('amd') || nameLower.includes('intel')) {
          enhancedType = 'speaker'; // Usually HDMI/Display audio
          enhancedConnectivity = 'wired';
        } else if (deviceId.includes('BTHENUM') || nameLower.includes('bluetooth')) {
          enhancedType = 'headphone';
          enhancedConnectivity = 'wireless';
        } else if (nameLower.includes('usb')) {
          enhancedType = nameLower.includes('headphone') ? 'headphone' : 'speaker';
          enhancedConnectivity = 'wired';
        }
        
        return {
          name: deviceName,
          manufacturer: device.Manufacturer || 'Unknown',
          id: deviceId,
          status: device.Status || (device.Default ? 'Default' : 'Available'),
          platform: 'win32',
          type: 'output',
          deviceType: enhancedType,
          connectivity: enhancedConnectivity,
          isDefault: device.Default || false,
          source: isModernAPI ? 'windows-modern-api' : 'windows-wmi'
        };
      });
    
    resolve({ 
      devices: audioDevices, 
      platform: 'win32', 
      source: isModernAPI ? 'windows-modern-api' : 'windows-wmi' 
    });
  } catch (parseError) {
    reject(parseError);
  }
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

// Cross-reference native devices with Web Audio API enumerateDevices
ipcMain.handle('get-cross-referenced-devices', async () => {
  try {
    // Get devices from native C library
    const nativeResult = await getNativeAudioDevices();
    
    // Return both native and cross-reference instructions
    return {
      nativeDevices: nativeResult ? nativeResult.devices : [],
      platform: os.platform(),
      source: nativeResult ? nativeResult.source : 'fallback',
      // Instructions for renderer to cross-reference with enumerateDevices()
      crossReferenceEnabled: true,
      message: 'Use enumerateDevices() in renderer to match device IDs'
    };
  } catch (error) {
    console.error('Error getting cross-referenced devices:', error);
    return { 
      error: error.message, 
      nativeDevices: [],
      crossReferenceEnabled: false 
    };
  }
});