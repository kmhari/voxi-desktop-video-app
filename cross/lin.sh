# Make sure ALSA development libraries are installed
# Ubuntu/Debian: sudo apt-get install libasound2-dev
# Fedora: sudo dnf install alsa-lib-devel

gcc -D__linux__ -Wall -Wextra -O2 main.c audio_devices.c -o list_audio_devices -lasound