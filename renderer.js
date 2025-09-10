let mediaRecorder;
let audioChunks = [];
let stream;
let availableDevices = [];

const enumerateDevicesBtn = document.getElementById('enumerateDevices');
const enumerateNativeDevicesBtn = document.getElementById('enumerateNativeDevices');
const enumerateOutputDevicesBtn = document.getElementById('enumerateOutputDevices');
const deviceSelector = document.getElementById('deviceSelector');
const microphoneSelect = document.getElementById('microphoneSelect');
const nativeDeviceInfo = document.getElementById('nativeDeviceInfo');
const nativeDeviceList = document.getElementById('nativeDeviceList');
const outputDeviceInfo = document.getElementById('outputDeviceInfo');
const outputDeviceList = document.getElementById('outputDeviceList');
const requestPermissionBtn = document.getElementById('requestPermission');
const startRecordingBtn = document.getElementById('startRecording');
const stopRecordingBtn = document.getElementById('stopRecording');
const statusDiv = document.getElementById('status');
const audioContainer = document.getElementById('audioContainer');

function updateStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

// Enumerate audio input devices
enumerateDevicesBtn.addEventListener('click', async () => {
    try {
        updateStatus('Enumerating audio input devices...', 'info');
        
        // First request basic permission to enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        if (audioInputs.length === 0) {
            updateStatus('❌ No audio input devices found.', 'error');
            return;
        }
        
        // Clear existing options
        microphoneSelect.innerHTML = '<option value="">Choose a microphone...</option>';
        
        // Populate dropdown with available microphones
        availableDevices = audioInputs;
        audioInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            
            // Create detailed label with device info
            let label = device.label || `Microphone ${index + 1}`;
            if (device.groupId) {
                label += ` (Group: ${device.groupId.substring(0, 8)}...)`;
            }
            
            option.textContent = label;
            option.title = `Device ID: ${device.deviceId}\nGroup ID: ${device.groupId || 'N/A'}`;
            microphoneSelect.appendChild(option);
        });
        
        // Log detailed device information to console
        console.log('Available Audio Input Devices:', audioInputs.map((device, index) => ({
            index: index + 1,
            deviceId: device.deviceId,
            groupId: device.groupId,
            label: device.label || `Microphone ${index + 1}`,
            kind: device.kind
        })));
        
        // Show device selector and enable permission button
        deviceSelector.style.display = 'block';
        updateStatus(`✓ Found ${audioInputs.length} audio input device(s). Select one to continue. Check console for detailed info.`, 'success');
        
        // Enable permission button when device is selected
        microphoneSelect.addEventListener('change', () => {
            requestPermissionBtn.disabled = !microphoneSelect.value;
        });
        
    } catch (error) {
        console.error('Error enumerating devices:', error);
        updateStatus(`❌ Error enumerating devices: ${error.message}`, 'error');
    }
});

// Enumerate native OS audio devices
enumerateNativeDevicesBtn.addEventListener('click', async () => {
    try {
        updateStatus('Enumerating native OS audio devices...', 'info');
        
        // Check if native audio APIs are available
        if (!window.nativeAudio) {
            updateStatus('❌ Native audio APIs not available. Please restart the app.', 'error');
            return;
        }
        
        // Get platform info
        const platform = window.platform ? window.platform.getPlatform() : 'unknown';
        const arch = window.platform ? window.platform.getArch() : 'unknown';
        
        console.log(`Platform: ${platform}, Architecture: ${arch}`);
        
        // Check microphone permission status (macOS only)
        if (platform === 'darwin') {
            const permissionStatus = await window.nativeAudio.checkMicrophonePermission();
            console.log('Microphone permission status:', permissionStatus);
            
            if (permissionStatus.status === 'denied') {
                updateStatus('⚠️ Microphone access denied. Please grant permission in System Preferences.', 'error');
                return;
            } else if (permissionStatus.status === 'unknown') {
                const permissionRequest = await window.nativeAudio.requestMicrophonePermission();
                if (!permissionRequest.granted) {
                    updateStatus('❌ Microphone permission denied.', 'error');
                    return;
                }
            }
        }
        
        // Get native devices
        const result = await window.nativeAudio.getNativeDevices();
        
        if (result.error) {
            updateStatus(`❌ Error getting native devices: ${result.error}`, 'error');
            return;
        }
        
        if (!result.devices || result.devices.length === 0) {
            updateStatus('⚠️ No native audio input devices found.', 'error');
            return;
        }
        
        // Display native device information
        displayNativeDevices(result.devices, result.platform);
        
        updateStatus(`✓ Found ${result.devices.length} native audio device(s) on ${result.platform}.`, 'success');
        
    } catch (error) {
        console.error('Error enumerating native devices:', error);
        updateStatus(`❌ Error: ${error.message}`, 'error');
    }
});

