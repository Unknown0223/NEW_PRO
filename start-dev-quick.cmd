@echo off
setlocal
cd /d "%~dp0"
if not exist "package.json" (
  echo [XATO] package.json topilmadi: %CD%
  pause
  exit /b 1
)
echo.
echo Tez rejim: frontend .next tozalashsiz, Docker/seed/migrate qayta ishlamaydi.
echo Birinchi marta yoki DB yangilanganida: start-dev.cmd
echo.
call npm run dev:quick
endlocal
