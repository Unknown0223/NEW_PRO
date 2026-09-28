#Requires -Version 5.1
<#
.SYNOPSIS
  Railway Postgres dan to'liq final dump (eski baza O'CHIRILMAYDI).
.DESCRIPTION
  Chiqish: backups/postgres/salec_final_<stamp>.dump (+ counts JSON).
  Keyin Hetzner ga restore: scripts/hetzner/cutover-restore-on-vps.sh
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDir = Join-Path $Root "backups\postgres"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$dumpFile = Join-Path $BackupDir "salec_final_$stamp.dump"
$countsFile = Join-Path $BackupDir "salec_final_$stamp.counts.json"

Write-Host "=== 1) Railway DATABASE_PUBLIC_URL ===" -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
try {
  $jsonPath = Join-Path $env:TEMP "rw-pg-cutover.json"
  npx --yes @railway/cli variables --service Postgres --json | Out-File -Encoding utf8 $jsonPath
  $vars = Get-Content $jsonPath -Raw | ConvertFrom-Json
  $url = $vars.DATABASE_PUBLIC_URL
  if (-not $url) { throw "DATABASE_PUBLIC_URL topilmadi" }
  $uri = [Uri]$url
  $pgHost = $uri.Host
  $pgPort = $uri.Port
  $pgUser = $uri.UserInfo.Split(":")[0]
  $pgPass = [Uri]::UnescapeDataString($uri.UserInfo.Substring($pgUser.Length + 1))
  $pgDb = $uri.AbsolutePath.TrimStart("/")
} finally {
  Pop-Location
}

Write-Host "Host: $pgHost`:$pgPort DB: $pgDb (Railway saqlanadi — o'chirilmaydi)" -ForegroundColor Green

Write-Host "=== 2) Counts (dump oldidan) ===" -ForegroundColor Cyan
$env:DATABASE_URL = $url
Push-Location (Join-Path $Root "backend")
try {
  npx tsx scripts/tmp-db-counts.ts | Tee-Object -FilePath $countsFile
} finally {
  Pop-Location
}

Write-Host "=== 3) pg_dump -Fc ===" -ForegroundColor Cyan
docker version | Out-Null
$dumpDirLinux = ($BackupDir -replace '\\', '/') -replace '^([A-Za-z]):', { '/{0}' -f $args[0].Groups[1].Value.ToLower() }
# Windows path mount for Docker Desktop
$mount = "${BackupDir}:/backup"
$outName = Split-Path $dumpFile -Leaf

docker run --rm `
  -e "PGPASSWORD=$pgPass" `
  -v $mount `
  postgres:18-alpine `
  pg_dump -h $pgHost -p $pgPort -U $pgUser -d $pgDb -Fc --no-owner --no-acl -f "/backup/$outName"

if (-not (Test-Path $dumpFile)) { throw "Dump yaratilmadi: $dumpFile" }
$sizeMb = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
Write-Host "OK: $dumpFile ($sizeMb MB)" -ForegroundColor Green
Write-Host "Counts: $countsFile"
Write-Host ""
Write-Host "Keyingi: dump ni VPS ga yuklang va cutover-restore-on-vps.sh ishga tushiring." -ForegroundColor Yellow
Write-Host "Eski Railway DB va servislar O'CHIRILMAYDI."