function displayNativeDevices(devices, platform) {
    nativeDeviceList.innerHTML = '';
    
    devices.forEach((device, index) => {
        const deviceDiv = document.createElement('div');
        deviceDiv.style.cssText = `
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
            margin: 10px 0;
            background: #f9f9f9;
        `;
        
        let deviceInfo = `
            <strong>Device ${index + 1}:</strong> ${device.name}<br>
            <strong>ID:</strong> ${device.id}<br>
            <strong>Platform:</strong> ${platform}<br>
            <strong>Type:</strong> <span style="color: #007bff;">${device.deviceType || 'unknown'}</span><br>
            <strong>Connectivity:</strong> <span style="color: #28a745;">${device.connectivity || 'unknown'}</span><br>
        `;
        
        // Platform-specific information
        if (platform === 'darwin') {
            deviceInfo += `
                <strong>Manufacturer:</strong> ${device.manufacturer}<br>
                <strong>Input Channels:</strong> ${device.inputChannels}<br>
                <strong>Sample Rate:</strong> ${device.sampleRate}<br>
            `;
        } else if (platform === 'win32') {
            deviceInfo += `
                <strong>Manufacturer:</strong> ${device.manufacturer}<br>
                <strong>Status:</strong> ${device.status}<br>
            `;
        } else if (platform === 'linux') {
            deviceInfo += `
                <strong>Driver:</strong> ${device.driver || 'ALSA'}<br>
                ${device.description ? `<strong>Description:</strong> ${device.description}<br>` : ''}
            `;
        }
        
        deviceDiv.innerHTML = deviceInfo;
        nativeDeviceList.appendChild(deviceDiv);
    });
    
    nativeDeviceInfo.style.display = 'block';
    
    // Log detailed info to console
    console.log('Native Audio Input Devices:', devices);
}

function displayOutputDevices(devices, platform) {
    outputDeviceList.innerHTML = '';
    
    devices.forEach((device, index) => {
        const deviceDiv = document.createElement('div');
        deviceDiv.style.cssText = `
            border: 1px solid #28a745;
            border-radius: 5px;
            padding: 15px;
            margin: 10px 0;
            background: #f8fff9;
        `;
        
        let deviceInfo = `
            <strong>Output Device ${index + 1}:</strong> ${device.name}<br>
            <strong>ID:</strong> ${device.id}<br>
            <strong>Platform:</strong> ${platform}<br>
            <strong>Type:</strong> <span style="color: #007bff;">${device.deviceType || 'unknown'}</span><br>
            <strong>Connectivity:</strong> <span style="color: #28a745;">${device.connectivity || 'unknown'}</span><br>
        `;
        
        // Platform-specific information
        if (platform === 'darwin') {
            deviceInfo += `
                <strong>Manufacturer:</strong> ${device.manufacturer}<br>
                <strong>Output Channels:</strong> ${device.outputChannels}<br>
                <strong>Sample Rate:</strong> ${device.sampleRate}<br>
            `;
        } else if (platform === 'win32') {
            deviceInfo += `
                <strong>Manufacturer:</strong> ${device.manufacturer}<br>
                <strong>Status:</strong> ${device.status}<br>
            `;
        } else if (platform === 'linux') {
            deviceInfo += `
                <strong>Driver:</strong> ${device.driver || 'ALSA'}<br>
                ${device.description ? `<strong>Description:</strong> ${device.description}<br>` : ''}
            `;
        }
        
        deviceDiv.innerHTML = deviceInfo;
        outputDeviceList.appendChild(deviceDiv);
    });
    
    outputDeviceInfo.style.display = 'block';
    
    // Log detailed info to console
    console.log('Native Audio Output Devices:', devices);
}

