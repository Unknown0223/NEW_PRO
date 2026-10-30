@echo off
chcp 65001 >nul
REM SALEC — Hetzner deploy (deploy-prod.cmd bilan bir xil)
REM Mobil: deploy-all.cmd -AdminPassword "PAROL"
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC DEPLOY (Hetzner)
echo   https://salesarena.sale
echo ========================================
echo.

set "EXTRA_ARGS=%*"
echo %*| findstr /I /C:"-SkipMobile" /C:"-AdminPassword" /C:"-SkipWeb" >nul
if errorlevel 1 (
  set "EXTRA_ARGS=-SkipMobile %*"
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\hetzner\deploy-all.ps1" %EXTRA_ARGS%
if errorlevel 1 (
  echo.
  echo XATO. Batafsil log yuqorida.
  exit /b 1
)
endlocal
