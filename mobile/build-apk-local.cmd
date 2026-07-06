@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
REM Lokal sinov APK — API: .env.local (emulyatorda 10.0.2.2:18080)
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=C:\Users\botir\flutter\bin;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "MOBILE_SRC=%REPO_ROOT%\mobile"
set "BUILD_DIR=C:\salesdoc_mobile"
set "APK=%BUILD_DIR%\build\app\outputs\flutter-apk\app-release.apk"

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\env\switch-local.ps1"
if errorlevel 1 exit /b 1

echo === SalesDoc APK (LOKAL server — sinov) ===
echo API: http://127.0.0.1:18080  (emulyator: 10.0.2.2)
echo.

call "%MOBILE_SRC%\scripts\sync-to-build-dir.cmd"

cd /d "%BUILD_DIR%"
call flutter pub get
if errorlevel 1 exit /b 1

echo APK yig'ilmoqda (APP_ENV=local)...
call flutter build apk --release --no-tree-shake-icons --dart-define=APP_ENV=local
if errorlevel 1 exit /b 1

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '%MOBILE_SRC%\pubspec.yaml' | Select-String '^version:' | ForEach-Object { $_ -replace 'version:\s*','' -replace '\+.*','' }).ToString().Trim()"`) do set "APP_VER=%%V"

set "RELEASES=%MOBILE_SRC%\releases"
if not exist "%RELEASES%" mkdir "%RELEASES%"
copy /Y "%APK%" "%RELEASES%\SalesDoc-local-!APP_VER!-release.apk" >nul

echo.
echo Tayyor: %RELEASES%\SalesDoc-local-!APP_VER!-release.apk
echo.
echo Keyingi qadam:
echo   adb reverse tcp:18080 tcp:18080
echo   adb install -r "%RELEASES%\SalesDoc-local-!APP_VER!-release.apk"
echo   Veb: http://127.0.0.1:3000/settings/mobile-app
echo.
endlocal
