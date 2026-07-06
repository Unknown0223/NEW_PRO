@echo off
REM Mobil manba kodini C:\salesdoc_mobile ga sinxronlash (har build/run oldidan).
setlocal
set "REPO_ROOT=%~dp0..\.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "MOBILE_SRC=%REPO_ROOT%\mobile"
set "BUILD_DIR=C:\salesdoc_mobile"

if not exist "%BUILD_DIR%\pubspec.yaml" (
  robocopy "%MOBILE_SRC%" "%BUILD_DIR%" /E /XD build .dart_tool android\.gradle ios\Flutter\ephemeral /NFL /NDL /NJH /NJS
  exit /b 0
)

robocopy "%MOBILE_SRC%\lib" "%BUILD_DIR%\lib" /E /NFL /NDL /NJH /NJS >nul
robocopy "%MOBILE_SRC%\android" "%BUILD_DIR%\android" /E /XD .gradle /NFL /NDL /NJH /NJS >nul
robocopy "%MOBILE_SRC%\assets" "%BUILD_DIR%\assets" /E /NFL /NDL /NJH /NJS >nul 2>nul
copy /Y "%MOBILE_SRC%\pubspec.yaml" "%BUILD_DIR%\" >nul
if exist "%MOBILE_SRC%\pubspec.lock" copy /Y "%MOBILE_SRC%\pubspec.lock" "%BUILD_DIR%\" >nul
if exist "%MOBILE_SRC%\.env.local" copy /Y "%MOBILE_SRC%\.env.local" "%BUILD_DIR%\" >nul
if exist "%MOBILE_SRC%\.env.production" copy /Y "%MOBILE_SRC%\.env.production" "%BUILD_DIR%\" >nul
endlocal
