@echo off
chcp 65001 >nul
REM SALEC — production deploy: backend + frontend + mobil APK (server OTA)
REM Faqat veb: deploy-prod.cmd -SkipMobile
setlocal
set "REPO_ROOT=%~dp0"
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo.
echo ========================================
echo   SALEC production deploy
echo   Backend + Frontend + Mobil APK
echo   Loyiha: %REPO_ROOT%
echo ========================================
echo.
echo Avval: npx @railway/cli login
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\railway\deploy-all.ps1" -SkipBootstrap %*
if errorlevel 1 (
  echo.
  echo Deploy xato. Batafsil: docs\PROD_DEPLOY_YAKUNLANDI.md
  exit /b 1
)

echo.
echo Veb: https://sales-arena.up.railway.app
echo API: https://backend-production-3cf2.up.railway.app
echo Mobil OTA: /settings/mobile-app
echo.
endlocal
