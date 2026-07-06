@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%ANDROID_HOME%\emulator;%ANDROID_HOME%\platform-tools;%PATH%"

set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo === Emulyator (kamera avtomatik) ===
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\fix-emulator-webcam.ps1" -ClearSnapshots
if errorlevel 1 exit /b 1

echo.
echo Eski emulyator to'xtatilmoqda...
adb -s emulator-5554 emu kill >nul 2>&1
taskkill /F /IM qemu-system-x86_64.exe >nul 2>&1
taskkill /F /IM emulator.exe >nul 2>&1
timeout /t 3 /nobreak >nul

set "AVD=salesdoc_pixel7"
if not exist "%USERPROFILE%\.android\avd\salesdoc_pixel7.avd" set "AVD=Pixel_9a"

set "EMU_CAMERA_ARGS=-camera-back emulated"
if exist "%TEMP%\salec-emulator-camera.args" set /p EMU_CAMERA_ARGS=<"%TEMP%\salec-emulator-camera.args"
echo %AVD% ishga tushmoqda - %EMU_CAMERA_ARGS%, cold boot...
start "" "%ANDROID_HOME%\emulator\emulator.exe" -avd %AVD% -no-snapshot-load -no-snapshot-save -no-boot-anim -gpu auto %EMU_CAMERA_ARGS%

echo Kutish...
adb wait-for-device >nul 2>&1
timeout /t 20 /nobreak >nul

echo.
echo Tayyor. Emulyator oynasida kamera ochganda PC webcam ko'rinishi kerak.
echo Agar virtual uy ko'rinsa: emulyator ... ^> Camera ^> Back ^> Webcam0
echo.
pause
endlocal
