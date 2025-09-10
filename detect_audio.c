#include <windows.h>
#include <mmdeviceapi.h>
#include <endpointvolume.h>
#include <audioclient.h>
#include <stdio.h>
#include <functiondiscoverykeys_devpkey.h>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")

void PrintAudioDevice(IMMDevice *pDevice) {
    IPropertyStore *pProps = NULL;
    PROPVARIANT varName;
    LPWSTR pwszID = NULL;
    
    HRESULT hr = pDevice->GetId(&pwszID);
    if (SUCCEEDED(hr)) {
        wprintf(L"Device ID: %s\n", pwszID);
        CoTaskMemFree(pwszID);
    }
    
    hr = pDevice->OpenPropertyStore(STGM_READ, &pProps);
    if (SUCCEEDED(hr)) {
        PropVariantInit(&varName);
        
        hr = pProps->GetValue(PKEY_Device_FriendlyName, &varName);
        if (SUCCEEDED(hr)) {
            wprintf(L"Device Name: %s\n", varName.pwszVal);
            PropVariantClear(&varName);
        }
        
        hr = pProps->GetValue(PKEY_DeviceInterface_FriendlyName, &varName);
        if (SUCCEEDED(hr)) {
            wprintf(L"Interface Name: %s\n", varName.pwszVal);
            PropVariantClear(&varName);
        }
        
        hr = pProps->GetValue(PKEY_Device_DeviceDesc, &varName);
        if (SUCCEEDED(hr)) {
            wprintf(L"Device Description: %s\n", varName.pwszVal);
            PropVariantClear(&varName);
        }
        
        pProps->Release();
    }
    
    IMMEndpoint *pEndpoint = NULL;
    hr = pDevice->QueryInterface(__uuidof(IMMEndpoint), (void**)&pEndpoint);
    if (SUCCEEDED(hr)) {
        EDataFlow dataFlow;
        hr = pEndpoint->GetDataFlow(&dataFlow);
        if (SUCCEEDED(hr)) {
            wprintf(L"Type: %s\n", (dataFlow == eRender) ? L"Output (Speakers/Headphones)" : 
                                   (dataFlow == eCapture) ? L"Input (Microphone)" : L"Unknown");
        }
        pEndpoint->Release();
    }
    
    DWORD dwState;
    hr = pDevice->GetState(&dwState);
    if (SUCCEEDED(hr)) {
        wprintf(L"State: ");
        switch(dwState) {
            case DEVICE_STATE_ACTIVE:
                wprintf(L"Active\n");
                break;
            case DEVICE_STATE_DISABLED:
                wprintf(L"Disabled\n");
                break;
            case DEVICE_STATE_NOTPRESENT:
                wprintf(L"Not Present\n");
                break;
            case DEVICE_STATE_UNPLUGGED:
                wprintf(L"Unplugged\n");
                break;
            default:
                wprintf(L"Unknown\n");
        }
    }
    
    wprintf(L"----------------------------------------\n");
}

void DetectAudioLevels(IMMDevice *pDevice) {
    IAudioMeterInformation *pMeter = NULL;
    HRESULT hr = pDevice->Activate(__uuidof(IAudioMeterInformation), 
                                   CLSCTX_ALL, NULL, (void**)&pMeter);
    
    if (SUCCEEDED(hr)) {
        float peak = 0;
        hr = pMeter->GetPeakValue(&peak);
        if (SUCCEEDED(hr)) {
            wprintf(L"Current audio level: %.2f%%\n", peak * 100);
            
            if (peak > 0.01) {
                wprintf(L"Audio is playing!\n");
            } else {
                wprintf(L"No audio detected.\n");
            }
        }
        pMeter->Release();
    }
}

int main() {
    HRESULT hr = CoInitialize(NULL);
    if (FAILED(hr)) {
        printf("Failed to initialize COM\n");
        return 1;
    }
    
    IMMDeviceEnumerator *pEnumerator = NULL;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), NULL, CLSCTX_ALL,
                         __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator);
    
    if (FAILED(hr)) {
        printf("Failed to create device enumerator\n");
        CoUninitialize();
        return 1;
    }
    
    wprintf(L"=== AUDIO OUTPUT DEVICES (SPEAKERS/HEADPHONES) ===\n\n");
    
    IMMDeviceCollection *pCollection = NULL;
    hr = pEnumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &pCollection);
    
    if (SUCCEEDED(hr)) {
        UINT count;
        hr = pCollection->GetCount(&count);
        if (SUCCEEDED(hr)) {
            wprintf(L"Found %d active audio output device(s)\n\n", count);
            
            for (UINT i = 0; i < count; i++) {
                IMMDevice *pDevice = NULL;
                hr = pCollection->Item(i, &pDevice);
                if (SUCCEEDED(hr)) {
                    wprintf(L"Device %d:\n", i + 1);
                    PrintAudioDevice(pDevice);
                    pDevice->Release();
                }
            }
        }
        pCollection->Release();
    }
    
    wprintf(L"\n=== DEFAULT AUDIO OUTPUT DEVICE ===\n\n");
    
    IMMDevice *pDefaultDevice = NULL;
    hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDefaultDevice);
    
    if (SUCCEEDED(hr)) {
        PrintAudioDevice(pDefaultDevice);
        
        wprintf(L"=== MONITORING AUDIO OUTPUT LEVELS ===\n");
        wprintf(L"Press Ctrl+C to stop monitoring...\n\n");
        
        while (1) {
            DetectAudioLevels(pDefaultDevice);
            Sleep(100);
            
            system("cls");
            wprintf(L"=== AUDIO OUTPUT LEVEL MONITOR ===\n");
            DetectAudioLevels(pDefaultDevice);
            
            IAudioMeterInformation *pMeter = NULL;
            hr = pDefaultDevice->Activate(__uuidof(IAudioMeterInformation), 
                                         CLSCTX_ALL, NULL, (void**)&pMeter);
            
            if (SUCCEEDED(hr)) {
                float peak = 0;
                hr = pMeter->GetPeakValue(&peak);
                if (SUCCEEDED(hr)) {
                    int barLength = (int)(peak * 50);
                    wprintf(L"\nAudio Level: [");
                    for (int i = 0; i < 50; i++) {
                        if (i < barLength) {
                            wprintf(L"#");
                        } else {
                            wprintf(L"-");
                        }
                    }
                    wprintf(L"] %.1f%%\n", peak * 100);
                }
                pMeter->Release();
            }
        }
        
        pDefaultDevice->Release();
    } else {
        wprintf(L"No default audio output device found\n");
    }
    
    pEnumerator->Release();
    CoUninitialize();
    
    return 0;
}