@echo off
chcp 65001 >nul
REM Asosiy mobil = SalesDoc Legacy (mobile_legacy). Redesign: mobile\start-mobile.cmd
cd /d "%~dp0mobile_legacy"
call start-mobile.cmd
