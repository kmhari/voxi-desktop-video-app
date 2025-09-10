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
        updateStatus('Checking audio permissions...', 'info');
        
        // Check if we have permission first
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' }).catch(() => null);
        
        if (permissionStatus && permissionStatus.state === 'denied') {
            updateStatus('❌ Microphone access denied. Please grant permission in your browser settings.', 'error');
            return;
        }
        
        // First request basic permission to enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        if (audioInputs.length === 0) {
            updateStatus('❌ No audio input devices found. Please check your audio settings.', 'error');
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
            updateStatus('❌ Native audio APIs not available. Please check if the app has proper permissions.', 'error');
            console.error('window.nativeAudio is not available');
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
            if (result.permissionDenied) {
                updateStatus(`⚠️ ${result.error}`, 'warning');
                // Show permission dialog button for Windows
                if (platform === 'win32') {
                    const btn = document.createElement('button');
                    btn.textContent = 'Open Windows Settings';
                    btn.onclick = () => window.nativeAudio.requestMicrophonePermission();
                    nativeDeviceInfo.appendChild(btn);
                }
            } else {
                updateStatus(`❌ Error getting native devices: ${result.error}`, 'error');
            }
            return;
        }
        
        if (!result.devices || result.devices.length === 0) {
            updateStatus('⚠️ No native audio devices found. Please check your audio hardware and drivers.', 'warning');
            nativeDeviceInfo.style.display = 'block';
            nativeDeviceList.innerHTML = '<p style="color: #666;">No audio devices detected. This could mean:<br>• Audio drivers are not installed<br>• Audio devices are disabled<br>• Permission is required</p>';
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

function displayOutputDevices(devices, platform, source) {
    outputDeviceList.innerHTML = '';
    
    devices.forEach((device, index) => {
        const deviceDiv = document.createElement('div');
        const isNativeSource = source === 'native-c' || device.source === 'native-c';
        const borderColor = isNativeSource ? '#dc3545' : '#28a745';
        const backgroundColor = isNativeSource ? '#fff5f5' : '#f8fff9';
        
        deviceDiv.style.cssText = `
            border: 1px solid ${borderColor};
            border-radius: 5px;
            padding: 15px;
            margin: 10px 0;
            background: ${backgroundColor};
        `;
        
        let deviceInfo = `
            <strong>Output Device ${index + 1}:</strong> ${device.name}<br>
            <strong>ID:</strong> ${device.id}<br>
            <strong>Platform:</strong> ${platform}<br>
            <strong>Type:</strong> <span style="color: #007bff;">${device.deviceType || 'unknown'}</span><br>
            <strong>Connectivity:</strong> <span style="color: #28a745;">${device.connectivity || 'unknown'}</span><br>
        `;
        
        // Show source information with enhanced details
        if (isNativeSource) {
            deviceInfo += `<strong>Source:</strong> <span style="color: #dc3545; font-weight: bold;">Native C Library</span><br>`;
            if (device.isDefault) {
                deviceInfo += `<strong>Status:</strong> <span style="color: #ffc107; font-weight: bold;">🔊 Default Device</span><br>`;
            }
        } else {
            const sourceLabels = {
                'windows-modern-api': '🪟 Windows Modern API',
                'windows-wmi': '🪟 Windows WMI',
                'windows-api': '🪟 Windows API'
            };
            const sourceLabel = sourceLabels[device.source] || 'Platform API';
            deviceInfo += `<strong>Source:</strong> <span style="color: #6c757d;">${sourceLabel}</span><br>`;
            
            if (device.isDefault) {
                deviceInfo += `<strong>Status:</strong> <span style="color: #ffc107; font-weight: bold;">🔊 Default Device</span><br>`;
            }
        }
        
        // Platform-specific information
        if (platform === 'darwin') {
            deviceInfo += `
                <strong>Manufacturer:</strong> ${device.manufacturer || 'N/A'}<br>
                <strong>Output Channels:</strong> ${device.outputChannels || 'N/A'}<br>
                <strong>Sample Rate:</strong> ${device.sampleRate || 'N/A'}<br>
            `;
        } else if (platform === 'win32') {
            deviceInfo += `
                <strong>Manufacturer:</strong> ${device.manufacturer || 'N/A'}<br>
                <strong>Status:</strong> ${device.status || 'N/A'}<br>
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
        displayOutputDevices(result.devices, result.platform, result.source);
        
        let sourceLabel = '';
        if (result.source === 'native-c') {
            sourceLabel = ' (Native C Library)';
        } else if (result.source === 'windows-modern-api') {
            sourceLabel = ' (Windows Modern API)';
        } else if (result.source === 'windows-wmi') {
            sourceLabel = ' (Windows WMI)';
        }
        
        const defaultDevices = result.devices.filter(device => device.isDefault).length;
        const defaultLabel = defaultDevices > 0 ? ` - ${defaultDevices} default` : '';
        
        updateStatus(`✓ Found ${result.devices.length} native audio output device(s) on ${result.platform}${sourceLabel}${defaultLabel}.`, 'success');
        
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
        
        // Check system-level permission first (for Electron)
        if (window.nativeAudio && window.nativeAudio.checkMicrophonePermission) {
            const permissionCheck = await window.nativeAudio.checkMicrophonePermission();
            if (permissionCheck.status === 'denied') {
                const requestResult = await window.nativeAudio.requestMicrophonePermission();
                if (!requestResult.granted) {
                    updateStatus('❌ Microphone permission denied at system level. Please check your system settings.', 'error');
                    return;
                }
            }
        }
        
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

// Cross-reference native devices with Web Audio API
async function crossReferenceDevices() {
    try {
        updateStatus('Cross-referencing device IDs...', 'info');
        
        // Get native devices from C library
        const crossRefResult = await window.nativeAudio.getCrossReferencedDevices();
        
        // Get Web Audio API devices
        const webAudioDevices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = webAudioDevices.filter(device => device.kind === 'audiooutput');
        
        console.log('Native devices:', crossRefResult.nativeDevices);
        console.log('Web Audio devices:', audioOutputs);
        
        // Create matching table
        const matches = [];
        const unmatchedNative = [...crossRefResult.nativeDevices];
        const unmatchedWeb = [...audioOutputs];
        
        // Enhanced device matching with multiple strategies
        crossRefResult.nativeDevices.forEach((nativeDevice, nativeIndex) => {
            audioOutputs.forEach((webDevice, webIndex) => {
                let matchFound = false;
                let matchType = '';
                let confidence = 'low';
                
                // Strategy 1: Direct ID comparison (rare but possible)
                if (nativeDevice.id === webDevice.deviceId || 
                    nativeDevice.id.includes(webDevice.deviceId) ||
                    webDevice.deviceId.includes(nativeDevice.id)) {
                    matchFound = true;
                    matchType = 'id-exact';
                    confidence = 'high';
                }
                
                // Strategy 2: Name-based matching (most reliable for cross-API correlation)
                else if (webDevice.label && nativeDevice.name) {
                    const webLabel = webDevice.label.toLowerCase().trim();
                    const nativeName = nativeDevice.name.toLowerCase().trim();
                    
                    // Exact name match
                    if (webLabel === nativeName) {
                        matchFound = true;
                        matchType = 'name-exact';
                        confidence = 'high';
                    }
                    // Partial name match (contains)
                    else if (webLabel.includes(nativeName) || nativeName.includes(webLabel)) {
                        matchFound = true;
                        matchType = 'name-partial';
                        confidence = 'medium';
                    }
                    // Device type and key words matching
                    else {
                        const webWords = webLabel.split(/[\s\-\(\)]+/).filter(w => w.length > 2);
                        const nativeWords = nativeName.split(/[\s\-\(\)]+/).filter(w => w.length > 2);
                        
                        let commonWords = 0;
                        webWords.forEach(webWord => {
                            nativeWords.forEach(nativeWord => {
                                if (webWord.includes(nativeWord) || nativeWord.includes(webWord)) {
                                    commonWords++;
                                }
                            });
                        });
                        
                        // If at least 2 common words found
                        if (commonWords >= 2) {
                            matchFound = true;
                            matchType = 'name-keywords';
                            confidence = 'medium';
                        }
                        // For built-in devices, try type matching
                        else if ((webLabel.includes('built') || webLabel.includes('internal') || 
                                 webLabel.includes('default') || webLabel.includes('speaker') ||
                                 webLabel.includes('headphone')) &&
                                (nativeName.includes('built') || nativeName.includes('speaker') ||
                                 nativeName.includes('headphone') || nativeName.includes('external'))) {
                            
                            // Match built-in types
                            if ((webLabel.includes('speaker') && nativeName.includes('speaker')) ||
                                (webLabel.includes('headphone') && nativeName.includes('headphone'))) {
                                matchFound = true;
                                matchType = 'type-builtin';
                                confidence = 'medium';
                            }
                        }
                    }
                }
                
                // Strategy 3: Default device matching
                if (!matchFound && nativeDevice.isDefault && webDevice.deviceId === 'default') {
                    matchFound = true;
                    matchType = 'default-device';
                    confidence = 'high';
                }
                
                // Strategy 4: Device ordering correlation (last resort)
                if (!matchFound && nativeIndex === webIndex && webDevice.label && nativeDevice.name) {
                    // If they're in the same position and have some name similarity
                    const webLabel = webDevice.label.toLowerCase();
                    const nativeName = nativeDevice.name.toLowerCase();
                    if (webLabel.length > 0 && nativeName.length > 0) {
                        matchFound = true;
                        matchType = 'position-correlation';
                        confidence = 'low';
                    }
                }
                
                if (matchFound) {
                    matches.push({
                        native: nativeDevice,
                        webAudio: webDevice,
                        matchType: matchType,
                        confidence: confidence
                    });
                    
                    // Remove from unmatched lists
                    const nativeIdx = unmatchedNative.indexOf(nativeDevice);
                    const webIdx = unmatchedWeb.indexOf(webDevice);
                    if (nativeIdx > -1) unmatchedNative.splice(nativeIdx, 1);
                    if (webIdx > -1) unmatchedWeb.splice(webIdx, 1);
                }
            });
        });
        
        // Display results
        displayCrossReferenceResults(matches, unmatchedNative, unmatchedWeb, crossRefResult);
        
        updateStatus(`Cross-reference complete: ${matches.length} matches found`, 'success');
        
    } catch (error) {
        console.error('Cross-reference error:', error);
        updateStatus(`Cross-reference failed: ${error.message}`, 'error');
    }
}

// Display cross-reference results
function displayCrossReferenceResults(matches, unmatchedNative, unmatchedWeb, crossRefResult) {
    // Create or update cross-reference section
    let crossRefSection = document.getElementById('crossReferenceSection');
    if (!crossRefSection) {
        crossRefSection = document.createElement('div');
        crossRefSection.id = 'crossReferenceSection';
        crossRefSection.innerHTML = `
            <h3>🔗 Device ID Cross-Reference Results</h3>
            <div id="crossRefContent"></div>
        `;
        document.body.appendChild(crossRefSection);
    }
    
    const content = document.getElementById('crossRefContent');
    let html = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
            <h4>📊 Cross-Reference Analysis Summary</h4>
            <p><strong>Platform:</strong> ${crossRefResult.platform}</p>
            <p><strong>Source:</strong> ${crossRefResult.source}</p>
            <p><strong>Total Native Devices:</strong> ${crossRefResult.nativeDevices.length}</p>
            <p><strong>Total Web Audio Devices:</strong> ${matches.length + unmatchedWeb.length}</p>
            <p><strong>Successfully Matched:</strong> ${matches.length} <span style="color: #28a745;">✓</span></p>
            <p><strong>Unmatched Native:</strong> ${unmatchedNative.length} <span style="color: #ffc107;">⚠</span></p>
            <p><strong>Unmatched Web Audio:</strong> ${unmatchedWeb.length} <span style="color: #dc3545;">⚠</span></p>
            <p><strong>Match Rate:</strong> ${crossRefResult.nativeDevices.length > 0 ? Math.round((matches.length / crossRefResult.nativeDevices.length) * 100) : 0}%</p>
            <hr>
            <p style="font-size: 0.9em; color: #6c757d;">
                <strong>Note:</strong> Web Audio API uses encrypted/hashed device IDs for security. 
                Matching is primarily done via device names and characteristics rather than raw device IDs.
            </p>
        </div>
    `;
    
    // Show matches
    if (matches.length > 0) {
        html += '<h4>✅ Successfully Matched Devices</h4>';
        // Sort matches by confidence level
        const sortedMatches = matches.sort((a, b) => {
            const confidenceOrder = { high: 3, medium: 2, low: 1 };
            return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        });
        
        sortedMatches.forEach((match, index) => {
            const confidenceColor = {
                high: '#28a745',
                medium: '#ffc107', 
                low: '#6c757d'
            }[match.confidence];
            
            const matchTypeLabels = {
                'id-exact': 'Direct ID Match',
                'name-exact': 'Exact Name Match',
                'name-partial': 'Partial Name Match',
                'name-keywords': 'Keyword Match',
                'type-builtin': 'Built-in Type Match',
                'default-device': 'Default Device Match',
                'position-correlation': 'Position Correlation'
            };
            
            html += `
                <div style="background: #d4edda; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${confidenceColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 1.1em;">Match ${index + 1}</strong>
                        <span style="background: ${confidenceColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">
                            ${match.confidence.toUpperCase()} CONFIDENCE
                        </span>
                    </div>
                    <p style="margin: 5px 0;"><strong>Strategy:</strong> ${matchTypeLabels[match.matchType] || match.matchType}</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                            <strong style="color: #495057;">🔧 Native System API</strong><br>
                            <strong>Name:</strong> ${match.native.name}<br>
                            <strong>ID:</strong> <code style="font-size: 0.8em; background: #e9ecef; padding: 2px 4px; border-radius: 3px;">${match.native.id}</code><br>
                            <strong>Type:</strong> ${match.native.deviceType} | <strong>Connection:</strong> ${match.native.connectivity}
                            ${match.native.isDefault ? '<br><span style="color: #ffc107;">🔊 Default Device</span>' : ''}
                        </div>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                            <strong style="color: #495057;">🌐 Web Audio API</strong><br>
                            <strong>Label:</strong> ${match.webAudio.label}<br>
                            <strong>Device ID:</strong> <code style="font-size: 0.8em; background: #e9ecef; padding: 2px 4px; border-radius: 3px;">${match.webAudio.deviceId}</code><br>
                            <strong>Group ID:</strong> <code style="font-size: 0.8em; background: #e9ecef; padding: 2px 4px; border-radius: 3px;">${match.webAudio.groupId}</code>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    // Show unmatched native devices
    if (unmatchedNative.length > 0) {
        html += '<h4>⚠️ Unmatched Native Devices</h4>';
        unmatchedNative.forEach(device => {
            html += `
                <div style="background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 5px;">
                    <strong>${device.name}</strong><br>
                    ID: ${device.id}<br>
                    Type: ${device.deviceType} | Connectivity: ${device.connectivity}
                </div>
            `;
        });
    }
    
    // Show unmatched web audio devices
    if (unmatchedWeb.length > 0) {
        html += '<h4>⚠️ Unmatched Web Audio Devices</h4>';
        unmatchedWeb.forEach(device => {
            html += `
                <div style="background: #f8d7da; padding: 10px; margin: 5px 0; border-radius: 5px;">
                    <strong>${device.label || 'Unknown Device'}</strong><br>
                    ID: ${device.deviceId}<br>
                    Group ID: ${device.groupId}
                </div>
            `;
        });
    }
    
    content.innerHTML = html;
}

// Add cross-reference button to the UI
document.addEventListener('DOMContentLoaded', () => {
    // Find a good place to add the button (after enumerate output devices button)
    const outputDevicesBtn = document.getElementById('enumerateOutputDevices');
    if (outputDevicesBtn) {
        const crossRefBtn = document.createElement('button');
        crossRefBtn.textContent = '🔗 Cross-Reference Device IDs';
        crossRefBtn.id = 'crossReferenceBtn';
        crossRefBtn.style.cssText = `
            background: #17a2b8;
            color: white;
            border: none;
            padding: 12px 24px;
            margin: 10px 5px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
        `;
        
        crossRefBtn.addEventListener('click', crossReferenceDevices);
        
        // Insert after the output devices button
        outputDevicesBtn.parentNode.insertBefore(crossRefBtn, outputDevicesBtn.nextSibling);
    }
});