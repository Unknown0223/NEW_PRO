@echo off
chcp 65001 >nul
REM SALEC — Hetzner production deploy (salesarena.sale)
REM Faqat veb:     deploy-prod.cmd
REM Veb + mobil:   deploy-prod.cmd -AdminPassword "PAROL"
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC production deploy (Hetzner)
echo   https://salesarena.sale
echo   Loyiha: %REPO_ROOT%
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
  echo Deploy xato. Tekshiring: SSH kalit %%USERPROFILE%%\.ssh\salec_hetzner
  exit /b 1
)

echo.
echo Veb:   https://salesarena.sale/login   ^(slug: aksit^)
echo API:   https://api.salesarena.sale/health
echo.
endlocal
