# Audio Device Detection Script for Windows
Write-Host "=== AUDIO OUTPUT DEVICES DETECTION ===" -ForegroundColor Cyan
Write-Host ""

# Method 1: Using Win32_SoundDevice (WMI)
Write-Host "Method 1: Win32_SoundDevice (WMI)" -ForegroundColor Yellow
Write-Host "----------------------------------------"
$soundDevices = Get-CimInstance -ClassName Win32_SoundDevice
if ($soundDevices) {
    foreach ($device in $soundDevices) {
        Write-Host "Device Name: $($device.Name)" -ForegroundColor Green
        Write-Host "  Manufacturer: $($device.Manufacturer)"
        Write-Host "  Device ID: $($device.DeviceID)"
        Write-Host "  Status: $($device.Status)"
        Write-Host "  PNP Device ID: $($device.PNPDeviceID)"
        Write-Host ""
    }
} else {
    Write-Host "No devices found with Win32_SoundDevice" -ForegroundColor Red
}

Write-Host ""
Write-Host "Method 2: Audio Endpoints (MMDevice API via COM)" -ForegroundColor Yellow
Write-Host "----------------------------------------"

Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class AudioDevice
{
    public string Name { get; set; }
    public string Id { get; set; }
    public string State { get; set; }
    public bool IsDefault { get; set; }
}

public class AudioDeviceEnumerator
{
    [DllImport("ole32.dll")]
    static extern int CoInitialize(IntPtr pvReserved);
    
    [DllImport("ole32.dll")]
    static extern void CoUninitialize();
    
    public static List<AudioDevice> GetAudioDevices()
    {
        var devices = new List<AudioDevice>();
        
        // This is a simplified version - full COM interop would be more complex
        // For now, we'll use the .NET wrapper approach
        
        return devices;
    }
}
"@

# Method 3: Using Get-AudioDevice if available (Windows 10/11)
Write-Host ""
Write-Host "Method 3: System Audio Devices (Registry)" -ForegroundColor Yellow
Write-Host "----------------------------------------"

# Check audio devices in registry
$audioKeys = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture"
)

foreach ($key in $audioKeys) {
    if (Test-Path $key) {
        $type = if ($key -like "*Render*") { "OUTPUT (Speakers/Headphones)" } else { "INPUT (Microphones)" }
        Write-Host "$type Devices:" -ForegroundColor Cyan
        
        $devices = Get-ChildItem $key -ErrorAction SilentlyContinue
        foreach ($device in $devices) {
            $props = Get-ItemProperty "$($device.PSPath)\Properties" -ErrorAction SilentlyContinue
            if ($props) {
                $name = [System.Text.Encoding]::Unicode.GetString($props."{a45c254e-df1c-4efd-8020-67d146a850e0},2")
                if ($name) {
                    $cleanName = $name -replace '[^\x20-\x7E]', ''
                    if ($cleanName.Trim()) {
                        Write-Host "  - $cleanName"
                    }
                }
            }
        }
        Write-Host ""
    }
}

# Method 4: Using PnP Devices
Write-Host "Method 4: PnP Audio Devices" -ForegroundColor Yellow
Write-Host "----------------------------------------"
$pnpDevices = Get-PnpDevice -Class "AudioEndpoint" -Status OK -ErrorAction SilentlyContinue
if ($pnpDevices) {
    foreach ($device in $pnpDevices) {
        Write-Host "Device: $($device.FriendlyName)" -ForegroundColor Green
        Write-Host "  Status: $($device.Status)"
        Write-Host "  Class: $($device.Class)"
        Write-Host "  Instance ID: $($device.InstanceId)"
        Write-Host ""
    }
} else {
    Write-Host "No PnP audio endpoints found or access denied" -ForegroundColor Yellow
}

# Method 5: Default Audio Device
Write-Host ""
Write-Host "Method 5: Default Audio Playback Device (Registry)" -ForegroundColor Yellow
Write-Host "----------------------------------------"
$defaultRender = Get-ItemProperty "HKCU:\Software\Microsoft\Multimedia\Sound Mapper" -Name "Playback" -ErrorAction SilentlyContinue
if ($defaultRender) {
    Write-Host "Default Playback Device ID: $($defaultRender.Playback)" -ForegroundColor Green
} else {
    Write-Host "Could not determine default playback device from registry" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DETECTION COMPLETE ===" -ForegroundColor Cyan