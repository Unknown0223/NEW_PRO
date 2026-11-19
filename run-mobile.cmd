@echo off
chcp 65001 >nul
REM Asosiy mobil = mobile\ (bitta ilova). Legacy yo‘q.
cd /d "%~dp0mobile"
call start-mobile.cmd
