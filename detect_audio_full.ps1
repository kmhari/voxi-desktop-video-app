# Full Audio Device Detection Script (No compilation needed)
param(
    [switch]$Monitor = $false
)

Write-Host "=== WINDOWS AUDIO DEVICE DETECTION ===" -ForegroundColor Cyan
Write-Host "Running comprehensive audio device detection..." -ForegroundColor Yellow
Write-Host ""

# Function to get audio device details
function Get-AudioDeviceDetails {
    $result = @{
        WMIDevices = @()
        PnPDevices = @()
        AudioEndpoints = @()
        DefaultDevice = $null
    }
    
    # 1. WMI Sound Devices
    Write-Host "1. Detecting WMI Sound Devices..." -ForegroundColor Green
    try {
        $wmiDevices = Get-CimInstance -ClassName Win32_SoundDevice
        foreach ($device in $wmiDevices) {
            $deviceInfo = @{
                Name = $device.Name
                Manufacturer = $device.Manufacturer
                DeviceID = $device.DeviceID
                Status = $device.Status
                Type = if ($device.Name -match "Realtek|AMD|Intel|NVIDIA") { "Integrated" } else { "External" }
            }
            $result.WMIDevices += $deviceInfo
            
            Write-Host "  Found: $($device.Name)" -ForegroundColor White
            Write-Host "    Manufacturer: $($device.Manufacturer)"
            Write-Host "    Status: $($device.Status)"
            Write-Host "    Device ID: $($device.DeviceID)"
            Write-Host ""
        }
    } catch {
        Write-Host "  Error getting WMI devices: $_" -ForegroundColor Red
    }
    
    # 2. PnP Audio Endpoints
    Write-Host "2. Detecting Audio Endpoints..." -ForegroundColor Green
    try {
        $endpoints = Get-PnpDevice -Class "AudioEndpoint" -Status OK
        foreach ($endpoint in $endpoints) {
            $endpointInfo = @{
                Name = $endpoint.FriendlyName
                InstanceId = $endpoint.InstanceId
                Status = $endpoint.Status
                Type = if ($endpoint.FriendlyName -match "Speaker|Headphone") { "Output" } 
                       elseif ($endpoint.FriendlyName -match "Microphone|Mic") { "Input" } 
                       else { "Unknown" }
            }
            $result.AudioEndpoints += $endpointInfo
            
            Write-Host "  Found: $($endpoint.FriendlyName)" -ForegroundColor White
            Write-Host "    Type: $($endpointInfo.Type)"
            Write-Host "    Status: $($endpoint.Status)"
            Write-Host ""
        }
    } catch {
        Write-Host "  Error getting audio endpoints: $_" -ForegroundColor Red
    }
    
    # 3. MMDevice Audio Devices (via Registry)
    Write-Host "3. Detecting MMDevice Registry Entries..." -ForegroundColor Green
    $audioKeys = @{
        "Output" = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render"
        "Input" = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture"
    }
    
    foreach ($type in $audioKeys.Keys) {
        $path = $audioKeys[$type]
        if (Test-Path $path) {
            Write-Host "  $type Devices:" -ForegroundColor Cyan
            $devices = Get-ChildItem $path -ErrorAction SilentlyContinue
            $count = 0
            foreach ($device in $devices) {
                try {
                    $props = Get-ItemProperty "$($device.PSPath)\Properties" -ErrorAction SilentlyContinue
                    if ($props) {
                        # Try to get device name from registry
                        $deviceState = (Get-ItemProperty $device.PSPath -Name "DeviceState" -ErrorAction SilentlyContinue).DeviceState
                        if ($deviceState -eq 1) {  # 1 = Active
                            $count++
                            Write-Host "    - Device GUID: $($device.PSChildName)" -ForegroundColor Gray
                        }
                    }
                } catch {
                    # Ignore errors for individual devices
                }
            }
            if ($count -eq 0) {
                Write-Host "    No active devices found" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    return $result
}

# Function to monitor audio levels
function Monitor-AudioLevels {
    Write-Host "4. Monitoring Audio Activity..." -ForegroundColor Green
    Write-Host "Checking for audio playback (press Ctrl+C to stop)..." -ForegroundColor Yellow
    Write-Host ""
    
    while ($true) {
        # Get current audio session information
        $sessions = @(Get-Process | Where-Object {
            $_.ProcessName -match "spotify|chrome|firefox|edge|vlc|wmplayer|iTunes|foobar|winamp|audacity" -or
            $_.MainWindowTitle -ne ""
        } | Where-Object {
            $_.CPU -gt 0
        })
        
        Clear-Host
        Write-Host "=== AUDIO ACTIVITY MONITOR ===" -ForegroundColor Cyan
        Write-Host "Time: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White
        Write-Host ""
        
        if ($sessions.Count -gt 0) {
            Write-Host "Potential Audio Applications Running:" -ForegroundColor Green
            foreach ($session in $sessions | Select-Object -First 5) {
                Write-Host "  - $($session.ProcessName): $($session.MainWindowTitle)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "No known audio applications detected" -ForegroundColor Gray
        }
        
        Start-Sleep -Seconds 2
    }
}

# Main execution
$devices = Get-AudioDeviceDetails

# Summary
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "WMI Sound Devices: $($devices.WMIDevices.Count)" -ForegroundColor White
Write-Host "Audio Endpoints: $($devices.AudioEndpoints.Count)" -ForegroundColor White
Write-Host "  - Output Devices: $(($devices.AudioEndpoints | Where-Object { $_.Type -eq 'Output' }).Count)" -ForegroundColor White
Write-Host "  - Input Devices: $(($devices.AudioEndpoints | Where-Object { $_.Type -eq 'Input' }).Count)" -ForegroundColor White
Write-Host ""

# Export to JSON
$jsonPath = ".\audio_devices.json"
$devices | ConvertTo-Json -Depth 3 | Out-File $jsonPath
Write-Host "Detailed device information saved to: $jsonPath" -ForegroundColor Green
Write-Host ""

if ($Monitor) {
    Monitor-AudioLevels
} else {
    Write-Host "Run with -Monitor flag to monitor audio activity" -ForegroundColor Gray
    Write-Host "Example: .\detect_audio_full.ps1 -Monitor" -ForegroundColor Gray
}