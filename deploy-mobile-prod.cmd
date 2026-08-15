@echo off
chcp 65001 >nul
REM SALEC — mobil APK (Railway production API) + serverga yuklash
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC mobil APK (production)
echo   Loyiha: %REPO_ROOT%
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\railway\deploy-all.ps1" -SkipWeb
if errorlevel 1 (
  echo.
  echo Mobil deploy xato.
  exit /b 1
)

echo.
echo Tayyor: agentlar ilova ichida yangilash dialogini oladi.
echo.
endlocal
