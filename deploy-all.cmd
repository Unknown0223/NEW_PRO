@echo off
chcp 65001 >nul
REM SALEC — to'liq production deploy (backend + frontend + mobil APK)
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC TO'LIQ DEPLOY
echo   Backend + Frontend + Mobil APK
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\railway\deploy-all.ps1" %*
if errorlevel 1 (
  echo.
  echo XATO. Batafsil log yuqorida.
  exit /b 1
)
endlocal
