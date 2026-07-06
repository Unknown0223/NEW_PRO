@echo off
chcp 65001 >nul
echo [1/2] Marshrut test nuqtalari (Toshkent, GPS)...
cd /d "%~dp0backend"
call npm run seed:agent-route-map-once
if errorlevel 1 (
  echo.
  echo Xato. Backend ishlayaptimi? DB tayyormi?
  pause
  exit /b 1
)
echo.
echo [2/2] Mobil ilovada Savdo nuqtalari ^> sinxron tugmasini bosing yoki ilovani qayta oching.
pause
