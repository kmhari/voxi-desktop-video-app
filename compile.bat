@echo off
echo Compiling Audio Detection Program...
cl /W3 /O2 detect_audio.c /Fedetect_audio.exe
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Compilation successful! Running the program...
    echo.
    detect_audio.exe
) else (
    echo.
    echo Compilation failed. Please check the error messages above.
)