gcc -D__APPLE__ -Wall -Wextra -O2 main.c audio_devices.c -o list_audio_devices -framework CoreAudio -framework CoreFoundation
