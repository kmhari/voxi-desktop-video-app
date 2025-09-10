// main.c - JSON output for Electron integration
#include <stdio.h>
#include "audio_devices.h"

// Escape JSON string
void print_json_string(const char* str) {
    printf("\"");
    for (int i = 0; str[i] != '\0'; i++) {
        switch (str[i]) {
            case '"':
                printf("\\\"");
                break;
            case '\\':
                printf("\\\\");
                break;
            case '\n':
                printf("\\n");
                break;
            case '\r':
                printf("\\r");
                break;
            case '\t':
                printf("\\t");
                break;
            default:
                printf("%c", str[i]);
                break;
        }
    }
    printf("\"");
}

int main() {
    AudioDevice* devices = NULL;
    int count = list_audio_output_devices(&devices);
    
    printf("{\n");
    printf("  \"devices\": [\n");
    
    for (int i = 0; i < count; i++) {
        printf("    {\n");
        printf("      \"name\": ");
        print_json_string(devices[i].name);
        printf(",\n");
        printf("      \"id\": ");
        print_json_string(devices[i].id);
        printf(",\n");
        printf("      \"type\": ");
        print_json_string(device_type_to_string(devices[i].type));
        printf(",\n");
        printf("      \"connection\": ");
        print_json_string(connection_type_to_string(devices[i].connection));
        printf(",\n");
        printf("      \"is_default\": %s\n", devices[i].is_default ? "true" : "false");
        printf("    }");
        if (i < count - 1) {
            printf(",");
        }
        printf("\n");
    }
    
    printf("  ],\n");
    printf("  \"count\": %d\n", count);
    printf("}\n");
    
    free_audio_devices(devices);
    return 0;
}