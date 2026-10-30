# SALEC — Hetzner (salesarena.sale) production deploy
# Ishlatish: repo ildizidan  .\deploy-prod.cmd
# Yoki: powershell -File .\scripts\hetzner\deploy.ps1
param(
  [string]$HostName = "157.180.116.50",
  [string]$User = "root",
  [string]$SshKey = "",
  [string]$RemoteRoot = "/opt/salec",
  [switch]$SkipBackend,
  [switch]$SkipFrontend,
  [switch]$SkipBot,
  [switch]$NoCache,
  [switch]$SkipPivotSync
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

if (-not $SshKey) {
  $SshKey = Join-Path $env:USERPROFILE ".ssh\salec_hetzner"
}
if (-not (Test-Path $SshKey)) {
  throw "SSH kalit topilmadi: $SshKey"
}

$sshBase = @(
  "-i", $SshKey,
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "ConnectTimeout=20"
)
$remote = "${User}@${HostName}"

function Invoke-Remote {
  param([Parameter(Mandatory)][string]$Script)
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($Script -replace "`r`n", "`n")))
  & ssh @sshBase $remote "echo $b64 | base64 -d > /tmp/salec-deploy-remote.sh && bash /tmp/salec-deploy-remote.sh"
  if ($LASTEXITCODE -ne 0) { throw "Remote buyruq xato (exit $LASTEXITCODE)" }
}

function Sync-Tree {
  param(
    [Parameter(Mandatory)][string]$LocalDir,
    [Parameter(Mandatory)][string]$RemoteRel,
    [string[]]$ExtraExcludes = @()
  )
  $name = Split-Path $LocalDir -Leaf
  $tar = Join-Path $env:TEMP "salec-deploy-$name.tar.gz"
  if (Test-Path $tar) { Remove-Item $tar -Force }

  $excludes = @(
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=dist",
    "--exclude=coverage",
    "--exclude=.git",
    "--exclude=.turbo",
    "--exclude=*.log",
    "--exclude=.env",
    "--exclude=.env.local",
    "--exclude=.env.production",
    "--exclude=tmp",
    "--exclude=tmp-*",
    "--exclude=playwright-report",
    "--exclude=test-results"
  ) + ($ExtraExcludes | ForEach-Object { "--exclude=$_" })

  Write-Host "  tar: $name ..." -ForegroundColor DarkGray
  Push-Location $LocalDir
  try {
    & tar -czf $tar @excludes .
    if ($LASTEXITCODE -ne 0) { throw "tar xato: $LocalDir" }
  } finally {
    Pop-Location
  }

  $remoteTar = "/tmp/salec-deploy-$name.tar.gz"
  $remotePath = "$RemoteRoot/$RemoteRel"
  Write-Host "  scp -> ${remote}:$remotePath" -ForegroundColor DarkGray
  & scp @sshBase $tar "${remote}:$remoteTar"
  if ($LASTEXITCODE -ne 0) { throw "scp xato: $name" }

  Invoke-Remote @"
set -euo pipefail
mkdir -p '$remotePath'
tar -xzf '$remoteTar' -C '$remotePath'
rm -f '$remoteTar'
echo SYNC_OK_$name
"@
  Remove-Item $tar -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SALEC Hetzner deploy" -ForegroundColor Cyan
Write-Host "  $HostName  →  https://salesarena.sale" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 0) pivot-engine (frontend Docker vendor)
if (-not $SkipFrontend -and -not $SkipPivotSync) {
  Write-Host "[0/3] pivot-engine sync..." -ForegroundColor Yellow
  Push-Location (Join-Path $Root "frontend")
  try {
    & node "scripts\sync-pivot-engine.mjs"
    if ($LASTEXITCODE -ne 0) { throw "pivot-engine sync xato" }
  } finally {
    Pop-Location
  }
}

# 1) Kod sync ( .env.production serverda qoladi )
Write-Host "[1/3] Kod sync ($RemoteRoot)..." -ForegroundColor Yellow
if (-not $SkipBackend) {
  Sync-Tree -LocalDir (Join-Path $Root "backend") -RemoteRel "backend"
}
if (-not $SkipFrontend) {
  Sync-Tree -LocalDir (Join-Path $Root "frontend") -RemoteRel "frontend"
}
if (-not $SkipBot) {
  Sync-Tree -LocalDir (Join-Path $Root "telegram-client-bot") -RemoteRel "telegram-client-bot"
}
# compose (secrets faylini yubormaymiz)
$composeLocal = Join-Path $Root "infrastructure\docker-compose.prod.yml"
$composeTmp = Join-Path $env:TEMP "salec-docker-compose.prod.yml"
Copy-Item $composeLocal $composeTmp -Force
& scp @sshBase $composeTmp "${remote}:$RemoteRoot/infrastructure/docker-compose.prod.yml"
if ($LASTEXITCODE -ne 0) { throw "scp compose xato" }
Remove-Item $composeTmp -Force -ErrorAction SilentlyContinue

# 2) Build + recreate
Write-Host "[2/3] Docker build + up..." -ForegroundColor Yellow
$services = @()
if (-not $SkipBackend) { $services += "backend" }
if (-not $SkipFrontend) { $services += "frontend" }
if (-not $SkipBot) { $services += "telegram-bot" }
if ($services.Count -eq 0) { throw "Hech narsa build qilinmadi (SkipBackend+SkipFrontend+SkipBot)" }

$buildFlag = if ($NoCache) { "--no-cache" } else { "" }
$svc = ($services -join " ")
# PowerShell `$env:*` ni heredoc/string ichida yutib yubormasligi uchun flag alohida
$composeEnvFile = '.env.production'
$composeFile = 'docker-compose.prod.yml'
$buildCmd = if ($buildFlag) {
  "docker compose -f $composeFile --env-file $composeEnvFile build $buildFlag $svc"
} else {
  "docker compose -f $composeFile --env-file $composeEnvFile build $svc"
}
Invoke-Remote @"
set -euo pipefail
cd $RemoteRoot/infrastructure
test -f $composeEnvFile
$buildCmd
docker compose -f $composeFile --env-file $composeEnvFile up -d --force-recreate --no-deps $svc
docker network connect coolify salec-backend-1 2>/dev/null || true
docker network connect coolify salec-frontend-1 2>/dev/null || true
sleep 8
docker compose -f $composeFile --env-file $composeEnvFile ps
docker builder prune -af --filter until=72h 2>&1 | tail -1 || true
df -h / | tail -1
echo BUILD_UP_OK
"@

# 3) Smoke
Write-Host "[3/3] Smoke check..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
  $h = Invoke-RestMethod -Uri "https://api.salesarena.sale/health" -TimeoutSec 30
  Write-Host "API health: $($h.status)" -ForegroundColor Green
} catch {
  Write-Host "API health: hali kutilyapti — $($_.Exception.Message)" -ForegroundColor DarkYellow
}
try {
  $r = Invoke-WebRequest -Uri "https://salesarena.sale/login" -UseBasicParsing -TimeoutSec 30
  Write-Host "Login page: HTTP $($r.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "Login page: hali kutilyapti — $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY YAKUNLANDI" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Veb:   https://salesarena.sale"
Write-Host "Login: https://salesarena.sale/login   (slug: aksit)"
Write-Host "API:   https://api.salesarena.sale/health"
Write-Host ""
