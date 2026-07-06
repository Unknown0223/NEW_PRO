@echo off
chcp 65001 >nul
setlocal
set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\fix-emulator-webcam.ps1" %*
echo.
pause
endlocal
