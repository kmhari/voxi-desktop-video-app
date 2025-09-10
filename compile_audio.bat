@echo off
echo ========================================
echo Audio Detection Program Compiler
echo ========================================
echo.

REM Try different compilers

REM 1. Try MinGW gcc
where gcc >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found GCC compiler, compiling...
    gcc detect_audio_simple.c -o detect_audio_simple.exe -lole32 -loleaut32
    if %ERRORLEVEL% EQU 0 (
        echo Compilation successful with GCC!
        echo Running the program...
        echo.
        detect_audio_simple.exe
        goto end
    ) else (
        echo GCC compilation failed.
    )
)

REM 2. Try Visual Studio cl.exe
where cl >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found Visual Studio compiler, compiling...
    cl /W3 /O2 detect_audio_simple.c /Fedetect_audio_simple.exe
    if %ERRORLEVEL% EQU 0 (
        echo Compilation successful with Visual Studio!
        echo Running the program...
        echo.
        detect_audio_simple.exe
        goto end
    ) else (
        echo Visual Studio compilation failed.
    )
)

REM 3. Try TCC (Tiny C Compiler) if installed
where tcc >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Found TCC compiler, compiling...
    tcc detect_audio_simple.c -o detect_audio_simple.exe
    if %ERRORLEVEL% EQU 0 (
        echo Compilation successful with TCC!
        echo Running the program...
        echo.
        detect_audio_simple.exe
        goto end
    ) else (
        echo TCC compilation failed.
    )
)

echo.
echo ========================================
echo No C compiler found in PATH!
echo ========================================
echo.
echo To compile this program, you need one of:
echo.
echo 1. MinGW GCC:
echo    - Download from: https://www.mingw-w64.org/
echo    - Or install via: winget install -e --id MinGW.MinGW
echo.
echo 2. Visual Studio Build Tools:
echo    - Download from: https://visualstudio.microsoft.com/downloads/
echo    - Select "Desktop development with C++"
echo.
echo 3. TCC (Tiny C Compiler) - Lightweight option:
echo    - Download from: http://download.savannah.gnu.org/releases/tinycc/
echo.
echo After installing, make sure the compiler is in your PATH.
echo.

:end
pause