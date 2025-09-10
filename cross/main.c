// main.c - Example usage
#include <stdio.h>
#include "audio_devices.h"

int main() {
    AudioDevice* devices = NULL;
    int count = list_audio_output_devices(&devices);
    
    printf("Found %d audio output device(s):\n\n", count);
    
    for (int i = 0; i < count; i++) {
        printf("Device %d:\n", i + 1);
        printf("  Name: %s\n", devices[i].name);
        printf("  ID: %s\n", devices[i].id);
        printf("  Type: %s\n", device_type_to_string(devices[i].type));
        printf("  Connection: %s\n", connection_type_to_string(devices[i].connection));
        if (devices[i].is_default) {
            printf("  [DEFAULT DEVICE]\n");
        }
        printf("\n");
    }
    
    free_audio_devices(devices);
    return 0;
}