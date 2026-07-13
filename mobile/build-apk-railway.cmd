@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

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

powershell -NoProfile -ExecutionPolicy Bypass -Command ". '%REPO_ROOT%\scripts\env\resolve-flutter.ps1'; Set-MobileBuildEnv | Out-Null"
call "%MOBILE_SRC%\scripts\sync-to-build-dir.cmd"
if errorlevel 1 exit /b 1
robocopy "%MOBILE_SRC%\android" "%BUILD_DIR%\android" /E /XD .gradle /NFL /NDL /NJH /NJS >nul
if exist "%MOBILE_SRC%\.env" copy /Y "%MOBILE_SRC%\.env" "%BUILD_DIR%\.env" >nul

cd /d "%BUILD_DIR%"
call flutter pub get
if errorlevel 1 exit /b 1

echo APK yig'ilmoqda...
call flutter build apk --release --no-tree-shake-icons
if errorlevel 1 exit /b 1

if not exist "%RELEASES%" mkdir "%RELEASES%"
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
endlocal
