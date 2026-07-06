@echo off
chcp 65001 >nul
REM Mobil ilovani ishga tushirish (repo ildizidan).
cd /d "%~dp0mobile"
call start-mobile.cmd
