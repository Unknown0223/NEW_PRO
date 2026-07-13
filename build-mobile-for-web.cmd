@echo off
chcp 65001 >nul
REM Mobil APK yig'ish (production API) — veb panelga qo'lda yuklash uchun.
REM Natija: mobile\releases\SalesDoc-latest-release.apk
setlocal EnableDelayedExpansion
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC mobil APK — veb uchun tayyorlash
echo   Versiya: pubspec.yaml dan olinadi
echo ========================================
echo.
echo DIQQAT: run-mobile.cmd / emulyator to'xtatilgan bo'lsin.
echo.

call "%REPO_ROOT%\mobile\build-apk-railway.cmd"
if errorlevel 1 (
  echo.
  echo [XATO] APK yig'ilmadi. Gradle qulfi bo'lsa:
  echo   cd C:\salesdoc_mobile\android ^&^& gradlew --stop
  echo   yoki Android Studio / emulyatorni yoping va qayta urining.
  exit /b 1
)

echo.
echo Tayyor fayllar:
echo   %REPO_ROOT%mobile\releases\SalesDoc-latest-release.apk
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '%REPO_ROOT%mobile\pubspec.yaml' | Select-String '^version:' | ForEach-Object { $_ -replace 'version:\s*','' -replace '\+.*','' }).ToString().Trim()"`) do (
  echo   %REPO_ROOT%mobile\releases\SalesDoc-%%V-release.apk
)
echo.
echo Veb panel: Sozlamalar - Mobil ilova
echo   https://sales-arena.up.railway.app/settings/mobile-app
echo.
endlocal
