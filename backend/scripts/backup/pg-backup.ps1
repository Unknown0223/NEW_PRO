#Requires -Version 5.1
<#
.SYNOPSIS
  PostgreSQL backup — Windows PowerShell variant.
.DESCRIPTION
  Talab: pg_dump PATH da, DATABASE_URL muhit o'zgaruvchisi.
  Bash ekvivalenti: scripts/backup/pg-backup.sh
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $Root 'backups\postgres' }
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$File = Join-Path $BackupDir "salec_$Stamp.sql.gz"

if (-not $env:DATABASE_URL) {
  Write-Error 'DATABASE_URL is required'
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Write-Host "Backing up to $File ..."
& pg_dump $env:DATABASE_URL --no-owner --no-acl | & gzip -9 | Set-Content -Path $File -Encoding Byte
$size = (Get-Item $File).Length
Write-Host "Done: $File ($([math]::Round($size / 1MB, 2)) MB)"

$RetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 14 }
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter 'salec_*.sql.gz' -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  Remove-Item -Force -ErrorAction SilentlyContinue
