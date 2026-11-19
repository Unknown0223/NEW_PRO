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

  # `dist` umumiy exclude qilinmaydi: vendor/plans-proposal va vendor/pivot-engine
  # Docker build uchun dist/index.js shart (eski --exclude=dist yangi vendorni bo‘sh qoldirardi).
  $excludes = @(
    "--exclude=node_modules",
    "--exclude=.next",
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
  # TEMP da nisbiy nom bilan yozamiz — Windows System32 tar absolut C:\ yo‘lini
  # yoki --force-local ni ishonchli qo‘llab-quvvatlamaydi.
  $tarName = Split-Path $tar -Leaf
  Push-Location $env:TEMP
  try {
    if (Test-Path $tarName) { Remove-Item $tarName -Force }
    & tar -czf $tarName @excludes -C $LocalDir .
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

# 0) vendor packages (Docker build context)
if (-not $SkipFrontend -and -not $SkipPivotSync) {
  Write-Host "[0/4] pivot-engine sync..." -ForegroundColor Yellow
  Push-Location (Join-Path $Root "frontend")
  try {
    & node "scripts\sync-pivot-engine.mjs"
    if ($LASTEXITCODE -ne 0) { throw "pivot-engine sync xato" }
  } finally {
    Pop-Location
  }
}
if (-not $SkipBackend -or -not $SkipFrontend) {
  Write-Host "[0/4] plans-proposal vendor sync..." -ForegroundColor Yellow
  & node (Join-Path $Root "scripts\sync-plans-proposal.mjs")
  if ($LASTEXITCODE -ne 0) { throw "plans-proposal sync xato" }
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

# 2) Build (downtime yo‘q) → rolling recreate (502 oynasi qisqa)
# Eski usul: backend+frontend birga --force-recreate → Coolify/Traefik 502.
Write-Host "[2/3] Docker build + rolling up..." -ForegroundColor Yellow
$buildServices = @()
if (-not $SkipBackend) { $buildServices += @("backend", "worker") }
if (-not $SkipFrontend) { $buildServices += "frontend" }
if (-not $SkipBot) { $buildServices += "telegram-bot" }
if ($buildServices.Count -eq 0) { throw "Hech narsa build qilinmadi (SkipBackend+SkipFrontend+SkipBot)" }

$buildFlag = if ($NoCache) { "--no-cache" } else { "" }
$svcBuild = ($buildServices -join " ")
$composeEnvFile = '.env.production'
$composeFile = 'docker-compose.prod.yml'
$buildCmd = if ($buildFlag) {
  "docker compose -f $composeFile --env-file $composeEnvFile build $buildFlag $svcBuild"
} else {
  "docker compose -f $composeFile --env-file $composeEnvFile build $svcBuild"
}
$doBackend = if (-not $SkipBackend) { "1" } else { "0" }
$doFrontend = if (-not $SkipFrontend) { "1" } else { "0" }
$doBot = if (-not $SkipBot) { "1" } else { "0" }
Write-Host "  Eslatma: konteyner almashganda 10–40s 502 bo‘lishi mumkin — keyin avtomatik tiklanadi." -ForegroundColor DarkYellow
Invoke-Remote @"
set -euo pipefail
cd $RemoteRoot/infrastructure
test -f $composeEnvFile
$buildCmd

wait_http() {
  local url=`$1
  local name=`$2
  local n=0
  while [ `$n -lt 36 ]; do
    code=`$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 8 "`$url" || echo 000)
    if [ "`$code" = "200" ] || [ "`$code" = "301" ] || [ "`$code" = "302" ]; then
      echo "WAIT_OK_`$name HTTP `$code"
      return 0
    fi
    n=`$((n+1))
    sleep 5
  done
  echo "WAIT_FAIL_`$name last_http=`$code" >&2
  return 1
}

if [ '$doBackend' = '1' ]; then
  echo 'Recreate backend...'
  docker compose -f $composeFile --env-file $composeEnvFile up -d --force-recreate --no-deps backend
  docker network connect coolify salec-backend-1 2>/dev/null || true
  docker compose -f $composeFile --env-file $composeEnvFile up -d --force-recreate --no-deps worker
  wait_http 'http://127.0.0.1:4000/health' backend_local
fi

if [ '$doFrontend' = '1' ]; then
  echo 'Recreate frontend...'
  docker compose -f $composeFile --env-file $composeEnvFile up -d --force-recreate --no-deps frontend
  docker network connect coolify salec-frontend-1 2>/dev/null || true
  wait_http 'http://127.0.0.1:3000/login' frontend_local
fi

if [ '$doBot' = '1' ]; then
  docker compose -f $composeFile --env-file $composeEnvFile up -d --force-recreate --no-deps telegram-bot
fi

docker compose -f $composeFile --env-file $composeEnvFile ps
docker builder prune -af --filter until=72h 2>&1 | tail -1 || true
df -h / | tail -1
echo BUILD_UP_OK
"@

# 3) Smoke (public URL — Traefik orqali, qayta urinadi)
Write-Host "[3/3] Smoke check (public)..." -ForegroundColor Yellow
$apiOk = $false
$webOk = $false
for ($i = 1; $i -le 24; $i++) {
  try {
    $h = Invoke-RestMethod -Uri "https://api.salesarena.sale/health" -TimeoutSec 15
    if ($h.status -eq "ok" -or $h.status -eq "healthy" -or $h -ne $null) {
      Write-Host "API health: $($h.status)" -ForegroundColor Green
      $apiOk = $true
    }
  } catch {
    Write-Host "API health: urinish $i/24 — $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
  try {
    $r = Invoke-WebRequest -Uri "https://salesarena.sale/login" -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
      Write-Host "Login page: HTTP $($r.StatusCode)" -ForegroundColor Green
      $webOk = $true
    }
  } catch {
    Write-Host "Login page: urinish $i/24 — $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
  if ($apiOk -and $webOk) { break }
  Start-Sleep -Seconds 5
}
if (-not $apiOk -or -not $webOk) {
  throw "Smoke check yiqildi (apiOk=$apiOk webOk=$webOk). Konteyner/Traefik holatini tekshiring."
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY YAKUNLANDI" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Veb:   https://salesarena.sale"
Write-Host "Login: https://salesarena.sale/login   (slug: aksit)"
Write-Host "API:   https://api.salesarena.sale/health"
Write-Host ""
