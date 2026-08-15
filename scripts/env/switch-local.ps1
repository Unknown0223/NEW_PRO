# Lokal dev muhiti - server (Railway) bilan aralashmasin.
# Ishlatish: repo ildizidan  .\scripts\env\switch-local.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "=== LOKAL muhit ===" -ForegroundColor Cyan

# Backend
$beLocal = Join-Path $Root "backend\.env.local"
$beExample = Join-Path $Root "backend\.env.local.example"
if (-not (Test-Path $beLocal)) {
  Copy-Item $beExample $beLocal
  Write-Host "Yaratildi: backend\.env.local"
} else {
  Write-Host "Mavjud: backend\.env.local"
}

# Frontend
$feLocal = Join-Path $Root "frontend\.env.local"
$feExample = Join-Path $Root "frontend\.env.local.example"
if (-not (Test-Path $feLocal)) {
  Copy-Item $feExample $feLocal
  Write-Host "Yaratildi: frontend\.env.local"
} else {
  Write-Host "Mavjud: frontend\.env.local"
}

# Mobile - faqat lokal URL
$mobEnv = Join-Path $Root "mobile\.env"
$mobLocal = Join-Path $Root "mobile\.env.local"
$mobExample = Join-Path $Root "mobile\.env.example"
if (-not (Test-Path $mobLocal)) {
  if (-not (Test-Path $mobExample)) {
    throw 'mobile\.env.example topilmadi'
  }
  Copy-Item $mobExample $mobLocal
  Write-Host "Yaratildi: mobile\.env.local"
} else {
  Write-Host "Mavjud: mobile\.env.local"
}
Copy-Item $mobLocal $mobEnv -Force
Write-Host "mobile\.env <= .env.local (127.0.0.1:18080)"

Write-Host ""
Write-Host "Keyingi qadamlar:" -ForegroundColor Green
Write-Host "  1) npm run dev          - web + lokal API"
Write-Host "  2) mobile\start-mobile.cmd  - emulyator (lokal API)"
Write-Host ""
Write-Host "Eslatma: production APK uchun  .\scripts\env\switch-production-mobile.ps1" -ForegroundColor Yellow
