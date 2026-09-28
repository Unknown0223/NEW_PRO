# Mobil ilova - Hetzner production API (release APK / server test)
# Ishlatish: repo ildizidan  .\scripts\env\switch-production-mobile.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "=== MOBIL: PRODUCTION API (Hetzner) ===" -ForegroundColor Cyan

$mobEnv = Join-Path $Root "mobile\.env"
$mobProd = Join-Path $Root "mobile\.env.production"
Copy-Item $mobProd $mobEnv -Force
Write-Host "mobile\.env <= .env.production (Hetzner backend)"

Write-Host ""
Write-Host "Keyingi qadamlar:" -ForegroundColor Green
Write-Host "  mobile\build-apk-railway.cmd   - release APK (Hetzner API)"
Write-Host "  deploy-mobile-prod.cmd         - APK + OTA Hetznerga"
Write-Host ""
Write-Host "Eski Railway faqat solishtirish uchun; release APK Hetznerga ulanadi." -ForegroundColor DarkYellow
Write-Host "Web panel lokal:  .\scripts\env\switch-local.ps1" -ForegroundColor Yellow
