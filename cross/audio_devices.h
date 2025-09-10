// audio_devices.h
#ifndef AUDIO_DEVICES_H
#define AUDIO_DEVICES_H

#include <stdbool.h>

// Audio device types
typedef enum {
    DEVICE_TYPE_UNKNOWN,
    DEVICE_TYPE_SPEAKERS,
    DEVICE_TYPE_HEADPHONES,
    DEVICE_TYPE_HDMI,
    DEVICE_TYPE_USB,
    DEVICE_TYPE_BLUETOOTH,
    DEVICE_TYPE_VIRTUAL
} AudioDeviceType;

// Connection types
typedef enum {
    CONNECTION_UNKNOWN,
    CONNECTION_BUILTIN,
    CONNECTION_WIRED,
    CONNECTION_WIRELESS
} AudioConnectionType;

// Audio device structure
typedef struct {
    char name[256];
    char id[256];
    char manufacturer[256];
    char model[256];
    char serial_number[256];
    AudioDeviceType type;
    AudioConnectionType connection;
    bool is_default;
    bool is_alive;
    bool is_running;
    int input_channels;
    int output_channels;
    int sample_rate;
    int bit_depth;
    float volume;
    bool is_muted;
    int device_id_numeric;
    char transport_type_name[64];
    char data_source[256];
    char clock_source[256];
} AudioDevice;

// Function prototypes
int list_audio_output_devices(AudioDevice** devices);
void free_audio_devices(AudioDevice* devices);
const char* device_type_to_string(AudioDeviceType type);
const char* connection_type_to_string(AudioConnectionType connection);

#endif // AUDIO_DEVICES_H