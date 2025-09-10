# Makefile
CC = gcc
CFLAGS = -Wall -Wextra -O2

# Platform detection
UNAME_S := $(shell uname -s)

# Platform-specific settings
ifeq ($(UNAME_S),Linux)
    CFLAGS += -D__linux__
    LDFLAGS = -lasound
endif

ifeq ($(UNAME_S),Darwin)
    CFLAGS += -D__APPLE__
    LDFLAGS = -framework CoreAudio -framework CoreFoundation
endif

# Windows (MinGW)
ifeq ($(OS),Windows_NT)
    CFLAGS += -D_WIN32
    LDFLAGS = -lole32 -loleaut32 -luuid
    EXE_EXT = .exe
endif

# Build targets
TARGET = list_audio_devices$(EXE_EXT)

all: $(TARGET)

$(TARGET): main.c audio_devices.c audio_devices.h
	$(CC) $(CFLAGS) main.c audio_devices.c -o $(TARGET) $(LDFLAGS)

clean:
	rm -f $(TARGET)

# Platform-specific build commands
windows:
	gcc -D_WIN32 -Wall -Wextra -O2 main.c audio_devices.c -o list_audio_devices.exe -lole32 -loleaut32 -luuid

macos:
	gcc -D__APPLE__ -Wall -Wextra -O2 main.c audio_devices.c -o list_audio_devices -framework CoreAudio -framework CoreFoundation

linux:
	gcc -D__linux__ -Wall -Wextra -O2 main.c audio_devices.c -o list_audio_devices -lasound