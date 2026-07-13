# SALEC — Railway deploy (PowerShell)
# Ishlatish: repo ildizidan, avval `npx @railway/cli login`
param(
  [string]$ProjectName = "artistic-endurance",
  [string]$AdminPassword = "secret123",
  [string]$TenantSlug = "test1",
  [switch]$SkipBootstrap,
  [switch]$WipeDatabase
)

$ErrorActionPreference = "Stop"
$Railway = "npx"
$RailwayArgs = @("--yes", "@railway/cli")

function Invoke-Railway {
  param([string[]]$RailwayCmd)
  & $Railway @RailwayArgs @RailwayCmd
  if ($LASTEXITCODE -ne 0) { throw "Railway failed: $($RailwayCmd -join ' ')" }
}

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

Write-Host "=== Railway deploy: $ProjectName ===" -ForegroundColor Cyan

Invoke-Railway @("whoami")

Write-Host "`n--- Backend deploy ---" -ForegroundColor Yellow
Set-Location (Join-Path $Root "backend")
Invoke-Railway @("link", "--project", $ProjectName, "--service", "backend", "--environment", "production")
Invoke-Railway @("up", "--detach", "--service", "backend")

Write-Host "`n--- Frontend deploy ---" -ForegroundColor Yellow
Set-Location (Join-Path $Root "frontend")
Invoke-Railway @("link", "--project", $ProjectName, "--service", "frontend", "--environment", "production")
Invoke-Railway @("up", "--detach", "--service", "frontend")

Set-Location (Join-Path $Root "backend")

if ($WipeDatabase) {
  Write-Host "`n--- DB wipe (faqat schema, seed yo'q) ---" -ForegroundColor Red
  $env:CONFIRM_DB_ZERO_RESET = "yes"
  $env:DB_ZERO_SKIP_SEED = "1"
  $env:ALLOW_PROD_DB_ZERO = "true"
  Invoke-Railway @("run", "npm", "run", "db:zero-reset")
}

if (-not $SkipBootstrap) {
  Write-Host "`n--- Production init (admin + RBAC) ---" -ForegroundColor Green
  $env:ALLOW_RAILWAY_PROD_INIT = "true"
  $env:ADMIN_PASSWORD = $AdminPassword
  $env:IMPORT_TENANT_SLUG = $TenantSlug
  Invoke-Railway @("run", "npm", "run", "railway:prod-init")
}

Write-Host "`n=== Tayyor ===" -ForegroundColor Cyan
Write-Host "Loyiha papkasi: $Root"
Write-Host "Dashboard: https://railway.com/project/$ProjectName"
Write-Host ""
Write-Host "Production URL (standart):" -ForegroundColor Green
Write-Host "  Veb:     https://sales-arena.up.railway.app"
Write-Host "  API:     https://backend-production-3cf2.up.railway.app"
Write-Host "  Migratsiya: /settings/system-migration"
Write-Host ""
if (-not $SkipBootstrap) {
  Write-Host "Kirish: slug=$TenantSlug login=admin parol=$AdminPassword"
}
Write-Host ""
Write-Host "Keyingi qadamlar:" -ForegroundColor Yellow
Write-Host "  1) Railway dashboard: backend/frontend public URL tekshiring"
Write-Host "  2) Backend CORS_ALLOWED_ORIGINS = frontend URL"
Write-Host "  3) Frontend API_INTERNAL_ORIGIN = backend URL (kerak bo'lsa frontend redeploy)"
Write-Host "  4) Mobil: .\deploy-mobile-prod.cmd  (APK yig'ish + serverga yuklash)"
Write-Host "     Veb: /settings/mobile-app"
Write-Host ""
Write-Host "Eslatma: veb/API deploy bilan yangilanadi; mobil APK alohida (qo'lda o'rnatish)." -ForegroundColor DarkYellow
Write-Host "Batafsil: docs/PROD_DEPLOY_YAKUNLANDI.md"
