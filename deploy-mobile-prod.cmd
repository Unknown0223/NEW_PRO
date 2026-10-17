@echo off
chcp 65001 >nul
REM SALEC — mobil APK → Hetzner (salesarena.sale) OTA
REM Kerak: -AdminPassword "PAROL"
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC mobil APK (Hetzner)
echo   https://salesarena.sale
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\hetzner\deploy-all.ps1" -SkipWeb %*
if errorlevel 1 (
  echo.
  echo Mobil deploy xato. Misol: deploy-mobile-prod.cmd -AdminPassword "PAROL"
  exit /b 1
)

echo.
echo Tayyor: agentlar ixtiyoriy yangilash dialogini oladi.
echo.
endlocal
