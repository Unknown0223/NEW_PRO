#Requires -Version 5.1
<#
.SYNOPSIS
  DR drill — backup mavjudligi va gzip integrity (dry-run).
  Bash ekvivalenti: scripts/dr-drill.sh
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $Root 'backups\postgres' }

Write-Host '=== SALEC DR Drill ==='
Write-Host "Time: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"

if ($env:DATABASE_URL) {
  Write-Host 'Checking database connectivity...'
  & psql $env:DATABASE_URL -c 'SELECT 1 AS ok;' | Out-Null
  Write-Host 'OK: database reachable'
} else {
  Write-Host 'WARN: DATABASE_URL not set — skip connectivity check'
}

$Latest = Get-ChildItem -Path $BackupDir -Filter 'salec_*.sql.gz' -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Latest) {
  Write-Host "WARN: no backup found in $BackupDir — run pg-backup.ps1"
  exit 1
}

Write-Host "Latest backup: $($Latest.FullName)"
Write-Host "Size: $([math]::Round($Latest.Length / 1MB, 2)) MB"

& gzip -t $Latest.FullName
Write-Host 'OK: backup gzip integrity'
Write-Host '=== DR drill passed (dry-run) ==='
