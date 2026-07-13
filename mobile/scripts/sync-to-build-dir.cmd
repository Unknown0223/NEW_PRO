@echo off
REM Mobil manba kodini C:\salesdoc_mobile ga sinxronlash.
REM lib/assets junction orqali ulangan — hot reload uchun robocopy qilinmaydi.
setlocal
set "REPO_ROOT=%~dp0..\.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "MOBILE_SRC=%REPO_ROOT%\mobile"
set "BUILD_DIR=C:\salesdoc_mobile"

call "%~dp0link-build-lib.cmd"
if errorlevel 1 exit /b 1

robocopy "%MOBILE_SRC%\android" "%BUILD_DIR%\android" /E /XD .gradle /NFL /NDL /NJH /NJS >nul
endlocal
