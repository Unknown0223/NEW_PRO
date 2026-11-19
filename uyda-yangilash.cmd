@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo === GitHub dan yangilash (main + mobile) ===
git fetch origin
if errorlevel 1 (
  echo Xato: git fetch. Internet / remote tekshiring.
  exit /b 1
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BR=%%b"
if /i not "%BR%"=="main" (
  echo Joriy branch: %BR% — uy sinxron uchun main ga o'tamiz...
  git checkout main
  if errorlevel 1 (
    echo Xato: git checkout main
    exit /b 1
  )
)

git pull --ff-only origin main
if errorlevel 1 (
  echo pull --ff-only yiqildi. Qo'lda: git pull origin main
  exit /b 1
)

if not exist "mobile\pubspec.yaml" (
  echo Xato: mobile\ yo'q — repo to'liq emas.
  exit /b 1
)

if not exist "mobile\.env" (
  if exist "mobile\.env.example" (
    copy /Y "mobile\.env.example" "mobile\.env" >nul
    echo mobile\.env yaratildi (.env.example dan^).
  )
)

where flutter >nul 2>&1
if errorlevel 1 (
  echo Ogohlantirish: Flutter PATH da yo'q. mobile\ yangilandi, lekin pub get o'tkazildi.
  echo Keyin: cd mobile ^& flutter pub get
  goto :done
)

echo flutter pub get...
pushd mobile
call flutter pub get
set "FG=%ERRORLEVEL%"
popd
if not "%FG%"=="0" (
  echo flutter pub get xato: %FG%
  exit /b %FG%
)

:done
echo.
echo Tayyor (branch: main). Mobil: .\run-mobile.cmd
echo Hujjat: docs\UYDA-GIT-SINXRON.md
endlocal
exit /b 0
