#include <windows.h>
#include <stdio.h>
#include <powrprof.h>
#pragma comment(lib, "powrprof.lib")

int main() {
    printf("=== Windows Audio Device Detection (Simple Version) ===\n\n");
    
    // Get Windows version
    OSVERSIONINFO osvi;
    ZeroMemory(&osvi, sizeof(OSVERSIONINFO));
    osvi.dwOSVersionInfoSize = sizeof(OSVERSIONINFO);
    
    printf("Windows System Information:\n");
    printf("Computer Name: %s\n", getenv("COMPUTERNAME"));
    printf("User Name: %s\n", getenv("USERNAME"));
    printf("\n");
    
    // Use WMI via PowerShell to get audio devices
    printf("Detecting audio devices using WMI...\n");
    printf("----------------------------------------\n");
    
    // Execute PowerShell command to get audio devices
    FILE *fp;
    char buffer[1024];
    
    // Get audio devices
    fp = _popen("powershell -Command \"Get-CimInstance -ClassName Win32_SoundDevice | Select-Object Name, Manufacturer, Status | Format-List\"", "r");
    if (fp == NULL) {
        printf("Failed to run PowerShell command\n");
        return 1;
    }
    
    printf("Audio Devices Found:\n\n");
    while (fgets(buffer, sizeof(buffer), fp) != NULL) {
        printf("%s", buffer);
    }
    _pclose(fp);
    
    printf("\n----------------------------------------\n");
    printf("Getting audio endpoints...\n\n");
    
    // Get audio endpoints
    fp = _popen("powershell -Command \"Get-PnpDevice -Class AudioEndpoint -Status OK | Select-Object FriendlyName, Status | Format-List\"", "r");
    if (fp == NULL) {
        printf("Failed to get audio endpoints\n");
        return 1;
    }
    
    while (fgets(buffer, sizeof(buffer), fp) != NULL) {
        printf("%s", buffer);
    }
    _pclose(fp);
    
    printf("\nPress Enter to exit...");
    getchar();
    
    return 0;
}