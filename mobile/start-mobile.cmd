@echo off

chcp 65001 >nul

setlocal EnableDelayedExpansion

REM Android SDK / aapt kirill yo'lni o'qiy olmaydi — build faqat C:\salesdoc_mobile da.


set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"

set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

set "FLUTTER_HOME="
for /f "delims=" %%F in ('where flutter 2^>nul') do (
  if not defined FLUTTER_HOME for %%I in ("%%~dpF..") do set "FLUTTER_HOME=%%~fI"
)
if not defined FLUTTER_HOME if exist "C:\src\flutter\bin\flutter.bat" set "FLUTTER_HOME=C:\src\flutter"
if not defined FLUTTER_HOME (
  echo Xato: Flutter topilmadi. PATH ga qo'shing yoki C:\src\flutter o'rnating.
  pause
  exit /b 1
)

set "PATH=%FLUTTER_HOME%\bin;%JAVA_HOME%\bin;%ANDROID_HOME%\emulator;%ANDROID_HOME%\platform-tools;%PATH%"



REM Repo ildizi (mobile\ dan bir daraja yuqori)

set "REPO_ROOT=%~dp0.."

for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

set "MOBILE_SRC=%REPO_ROOT%\mobile"



echo [0/5] Lokal muhit (.env.local)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\env\switch-local.ps1"
if errorlevel 1 (
  echo Xato: switch-local.ps1
  pause
  exit /b 1
)

echo [1/5] Loyiha manbasi tekshirilmoqda...

if not exist "%MOBILE_SRC%\pubspec.yaml" (

  echo Xato: %MOBILE_SRC%\pubspec.yaml topilmadi.

  pause

  exit /b 1

)



set "BUILD_DIR=C:\salesdoc_mobile"

echo [2/5] Loyiha nusxasi (%BUILD_DIR%)...

if not exist "%BUILD_DIR%\pubspec.yaml" (

  robocopy "%MOBILE_SRC%" "%BUILD_DIR%" /E /XD build .dart_tool android\.gradle ios\Flutter\ephemeral /NFL /NDL /NJH /NJS

  if errorlevel 8 (

    echo Robocopy xato. Kod: !errorlevel!

    pause

    exit /b 1

  )

) else (

  robocopy "%MOBILE_SRC%\lib" "%BUILD_DIR%\lib" /E /NFL /NDL /NJH /NJS >nul

  robocopy "%MOBILE_SRC%\android" "%BUILD_DIR%\android" /E /XD .gradle /NFL /NDL /NJH /NJS >nul

  copy /Y "%MOBILE_SRC%\pubspec.yaml" "%BUILD_DIR%\" >nul

  copy /Y "%MOBILE_SRC%\pubspec.lock" "%BUILD_DIR%\" >nul 2>nul

  if exist "%MOBILE_SRC%\.env.local" copy /Y "%MOBILE_SRC%\.env.local" "%BUILD_DIR%\" >nul

  if exist "%MOBILE_SRC%\.env.production" copy /Y "%MOBILE_SRC%\.env.production" "%BUILD_DIR%\" >nul

)

