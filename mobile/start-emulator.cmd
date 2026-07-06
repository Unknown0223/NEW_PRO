@echo off
chcp 65001 >nul
setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "FLUTTER_HOME="
for /f "delims=" %%F in ('where flutter 2^>nul') do (
  if not defined FLUTTER_HOME for %%I in ("%%~dpF..") do set "FLUTTER_HOME=%%~fI"
)
if not defined FLUTTER_HOME if exist "C:\src\flutter\bin\flutter.bat" set "FLUTTER_HOME=C:\src\flutter"
if not defined FLUTTER_HOME (
  echo Xato: Flutter topilmadi.
  pause
  exit /b 1
)
set "PATH=%FLUTTER_HOME%\bin;%JAVA_HOME%\bin;%ANDROID_HOME%\emulator;%ANDROID_HOME%\platform-tools;%PATH%"

if "%~1"=="" (
  echo Emulyatorlar:
  flutter emulators
  echo.
  echo Ishlatish: start-emulator.cmd pixel7 ^| pixel8 ^| tablet
  exit /b 0
)

if /i "%~1"=="pixel7" set "AVD=salesdoc_pixel7"
if /i "%~1"=="pixel8" set "AVD=salesdoc_pixel8"
if /i "%~1"=="pixel9" set "AVD=Pixel_9a"
if /i "%~1"=="tablet" set "AVD=salesdoc_tablet"
if not defined AVD set "AVD=%~1"

set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\fix-emulator-webcam.ps1" -ClearSnapshots -AvdNames @('%AVD%')
set "EMU_CAMERA_ARGS=-camera-back emulated"
if exist "%TEMP%\salec-emulator-camera.args" set /p EMU_CAMERA_ARGS=<"%TEMP%\salec-emulator-camera.args"
echo Emulyator ishga tushmoqda: %AVD% (%EMU_CAMERA_ARGS%)
start "" emulator -avd %AVD% -no-snapshot-load -no-snapshot-save -no-boot-anim -gpu auto %EMU_CAMERA_ARGS%
echo Kutib turing... adb qurilma tayyor bo'lguncha.
adb wait-for-device
echo Tayyor.
