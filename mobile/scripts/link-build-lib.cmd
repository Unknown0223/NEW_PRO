@echo off
REM C:\salesdoc_mobile\lib va assets ni repo mobile\ bilan bog'lash (junction).
REM Shunda hot reload/restart repo ichidagi o'zgarishlarni darhol ko'radi.
setlocal EnableDelayedExpansion

set "REPO_ROOT=%~dp0..\.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "MOBILE_SRC=%REPO_ROOT%\mobile"
set "BUILD_DIR=C:\salesdoc_mobile"

if not exist "%MOBILE_SRC%\pubspec.yaml" (
  echo Xato: %MOBILE_SRC%\pubspec.yaml topilmadi.
  exit /b 1
)

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%" 2>nul

if not exist "%BUILD_DIR%\pubspec.yaml" (
  echo [link] Birinchi nusxa: %BUILD_DIR% ...
  robocopy "%MOBILE_SRC%" "%BUILD_DIR%" /E /XD build .dart_tool android\.gradle ios\Flutter\ephemeral /NFL /NDL /NJH /NJS
  if errorlevel 8 exit /b 1
)

call :ensureJunction lib
if errorlevel 1 exit /b 1
if exist "%MOBILE_SRC%\assets" (
  call :ensureJunction assets
  if errorlevel 1 exit /b 1
)

copy /Y "%MOBILE_SRC%\pubspec.yaml" "%BUILD_DIR%\" >nul
if exist "%MOBILE_SRC%\pubspec.lock" copy /Y "%MOBILE_SRC%\pubspec.lock" "%BUILD_DIR%\" >nul
if exist "%MOBILE_SRC%\.env.local" copy /Y "%MOBILE_SRC%\.env.local" "%BUILD_DIR%\" >nul
if exist "%MOBILE_SRC%\.env.production" copy /Y "%MOBILE_SRC%\.env.production" "%BUILD_DIR%\" >nul

echo [link] %BUILD_DIR%\lib -^> %MOBILE_SRC%\lib
endlocal
exit /b 0

:ensureJunction
set "NAME=%~1"
set "LINK=%BUILD_DIR%\%NAME%"
set "TARGET=%MOBILE_SRC%\%NAME%"

if not exist "%TARGET%" exit /b 0

if exist "%LINK%" (
  dir "%LINK%" 2>nul | findstr /i "<JUNCTION>" >nul
  if not errorlevel 1 (
    for %%J in ("%LINK%") do set "JUNC=%%~fJ"
    for %%T in ("%TARGET%") do set "TGT=%%~fT"
    if /i "!JUNC!"=="!TGT!" exit /b 0
    echo [link] Eski junction olib tashlanmoqda: %NAME%
    rmdir "%LINK%" 2>nul
  ) else (
    echo [link] %NAME% papkasi junction ga almashtirilmoqda...
    rmdir /s /q "%LINK%" 2>nul
  )
)

if exist "%LINK%" (
  echo Xato: %LINK% o'chirilmadi. Flutter ni to'xtating - q - va qayta urining.
  exit /b 1
)

mklink /J "%LINK%" "%TARGET%" >nul
if errorlevel 1 (
  echo Xato: junction yaratilmadi. CMD ni administrator sifatida emas, oddiy rejimda ishga tushiring.
  exit /b 1
)
exit /b 0