// Enumerate native OS output devices
enumerateOutputDevicesBtn.addEventListener('click', async () => {
    try {
        updateStatus('Enumerating native OS audio output devices...', 'info');
        
        // Check if native audio APIs are available
        if (!window.nativeAudio) {
            updateStatus('❌ Native audio APIs not available. Please restart the app.', 'error');
            return;
        }
        
        // Get platform info
        const platform = window.platform ? window.platform.getPlatform() : 'unknown';
        const arch = window.platform ? window.platform.getArch() : 'unknown';
        
        console.log(`Platform: ${platform}, Architecture: ${arch}`);
        
        // Get native output devices
        const result = await window.nativeAudio.getNativeOutputDevices();
        
        if (result.error) {
            updateStatus(`❌ Error getting native output devices: ${result.error}`, 'error');
            return;
        }
        
        if (!result.devices || result.devices.length === 0) {
            updateStatus('⚠️ No native audio output devices found.', 'error');
            return;
        }
        
        // Display native output device information
        displayOutputDevices(result.devices, result.platform);
        
        updateStatus(`✓ Found ${result.devices.length} native audio output device(s) on ${result.platform}.`, 'success');
        
    } catch (error) {
        console.error('Error enumerating native output devices:', error);
        updateStatus(`❌ Error: ${error.message}`, 'error');
    }
});

requestPermissionBtn.addEventListener('click', async () => {
    try {
        const selectedDeviceId = microphoneSelect.value;
        if (!selectedDeviceId) {
            updateStatus('❌ Please select a microphone first.', 'error');
            return;
        }
        
        updateStatus('Requesting permission for selected microphone...', 'info');
        
        // Request microphone permission for specific device
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                deviceId: { exact: selectedDeviceId }
            }
        });
        
        const selectedDevice = availableDevices.find(device => device.deviceId === selectedDeviceId);
        updateStatus(`✓ Permission granted for: ${selectedDevice.label || 'Selected microphone'}. You can now start recording.`, 'success');
        
        // Enable recording buttons and disable device selection
        startRecordingBtn.disabled = false;
        requestPermissionBtn.disabled = true;
        enumerateDevicesBtn.disabled = true;
        microphoneSelect.disabled = true;
        
        // Set up MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            // Create audio blob and URL
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create audio element for playback
            const audio = document.createElement('audio');
            audio.src = audioUrl;
            audio.controls = true;
            audio.style.marginTop = '20px';
            audio.style.width = '100%';
            
            // Clear previous recordings and add new one
            audioContainer.innerHTML = '<h3>Recorded Audio:</h3>';
            audioContainer.appendChild(audio);
            
            // Reset for next recording
            audioChunks = [];
            updateStatus('Recording stopped. You can play back your audio below.', 'success');
        };
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        
        if (error.name === 'NotAllowedError') {
            updateStatus('❌ Microphone permission denied. Please allow microphone access and try again.', 'error');
        } else if (error.name === 'NotFoundError') {
            updateStatus('❌ No microphone found. Please check your audio devices.', 'error');
        } else {
            updateStatus(`❌ Error accessing microphone: ${error.message}`, 'error');
        }
    }
});

startRecordingBtn.addEventListener('click', () => {
    if (mediaRecorder && stream) {
        audioChunks = []; // Clear previous chunks
        mediaRecorder.start();
        
        updateStatus('🎤 Recording in progress...', 'info');
        startRecordingBtn.disabled = true;
        stopRecordingBtn.disabled = false;
    }
});

stopRecordingBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        
        startRecordingBtn.disabled = false;
        stopRecordingBtn.disabled = true;
    }
});

// Clean up when window is closed
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});