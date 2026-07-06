# Mobil ilova - Railway production API (release APK / server test)
# Ishlatish: repo ildizidan  .\scripts\env\switch-production-mobile.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "=== MOBIL: PRODUCTION API ===" -ForegroundColor Cyan

$mobEnv = Join-Path $Root "mobile\.env"
$mobProd = Join-Path $Root "mobile\.env.production"
Copy-Item $mobProd $mobEnv -Force
Write-Host "mobile\.env <= .env.production (Railway backend)"

Write-Host ""
Write-Host "Keyingi qadamlar:" -ForegroundColor Green
Write-Host "  mobile\build-apk-railway.cmd   - release APK"
Write-Host "  mobile\run-mobile-railway.cmd  - emulyatorda prod API"
Write-Host ""
Write-Host "Web panel lokal ishlatish uchun:  .\scripts\env\switch-local.ps1" -ForegroundColor Yellow
