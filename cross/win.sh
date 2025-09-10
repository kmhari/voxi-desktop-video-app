# Using MinGW
gcc -D_WIN32 -DINITGUID -Wall -Wextra -O2 main.c audio_devices.c -o list_audio_devices.exe -lole32 -loleaut32 -luuid -lpropsys -lmmdevapi

# Using Visual Studio Developer Command Prompt
# cl /D_WIN32 main.c audio_devices.c /Felist_audio_devices.exe ole32.lib oleaut32.lib uuid.lib