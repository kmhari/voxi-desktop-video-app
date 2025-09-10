// Removed input/recording functionality - only supporting output devices
const enumerateOutputDevicesBtn = document.getElementById('enumerateOutputDevices');
const outputDeviceInfo = document.getElementById('outputDeviceInfo');
const outputDeviceList = document.getElementById('outputDeviceList');
const statusDiv = document.getElementById('status');

function updateStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

// Removed enumerate audio input devices functionality - only supporting output devices

// Removed native input device enumeration functionality - only supporting output devices

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

// Removed microphone permission and recording functionality - only supporting output devices

// Calculate similarity between device names for intelligent matching
function calculateDeviceSimilarity(nativeName, webLabel) {
    const native = nativeName.toLowerCase().trim();
    const web = webLabel.toLowerCase().trim();
    
    let score = 0;
    let matchType = '';
    let confidence = 'low';
    
    // Exact match (highest priority)
    if (native === web) {
        score = 100;
        matchType = 'name-exact';
        confidence = 'high';
        return { score, matchType, confidence };
    }
    
    // Check for exact substring matches (very high priority)
    if (native.includes(web) || web.includes(native)) {
        const shorter = native.length < web.length ? native : web;
        const longer = native.length < web.length ? web : native;
        const ratio = shorter.length / longer.length;
        
        score = 85 + (ratio * 10); // 85-95 range
        matchType = 'name-substring';
        confidence = ratio > 0.7 ? 'high' : 'medium';
        return { score, matchType, confidence };
    }
    
    // Keyword-based matching for common audio device terms
    const keywords = ['speaker', 'headphone', 'headset', 'earbud', 'airpods', 'bluetooth', 'usb', 'hdmi', 'realtek', 'nvidia', 'amd', 'intel'];
    const nativeKeywords = keywords.filter(keyword => native.includes(keyword));
    const webKeywords = keywords.filter(keyword => web.includes(keyword));
    const commonKeywords = nativeKeywords.filter(keyword => webKeywords.includes(keyword));
    
    if (commonKeywords.length > 0) {
        score = 60 + (commonKeywords.length * 10); // 60-90 range based on keyword matches
        matchType = 'keywords-match';
        confidence = commonKeywords.length > 1 ? 'medium' : 'low';
        
        // Boost score for device type keywords
        if (commonKeywords.some(keyword => ['speaker', 'headphone', 'headset', 'earbud'].includes(keyword))) {
            score += 10;
            confidence = 'medium';
        }
        
        return { score, matchType, confidence };
    }
    
    // Fuzzy string similarity using Levenshtein-like approach
    const similarity = calculateStringSimilarity(native, web);
    if (similarity > 0.6) {
        score = similarity * 60; // 36-60 range
        matchType = 'fuzzy-similarity';
        confidence = similarity > 0.8 ? 'medium' : 'low';
        return { score, matchType, confidence };
    }
    
    // Check for manufacturer or brand matches
    const brands = ['apple', 'beats', 'sony', 'bose', 'sennheiser', 'jabra', 'logitech', 'corsair', 'razer', 'steelseries'];
    const nativeBrands = brands.filter(brand => native.includes(brand));
    const webBrands = brands.filter(brand => web.includes(brand));
    const commonBrands = nativeBrands.filter(brand => webBrands.includes(brand));
    
    if (commonBrands.length > 0) {
        score = 40 + (commonBrands.length * 10);
        matchType = 'brand-match';
        confidence = 'low';
        return { score, matchType, confidence };
    }
    
    return { score: 0, matchType: 'no-match', confidence: 'none' };
}

// Simple string similarity calculator (Dice coefficient)
function calculateStringSimilarity(str1, str2) {
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    
    const intersection = bigrams1.filter(bigram => bigrams2.includes(bigram));
    return (2 * intersection.length) / (bigrams1.length + bigrams2.length);
}

// Get bigrams (pairs of consecutive characters) from a string
function getBigrams(str) {
    const bigrams = [];
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.push(str.slice(i, i + 2));
    }
    return bigrams;
}

// Cross-reference native devices with Web Audio API
async function crossReferenceDevices() {
    try {
        updateStatus('Cross-referencing device IDs...', 'info');
        
        // Get native devices from C library
        const crossRefResult = await window.nativeAudio.getCrossReferencedDevices();
        
        // Get Web Audio API devices (only output devices to match our native library)
        const webAudioDevices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = webAudioDevices.filter(device => 
            device.kind === 'audiooutput' && 
            device.deviceId !== 'default' && 
            device.deviceId !== 'communications'
        );
        
        console.log('Native devices:', crossRefResult.nativeDevices);
        console.log('Web Audio devices:', audioOutputs);
        
        // Create matching table with best-match algorithm
        const matches = [];
        const matchedNativeIds = new Set();
        const matchedWebIds = new Set();
        
        // Calculate similarity scores for all device pairs
        const devicePairs = [];
        
        crossRefResult.nativeDevices.forEach((nativeDevice) => {
            audioOutputs.forEach((webDevice) => {
                if (webDevice.label && nativeDevice.name) {
                    const similarity = calculateDeviceSimilarity(nativeDevice.name, webDevice.label);
                    if (similarity.score > 0) {
                        devicePairs.push({
                            native: nativeDevice,
                            webAudio: webDevice,
                            similarity: similarity,
                            score: similarity.score
                        });
                    }
                }
            });
        });
        
        // Sort pairs by similarity score (highest first) and then by confidence
        devicePairs.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score; // Higher score first
            }
            // If scores are equal, prefer higher confidence matches
            const confidenceOrder = { high: 3, medium: 2, low: 1 };
            return confidenceOrder[b.similarity.confidence] - confidenceOrder[a.similarity.confidence];
        });
        
        // Process pairs in order of best matches first
        devicePairs.forEach(pair => {
            // Skip if either device is already matched
            if (matchedNativeIds.has(pair.native.id) || matchedWebIds.has(pair.webAudio.deviceId)) {
                return;
            }
            
            // Create the match
            matches.push({
                native: pair.native,
                webAudio: pair.webAudio,
                matchType: pair.similarity.matchType,
                confidence: pair.similarity.confidence,
                score: pair.score
            });
            
            // Mark both devices as matched
            matchedNativeIds.add(pair.native.id);
            matchedWebIds.add(pair.webAudio.deviceId);
        });
        
        // Create unmatched lists by filtering out matched devices
        const unmatchedNative = crossRefResult.nativeDevices.filter(device => !matchedNativeIds.has(device.id));
        const unmatchedWeb = audioOutputs.filter(device => !matchedWebIds.has(device.deviceId));
        
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
                'name-exact': 'Exact Name Match',
                'name-substring': 'Substring Match',
                'keywords-match': 'Keyword Match',
                'fuzzy-similarity': 'Fuzzy Text Similarity',
                'brand-match': 'Brand/Manufacturer Match',
                'name-partial': 'Partial Name Match', // Legacy fallback
                'no-match': 'No Match'
            };
            
            html += `
                <div style="background: #d4edda; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${confidenceColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 1.1em;">Match ${index + 1}</strong>
                        <span style="background: ${confidenceColor}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">
                            ${match.confidence.toUpperCase()} CONFIDENCE
                        </span>
                    </div>
                    <p style="margin: 5px 0;">
                        <strong>Strategy:</strong> ${matchTypeLabels[match.matchType] || match.matchType}
                        ${match.score ? `<span style="color: #6c757d; font-size: 0.9em;"> (Score: ${Math.round(match.score)}/100)</span>` : ''}
                    </p>
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