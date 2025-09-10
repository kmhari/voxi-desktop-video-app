# How to Install a C Compiler on Windows

You need a C compiler to compile `detect_audio.c`. Here are your options:

## Option 1: MinGW-w64 (Recommended - Easiest)

### Method A: Using Installer
1. Download from: https://github.com/niXman/mingw-builds-binaries/releases
2. Choose: `x86_64-13.2.0-release-win32-seh-msvcrt-rt_v11-rev0.7z`
3. Extract to `C:\mingw64`
4. Add `C:\mingw64\bin` to your PATH environment variable

### Method B: Using MSYS2
1. Download MSYS2 from: https://www.msys2.org/
2. Run the installer
3. After installation, open MSYS2 terminal and run:
   ```bash
   pacman -S mingw-w64-x86_64-gcc
   ```

## Option 2: Visual Studio Build Tools

1. Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
2. Run the installer
3. Select "Desktop development with C++"
4. Install (about 2-3 GB)

## Option 3: TCC (Tiny C Compiler - Smallest)

1. Download from: http://download.savannah.gnu.org/releases/tinycc/tcc-0.9.27-win64-bin.zip
2. Extract to `C:\tcc`
3. Add `C:\tcc` to your PATH

## After Installing Any Compiler:

1. Open a new Command Prompt (to refresh PATH)
2. Run: `compile_audio.bat`

The batch file will automatically detect and use whichever compiler you installed.

## Quick Test

After installing, test your compiler:
- MinGW: `gcc --version`
- Visual Studio: `cl`
- TCC: `tcc -version`