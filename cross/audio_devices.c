// audio_devices.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "audio_devices.h"

#ifdef _WIN32
#include <windows.h>
#include <mmdeviceapi.h>
#include <functiondiscoverykeys_devpkey.h>
#include <propidl.h>
#include <combaseapi.h>
#include <ctype.h>

// Windows implementation
int list_audio_output_devices(AudioDevice** devices) {
    HRESULT hr;
    IMMDeviceEnumerator* pEnumerator = NULL;
    IMMDeviceCollection* pCollection = NULL;
    IMMDevice* pDefaultDevice = NULL;
    LPWSTR defaultDeviceId = NULL;
    
    *devices = NULL;
    int device_count = 0;
    
    // Initialize COM
    hr = CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    if (FAILED(hr)) return 0;
    
    // Create device enumerator
    hr = CoCreateInstance(
        &CLSID_MMDeviceEnumerator, NULL,
        CLSCTX_ALL, &IID_IMMDeviceEnumerator,
        (void**)&pEnumerator
    );
    
    if (SUCCEEDED(hr)) {
        // Get default device
        hr = pEnumerator->lpVtbl->GetDefaultAudioEndpoint(
            pEnumerator, eRender, eConsole, &pDefaultDevice
        );
        if (SUCCEEDED(hr)) {
            pDefaultDevice->lpVtbl->GetId(pDefaultDevice, &defaultDeviceId);
        }
        
        // Get all active audio endpoints
        hr = pEnumerator->lpVtbl->EnumAudioEndpoints(
            pEnumerator, eRender, DEVICE_STATE_ACTIVE, &pCollection
        );
        
        if (SUCCEEDED(hr)) {
            UINT count;
            pCollection->lpVtbl->GetCount(pCollection, &count);
            
            // Allocate memory for devices
            *devices = (AudioDevice*)calloc(count + 1, sizeof(AudioDevice));
            if (*devices == NULL) {
                pCollection->lpVtbl->Release(pCollection);
                pEnumerator->lpVtbl->Release(pEnumerator);
                CoUninitialize();
                return 0;
            }
            
            // Enumerate devices
            for (UINT i = 0; i < count; i++) {
                IMMDevice* pDevice = NULL;
                hr = pCollection->lpVtbl->Item(pCollection, i, &pDevice);
                
                if (SUCCEEDED(hr)) {
                    IPropertyStore* pProps = NULL;
                    LPWSTR deviceId = NULL;
                    
                    // Get device ID
                    pDevice->lpVtbl->GetId(pDevice, &deviceId);
                    
                    // Open property store
                    hr = pDevice->lpVtbl->OpenPropertyStore(
                        pDevice, STGM_READ, &pProps
                    );
                    
                    if (SUCCEEDED(hr)) {
                        PROPVARIANT varName, varType;
                        PropVariantInit(&varName);
                        PropVariantInit(&varType);
                        
                        // Get device friendly name
                        hr = pProps->lpVtbl->GetValue(
                            pProps, &PKEY_Device_FriendlyName, &varName
                        );
                        if (SUCCEEDED(hr)) {
                            WideCharToMultiByte(CP_UTF8, 0, varName.pwszVal, -1,
                                (*devices)[device_count].name, 256, NULL, NULL);
                        }
                        
                        // Get device ID
                        if (deviceId) {
                            WideCharToMultiByte(CP_UTF8, 0, deviceId, -1,
                                (*devices)[device_count].id, 256, NULL, NULL);
                                
                            // Check if default device
                            if (defaultDeviceId && wcscmp(deviceId, defaultDeviceId) == 0) {
                                (*devices)[device_count].is_default = true;
                            }
                        }
                        
                        // Get form factor
                        hr = pProps->lpVtbl->GetValue(
                            pProps, &PKEY_AudioEndpoint_FormFactor, &varType
                        );
                        if (SUCCEEDED(hr)) {
                            switch (varType.uintVal) {
                                case 0: // RemoteSpeakers
                                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                                    (*devices)[device_count].connection = CONNECTION_WIRELESS;
                                    break;
                                case 1: // Speakers
                                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                                    (*devices)[device_count].connection = CONNECTION_BUILTIN;
                                    break;
                                case 2: // LineLevel
                                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 3: // Headphones
                                    (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 4: // Microphone
                                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 5: // Headset
                                    (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 6: // Handset
                                    (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 7: // UnknownDigitalPassthrough
                                    (*devices)[device_count].type = DEVICE_TYPE_UNKNOWN;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 8: // SPDIF
                                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 9: // DigitalAudioDisplayDevice/HDMI
                                    (*devices)[device_count].type = DEVICE_TYPE_HDMI;
                                    (*devices)[device_count].connection = CONNECTION_WIRED;
                                    break;
                                case 10: // UnknownFormFactor
                                default:
                                    (*devices)[device_count].type = DEVICE_TYPE_UNKNOWN;
                                    (*devices)[device_count].connection = CONNECTION_UNKNOWN;
                            }
                        }
                        
                        // Check device name for additional hints (convert to lowercase for comparison)
                        char name_lower[256];
                        strcpy(name_lower, (*devices)[device_count].name);
                        for (int j = 0; name_lower[j]; j++) {
                            name_lower[j] = tolower(name_lower[j]);
                        }
                        
                        // Check for headphone/headset keywords in device name
                        if (strstr(name_lower, "headphone") != NULL || 
                            strstr(name_lower, "headset") != NULL ||
                            strstr(name_lower, "earphone") != NULL ||
                            strstr(name_lower, "earbuds") != NULL) {
                            (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
                            // Keep existing connection type unless it's unknown
                            if ((*devices)[device_count].connection == CONNECTION_UNKNOWN) {
                                (*devices)[device_count].connection = CONNECTION_WIRED;
                            }
                        }
                        
                        // Check for Bluetooth or USB in device ID or name
                        if (strstr((*devices)[device_count].id, "BTHENUM") != NULL ||
                            strstr(name_lower, "bluetooth") != NULL ||
                            strstr(name_lower, "airpods") != NULL) {
                            (*devices)[device_count].type = DEVICE_TYPE_BLUETOOTH;
                            (*devices)[device_count].connection = CONNECTION_WIRELESS;
                        } else if (strstr((*devices)[device_count].id, "USB") != NULL ||
                                   strstr(name_lower, "usb") != NULL) {
                            // USB devices could be headphones, check name
                            if (strstr(name_lower, "headphone") != NULL || 
                                strstr(name_lower, "headset") != NULL) {
                                (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
                            } else {
                                (*devices)[device_count].type = DEVICE_TYPE_USB;
                            }
                            (*devices)[device_count].connection = CONNECTION_WIRED;
                        }
                        
                        PropVariantClear(&varName);
                        PropVariantClear(&varType);
                        pProps->lpVtbl->Release(pProps);
                        device_count++;
                    }
                    
                    if (deviceId) CoTaskMemFree(deviceId);
                    pDevice->lpVtbl->Release(pDevice);
                }
            }
            
            pCollection->lpVtbl->Release(pCollection);
        }
        
        if (pDefaultDevice) pDefaultDevice->lpVtbl->Release(pDefaultDevice);
        if (defaultDeviceId) CoTaskMemFree(defaultDeviceId);
        pEnumerator->lpVtbl->Release(pEnumerator);
    }
    
    CoUninitialize();
    return device_count;
}

#elif defined(__APPLE__)
#include <CoreAudio/CoreAudio.h>
#include <CoreFoundation/CoreFoundation.h>

// macOS implementation
int list_audio_output_devices(AudioDevice** devices) {
    AudioObjectPropertyAddress propertyAddress = {
        kAudioHardwarePropertyDevices,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMaster
    };
    
    UInt32 dataSize = 0;
    OSStatus status = AudioObjectGetPropertyDataSize(
        kAudioObjectSystemObject,
        &propertyAddress,
        0, NULL,
        &dataSize
    );
    
    if (status != noErr) return 0;
    
    int device_count = 0;
    int numDevices = dataSize / sizeof(AudioDeviceID);
    AudioDeviceID* audioDevices = (AudioDeviceID*)malloc(dataSize);
    
    status = AudioObjectGetPropertyData(
        kAudioObjectSystemObject,
        &propertyAddress,
        0, NULL,
        &dataSize,
        audioDevices
    );
    
    if (status != noErr) {
        free(audioDevices);
        return 0;
    }
    
    // Get default device
    AudioDeviceID defaultDevice = 0;
    propertyAddress.mSelector = kAudioHardwarePropertyDefaultOutputDevice;
    dataSize = sizeof(AudioDeviceID);
    AudioObjectGetPropertyData(
        kAudioObjectSystemObject,
        &propertyAddress,
        0, NULL,
        &dataSize,
        &defaultDevice
    );
    
    // Allocate memory for devices
    *devices = (AudioDevice*)calloc(numDevices + 1, sizeof(AudioDevice));
    if (*devices == NULL) {
        free(audioDevices);
        return 0;
    }
    
    for (int i = 0; i < numDevices; i++) {
        // Check if device has output channels
        propertyAddress.mSelector = kAudioDevicePropertyStreamConfiguration;
        propertyAddress.mScope = kAudioDevicePropertyScopeOutput;
        
        status = AudioObjectGetPropertyDataSize(
            audioDevices[i],
            &propertyAddress,
            0, NULL,
            &dataSize
        );
        
        if (status != noErr) continue;
        
        AudioBufferList* bufferList = (AudioBufferList*)malloc(dataSize);
        status = AudioObjectGetPropertyData(
            audioDevices[i],
            &propertyAddress,
            0, NULL,
            &dataSize,
            bufferList
        );
        
        int outputChannels = 0;
        if (status == noErr) {
            for (int j = 0; j < bufferList->mNumberBuffers; j++) {
                outputChannels += bufferList->mBuffers[j].mNumberChannels;
            }
        }
        free(bufferList);
        
        if (outputChannels == 0) continue;
        
        // Get device name
        propertyAddress.mSelector = kAudioDevicePropertyDeviceNameCFString;
        propertyAddress.mScope = kAudioObjectPropertyScopeGlobal;
        CFStringRef deviceName = NULL;
        dataSize = sizeof(CFStringRef);
        
        status = AudioObjectGetPropertyData(
            audioDevices[i],
            &propertyAddress,
            0, NULL,
            &dataSize,
            &deviceName
        );
        
        if (status == noErr && deviceName != NULL) {
            CFStringGetCString(
                deviceName,
                (*devices)[device_count].name,
                256,
                kCFStringEncodingUTF8
            );
            CFRelease(deviceName);
        }
        
        // Get device UID
        propertyAddress.mSelector = kAudioDevicePropertyDeviceUID;
        CFStringRef deviceUID = NULL;
        dataSize = sizeof(CFStringRef);
        
        status = AudioObjectGetPropertyData(
            audioDevices[i],
            &propertyAddress,
            0, NULL,
            &dataSize,
            &deviceUID
        );
        
        if (status == noErr && deviceUID != NULL) {
            CFStringGetCString(
                deviceUID,
                (*devices)[device_count].id,
                256,
                kCFStringEncodingUTF8
            );
            CFRelease(deviceUID);
        }
        
        // Check if default device
        if (audioDevices[i] == defaultDevice) {
            (*devices)[device_count].is_default = true;
        }
        
        // Get transport type
        propertyAddress.mSelector = kAudioDevicePropertyTransportType;
        UInt32 transportType = 0;
        dataSize = sizeof(UInt32);
        
        status = AudioObjectGetPropertyData(
            audioDevices[i],
            &propertyAddress,
            0, NULL,
            &dataSize,
            &transportType
        );
        
        if (status == noErr) {
            switch (transportType) {
                case kAudioDeviceTransportTypeBuiltIn:
                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                    (*devices)[device_count].connection = CONNECTION_BUILTIN;
                    break;
                case kAudioDeviceTransportTypeBluetooth:
                    (*devices)[device_count].type = DEVICE_TYPE_BLUETOOTH;
                    (*devices)[device_count].connection = CONNECTION_WIRELESS;
                    break;
                case kAudioDeviceTransportTypeUSB:
                    (*devices)[device_count].type = DEVICE_TYPE_USB;
                    (*devices)[device_count].connection = CONNECTION_WIRED;
                    break;
                case kAudioDeviceTransportTypeThunderbolt:
                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                    (*devices)[device_count].connection = CONNECTION_WIRED;
                    break;
                case kAudioDeviceTransportTypeAirPlay:
                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                    (*devices)[device_count].connection = CONNECTION_WIRELESS;
                    break;
                case kAudioDeviceTransportTypeVirtual:
                    (*devices)[device_count].type = DEVICE_TYPE_VIRTUAL;
                    (*devices)[device_count].connection = CONNECTION_UNKNOWN;
                    break;
                case kAudioDeviceTransportTypeDisplayPort:
                case kAudioDeviceTransportTypeHDMI:
                    (*devices)[device_count].type = DEVICE_TYPE_HDMI;
                    (*devices)[device_count].connection = CONNECTION_WIRED;
                    break;
                default:
                    (*devices)[device_count].type = DEVICE_TYPE_UNKNOWN;
                    (*devices)[device_count].connection = CONNECTION_UNKNOWN;
            }
        }
        
        // Check device name for additional hints
        char* name_lower = strdup((*devices)[device_count].name);
        for (int j = 0; name_lower[j]; j++) {
            name_lower[j] = tolower(name_lower[j]);
        }
        
        if (strstr(name_lower, "headphone") != NULL) {
            (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
        } else if (strstr(name_lower, "airpods") != NULL) {
            (*devices)[device_count].type = DEVICE_TYPE_BLUETOOTH;
            (*devices)[device_count].connection = CONNECTION_WIRELESS;
        }
        
        free(name_lower);
        device_count++;
    }
    
    free(audioDevices);
    return device_count;
}

#elif defined(__linux__)
#include <alsa/asoundlib.h>
#include <ctype.h>

// Linux implementation using ALSA
int list_audio_output_devices(AudioDevice** devices) {
    int device_count = 0;
    int card = -1;
    int max_devices = 32;
    
    *devices = (AudioDevice*)calloc(max_devices, sizeof(AudioDevice));
    if (*devices == NULL) return 0;
    
    // Enumerate sound cards
    while (snd_card_next(&card) >= 0 && card >= 0) {
        if (device_count >= max_devices - 1) break;
        
        char hw_name[32];
        snd_ctl_t* ctl;
        snd_ctl_card_info_t* info;
        
        snprintf(hw_name, sizeof(hw_name), "hw:%d", card);
        
        if (snd_ctl_open(&ctl, hw_name, 0) < 0) continue;
        
        snd_ctl_card_info_alloca(&info);
        if (snd_ctl_card_info(ctl, info) < 0) {
            snd_ctl_close(ctl);
            continue;
        }
        
        // Get card name and driver
        const char* card_name = snd_ctl_card_info_get_name(info);
        const char* driver = snd_ctl_card_info_get_driver(info);
        
        // Enumerate PCM devices on this card
        int dev = -1;
        while (snd_ctl_pcm_next_device(ctl, &dev) >= 0 && dev >= 0) {
            if (device_count >= max_devices - 1) break;
            
            snd_pcm_info_t* pcminfo;
            snd_pcm_info_alloca(&pcminfo);
            snd_pcm_info_set_device(pcminfo, dev);
            snd_pcm_info_set_subdevice(pcminfo, 0);
            snd_pcm_info_set_stream(pcminfo, SND_PCM_STREAM_PLAYBACK);
            
            if (snd_ctl_pcm_info(ctl, pcminfo) >= 0) {
                // Create device entry
                snprintf((*devices)[device_count].name, 256, "%s - %s",
                    card_name, snd_pcm_info_get_name(pcminfo));
                snprintf((*devices)[device_count].id, 256, "hw:%d,%d", card, dev);
                
                // Determine device type based on driver and name
                char name_lower[256];
                strcpy(name_lower, (*devices)[device_count].name);
                for (int i = 0; name_lower[i]; i++) {
                    name_lower[i] = tolower(name_lower[i]);
                }
                
                if (strstr(name_lower, "hdmi") != NULL) {
                    (*devices)[device_count].type = DEVICE_TYPE_HDMI;
                    (*devices)[device_count].connection = CONNECTION_WIRED;
                } else if (strstr(driver, "USB") != NULL || strstr(name_lower, "usb") != NULL) {
                    (*devices)[device_count].type = DEVICE_TYPE_USB;
                    (*devices)[device_count].connection = CONNECTION_WIRED;
                } else if (strstr(name_lower, "bluetooth") != NULL) {
                    (*devices)[device_count].type = DEVICE_TYPE_BLUETOOTH;
                    (*devices)[device_count].connection = CONNECTION_WIRELESS;
                } else if (strstr(name_lower, "headphone") != NULL) {
                    (*devices)[device_count].type = DEVICE_TYPE_HEADPHONES;
                    (*devices)[device_count].connection = CONNECTION_WIRED;
                } else if (strstr(driver, "HDA") != NULL) {
                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                    (*devices)[device_count].connection = CONNECTION_BUILTIN;
                } else {
                    (*devices)[device_count].type = DEVICE_TYPE_SPEAKERS;
                    (*devices)[device_count].connection = CONNECTION_UNKNOWN;
                }
                
                device_count++;
            }
        }
        
        snd_ctl_close(ctl);
    }
    
    // Try to get default device from ALSA configuration
    if (device_count > 0) {
        snd_config_t* config;
        snd_config_update();
        if (snd_config_search(snd_config, "defaults.pcm.card", &config) >= 0) {
            long card_num;
            if (snd_config_get_integer(config, &card_num) >= 0) {
                for (int i = 0; i < device_count; i++) {
                    char default_id[32];
                    snprintf(default_id, sizeof(default_id), "hw:%ld,0", card_num);
                    if (strcmp((*devices)[i].id, default_id) == 0) {
                        (*devices)[i].is_default = true;
                        break;
                    }
                }
            }
        }
    }
    
    return device_count;
}

#endif

// Common functions
void free_audio_devices(AudioDevice* devices) {
    if (devices) {
        free(devices);
    }
}

const char* device_type_to_string(AudioDeviceType type) {
    switch (type) {
        case DEVICE_TYPE_SPEAKERS: return "Speakers";
        case DEVICE_TYPE_HEADPHONES: return "Headphones";
        case DEVICE_TYPE_HDMI: return "HDMI";
        case DEVICE_TYPE_USB: return "USB Audio";
        case DEVICE_TYPE_BLUETOOTH: return "Bluetooth";
        case DEVICE_TYPE_VIRTUAL: return "Virtual";
        default: return "Unknown";
    }
}

const char* connection_type_to_string(AudioConnectionType connection) {
    switch (connection) {
        case CONNECTION_BUILTIN: return "Built-in";
        case CONNECTION_WIRED: return "Wired";
        case CONNECTION_WIRELESS: return "Wireless";
        default: return "Unknown";
    }
}