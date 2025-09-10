CC = cl
CFLAGS = /W3 /O2
TARGET = detect_audio.exe
SOURCE = detect_audio.c

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CC) $(CFLAGS) $(SOURCE) /Fe$(TARGET)

clean:
	del $(TARGET) *.obj

run: $(TARGET)
	$(TARGET)