@echo off
chcp 65001 >nul
REM Eski run-mobile versiyasidan qolgan virtual S: diskni olib tashlash
subst S: /d 2>nul
if errorlevel 1 (
  echo S: diski topilmadi yoki allaqachon olib tashlangan.
) else (
  echo S: virtual diski olib tashlandi.
)
pause
