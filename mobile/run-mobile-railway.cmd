@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=C:\src\flutter\bin;%JAVA_HOME%\bin;%ANDROID_HOME%\emulator;%ANDROID_HOME%\platform-tools;%PATH%"

set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "MOBILE_SRC=%REPO_ROOT%\mobile"
set "BUILD_DIR=C:\salesdoc_mobile"

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\env\switch-production-mobile.ps1"
if errorlevel 1 exit /b 1

echo === SalesDoc mobil — Railway production ===
echo Backend: https://backend-production-3cf2.up.railway.app
echo Login: slug=test1  login=agent  parol=111111
echo.

call "%MOBILE_SRC%\scripts\sync-to-build-dir.cmd"
if errorlevel 1 exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\fix-emulator-webcam.ps1" -ClearSnapshots
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\start-emulator-if-needed.ps1"
if errorlevel 1 exit /b 1

cd /d "%BUILD_DIR%"
call flutter pub get
if errorlevel 1 exit /b 1

set "EMU_ID=emulator-5554"
for /f "tokens=1" %%D in ('adb devices ^| findstr /i "emulator"') do set "EMU_ID=%%D"

echo Qurilma: !EMU_ID!
flutter run -d !EMU_ID!
endlocal
