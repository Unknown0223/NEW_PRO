#Requires -Version 5.1
<#
.SYNOPSIS
  Kechki final cutover: Railway to'liq dump → Hetzner restore.
  Eski Railway O'CHIRILMAYDI.
.NOTES
  Ishga tushirish (kechqurun, yozishni to'xtatib):
    powershell -File scripts/hetzner/tonight-final-sync.ps1
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Key = Join-Path $env:USERPROFILE ".ssh\salec_hetzner"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Ssh = { param($cmd) ssh -i $Key -o BatchMode=yes root@157.180.116.50 $cmd }

Write-Host "=== KECHKI FINAL SYNC (Railway → Hetzner) ===" -ForegroundColor Cyan
Write-Host "Railway O'CHIRILMAYDI. Cutover paytida Railway/Hetzner ga yangi zakaz YOZMANG." -ForegroundColor Yellow

# 1) Railway public URL
Push-Location (Join-Path $Root "backend")
try {
  $jsonPath = Join-Path $env:TEMP "rw-pg-tonight.json"
  npx --yes @railway/cli variables --service Postgres --json | Out-File -Encoding utf8 $jsonPath
  $vars = Get-Content $jsonPath -Raw | ConvertFrom-Json
  $url = $vars.DATABASE_PUBLIC_URL
  if (-not $url) { throw "DATABASE_PUBLIC_URL yo'q" }
} finally {
  Pop-Location
}

# counts before
Write-Host "=== Railway counts (dump oldidan) ===" -ForegroundColor Cyan
$env:DATABASE_URL = $url
Push-Location (Join-Path $Root "backend")
try { npx tsx scripts/tmp-db-counts.ts } finally { Pop-Location }

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($url))
& $Ssh "echo $b64 | base64 -d > /root/.mig-pg-url; chmod 600 /root/.mig-pg-url; echo URL_OK"

Write-Host "=== Dump on VPS (10-30 daqiqa) ===" -ForegroundColor Cyan
& $Ssh "bash /root/remote-final-dump.sh"

Write-Host "=== Restore on VPS ===" -ForegroundColor Cyan
# Update restore script dump name dynamically
& $Ssh @'
set -euo pipefail
LATEST=$(readlink -f /opt/salec/backups/salec_latest.dump)
NAME=$(basename "$LATEST")
sed -i "s/^DUMP_NAME=.*/DUMP_NAME=$NAME/" /root/remote-restore-final.sh
bash /root/remote-restore-final.sh
'@

Write-Host "=== Hetzner counts ===" -ForegroundColor Cyan
& $Ssh "cat /opt/salec/backups/restore_counts.txt; curl -fsS http://127.0.0.1:4000/health; echo"
Write-Host "DONE. Test: http://app.157.180.116.50.sslip.io/login" -ForegroundColor Green
Write-Host "Railway ni o'chirmang."
