@echo off
chcp 65001 >nul
REM SALEC — production deploy (Railway: backend + frontend)
REM Papka: E:\SALEC — копия\deploy-prod.cmd
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC production deploy (Railway)
echo   Loyiha: %REPO_ROOT%
echo ========================================
echo.
echo Avval: npx @railway/cli login
echo To'liq deploy (mobil bilan): deploy-all.cmd
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\railway\deploy.ps1" -SkipBootstrap %*
if errorlevel 1 (
  echo.
  echo Deploy xato. Batafsil: docs\PROD_DEPLOY_YAKUNLANDI.md
  exit /b 1
)

echo.
echo Veb panel: https://sales-arena.up.railway.app
echo Tizim migratsiyasi: /settings/system-migration
echo Mobil APK: deploy-mobile-prod.cmd  (yig'ish + serverga yuklash)
echo Mobil sozlamalar: /settings/mobile-app
echo.
endlocal
