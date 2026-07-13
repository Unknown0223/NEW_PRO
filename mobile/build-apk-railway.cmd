@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=C:\Users\botir\flutter\bin;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "MOBILE_SRC=%REPO_ROOT%\mobile"
set "BUILD_DIR=C:\salesdoc_mobile"
set "APK=%BUILD_DIR%\build\app\outputs\flutter-apk\app-release.apk"
set "RELEASES=%MOBILE_SRC%\releases"
set "RELEASE_APK=%RELEASES%\SalesDoc-latest-release.apk"

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\env\switch-production-mobile.ps1"
if errorlevel 1 exit /b 1

echo === SalesDoc APK (Railway production) ===
echo Loyiha: %REPO_ROOT%
echo Server: https://backend-production-3cf2.up.railway.app
echo.

call "%MOBILE_SRC%\scripts\sync-to-build-dir.cmd"

cd /d "%BUILD_DIR%"
call flutter pub get
if errorlevel 1 exit /b 1

echo APK yig'ilmoqda...
call flutter build apk --release --no-tree-shake-icons
if errorlevel 1 exit /b 1

if exist "%RELEASES%" mkdir "%RELEASES%"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '%MOBILE_SRC%\pubspec.yaml' | Select-String '^version:' | ForEach-Object { $_ -replace 'version:\s*','' -replace '\+.*','' }).ToString().Trim()"`) do set "APP_VER=%%V"
copy /Y "%APK%" "%RELEASE_APK%" >nul
if defined APP_VER copy /Y "%APK%" "%RELEASES%\SalesDoc-!APP_VER!-release.apk" >nul
for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "TODAY=%%D"
copy /Y "%APK%" "%RELEASES%\SalesDoc-%TODAY%-release.apk" >nul

echo.
echo Tayyor:
echo   %APK%
echo   %RELEASE_APK%
echo.
echo Telefonga o'rnatish:
echo   1) APK ni telefonga yuboring (USB / Telegram / Google Drive)
echo   2) Noma'lum manbalar ruxsatini yoqing
echo   3) APK ni ochib o'rnating (oldingi versiyani almashtiradi)
echo.
echo Veb panel: https://sales-arena.up.railway.app
echo Mobil kirish: slug=test1 + agent login/parol
echo.
echo DIQQAT: APK o'zi yangilanmaydi — har yangilashda qayta o'rnatish kerak.
echo Admin panel: Sozlamalar - Mobil ilova - APK ni serverga yuklash (agentlar ilova ichida yangilaydi).
echo.

adb devices | findstr /i "device" >nul
if not errorlevel 1 (
  set /p INSTALL="USB orqali o'rnatilsinmi? (y/N): "
  if /i "!INSTALL!"=="y" adb install -r "%APK%"
)

explorer /select,"%RELEASE_APK%"
endlocal