REM Eski native MapKit fayli (WebView xaritaga o'tgach kerak emas)
if exist "%BUILD_DIR%\android\app\src\main\kotlin\uz\salesdoc\salesdoc_mobile\MainApplication.kt" (
  del /F /Q "%BUILD_DIR%\android\app\src\main\kotlin\uz\salesdoc\salesdoc_mobile\MainApplication.kt" >nul 2>&1
)



if not exist "%BUILD_DIR%\pubspec.yaml" (

  echo Xato: %BUILD_DIR%\pubspec.yaml yoq — nusxa olinmadi.

  pause

  exit /b 1

)



echo [3/5] Emulyator...

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\fix-emulator-webcam.ps1" -ClearSnapshots

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\start-emulator-if-needed.ps1"

if errorlevel 1 (

  echo AVD topilmadi. Android Studio ^> Device Manager.

  pause

  exit /b 1

)



echo [4/5] Backend: http://127.0.0.1:18080  (emulyator: 10.0.2.2:18080)

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\ensure-backend-dev.ps1" -RepoRoot "%REPO_ROOT%"

echo Login: veb Agent — slug=test1, login=agent, parol (Сохранить)



cd /d "%BUILD_DIR%"

if errorlevel 1 (

  echo cd %BUILD_DIR% muvaffaqiyatsiz

  pause

  exit /b 1

)



echo Joriy papka: %CD%

call flutter pub get

if errorlevel 1 exit /b 1

REM Eski Gradle daemon (8G heap) RAM ni band qilmasin
if exist "%BUILD_DIR%\android\gradlew.bat" (
  call "%BUILD_DIR%\android\gradlew.bat" --stop >nul 2>&1
)



REM Eski build qoldiqlarini tozalash (agar repo ichida qolgan bo'lsa)

if exist "%MOBILE_SRC%\build" (

  echo Eski %MOBILE_SRC%\build tozalanmoqda...

  rmdir /s /q "%MOBILE_SRC%\build" 2>nul

)



echo [5/5] Build va ishga tushirish (faqat %BUILD_DIR%)...

set "APK_PATH=%BUILD_DIR%\build\app\outputs\flutter-apk\app-debug.apk"
if exist "%APK_PATH%" (
  powershell -NoProfile -Command ^
    "$p='%APK_PATH%'; $aapt=Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools\36.1.0\aapt.exe';" ^
    "if (-not (Test-Path $aapt)) { $aapt=(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools') -Filter aapt.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1).FullName };" ^
    "if ($aapt) { $out=& $aapt dump badging $p 2>&1; if ($LASTEXITCODE -ne 0) { Write-Host 'Buzilgan APK — flutter clean...'; Set-Location '%BUILD_DIR%'; flutter clean | Out-Null; flutter pub get | Out-Null } }"
)

set "EMU_ID="
for /f "tokens=1,2" %%A in ('adb devices ^| findstr /i "emulator"') do (
  if /i "%%B"=="device" set "EMU_ID=%%A"
)
if not defined EMU_ID set "EMU_ID=emulator-5554"

echo Qurilma: !EMU_ID!
echo.
echo Hot restart: R  ^|  toliq qayta: q keyin run-mobile.cmd
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\wait-for-emulator-boot.ps1" -TimeoutSeconds 300
if errorlevel 1 (
  echo Xato: Emulyator tayyor emas. Android Studio - Device Manager - Wipe Data.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\mobile\scripts\fix-emulator-keyboard.ps1"

adb uninstall uz.salesdoc.salesdoc_mobile >nul 2>&1

flutter run --no-pub -d !EMU_ID!
if errorlevel 1 (
  echo.
  echo Build xato — Gradle to'xtatiladi, cache tozalanadi, qayta uriniladi...
  if exist "%BUILD_DIR%\android\gradlew.bat" call "%BUILD_DIR%\android\gradlew.bat" --stop >nul 2>&1
  call flutter clean >nul 2>&1
  call flutter pub get
  if errorlevel 1 exit /b 1
  flutter run --no-pub -d !EMU_ID!
)
if errorlevel 1 (
  echo.
  echo O'rnatish xato — ADB qayta ishga tushirilmoqda...
  adb kill-server >nul 2>&1
  timeout /t 2 /nobreak >nul
  adb start-server >nul 2>&1
  adb wait-for-device >nul 2>&1
  adb uninstall uz.salesdoc.salesdoc_mobile >nul 2>&1
  if exist "%APK_PATH%" (
    adb install -r "%APK_PATH%"
    if not errorlevel 1 (
      echo APK o'rnatildi. Ilovani qo'lda oching yoki: flutter run -d !EMU_ID!
    )
  )
)

endlocal

