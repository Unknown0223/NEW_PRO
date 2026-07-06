@echo off
chcp 65001 >nul
REM SALEC — mobil APK (Railway production API) + serverga yuklash
REM Papka: E:\SALEC — копия\deploy-mobile-prod.cmd
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC mobil APK (production)
echo   Loyiha: %REPO_ROOT%
echo ========================================
echo.

call "%REPO_ROOT%\mobile\build-apk-railway.cmd"
if errorlevel 1 exit /b 1

echo.
echo Serverga APK yuklanmoqda (Railway API)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\railway\upload-mobile-apk-prod.ps1"
if errorlevel 1 (
  echo.
  echo APK yuklash xato. Qo'lda: Sozlamalar - Mobil ilova
  exit /b 1
)

echo.
echo Tayyor: agentlar ilova ichida yangilash dialogini oladi.
echo.
endlocal
