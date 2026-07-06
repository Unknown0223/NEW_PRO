@echo off
chcp 65001 >nul
REM Fizik klaviatura (PC) emulyatorda ishlashi uchun
set "PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%"

echo Emulyator oynasiga bir marta bosing (fokus uchun).
adb -s emulator-5554 shell settings put secure show_ime_with_hard_keyboard 1
adb -s emulator-5554 shell settings put secure default_input_method com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME
adb -s emulator-5554 shell ime enable com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME
adb -s emulator-5554 shell ime set com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME

echo.
echo Agar hali ishlamasa — emulyatorni qayta ishga tushiring (cold boot):
echo   adb emu kill
echo   emulator -avd salesdoc_pixel7 -no-snapshot-load -gpu host
echo.
pause
