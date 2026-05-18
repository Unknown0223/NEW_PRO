# P95 hisoblash: backend log (JSON qator yoki pino-pretty request_complete).
# Ishlatish:
#   Get-Content .\logs\app.log -Tail 50000 | .\scripts\perf\summarize-p95-from-log.ps1
#   .\scripts\perf\summarize-p95-from-log.ps1 -Path .\logs\app.log -MinMs 0
#   Get-Content C:\...\terminals\4.txt -Tail 5000 | .\scripts\perf\summarize-p95-from-log.ps1

param(
  [string]$Path = "",
  [int]$MinMs = 0
)

$ErrorActionPreference = "Stop"

function Get-P95([double[]]$values) {
  if ($values.Count -eq 0) { return $null }
  $sorted = $values | Sort-Object
  $idx = [Math]::Ceiling(0.95 * $sorted.Count) - 1
  if ($idx -lt 0) { $idx = 0 }
  if ($idx -ge $sorted.Count) { $idx = $sorted.Count - 1 }
  return [Math]::Round($sorted[$idx], 1)
}

$byPath = @{}
$pendingPath = $null

function Add-Sample($path, $ms) {
  if (-not $path -or $ms -lt $MinMs) { return }
  if (-not $byPath.ContainsKey($path)) {
    $byPath[$path] = [System.Collections.Generic.List[double]]::new()
  }
  [void]$byPath[$path].Add([double]$ms)
}

function Try-IngestJsonLine($line) {
  $t = $line.Trim()
  if ($t.Length -lt 2) { return }
  try {
    $o = $t | ConvertFrom-Json
  } catch {
    return
  }
  $path = $o.path
  $ms = $o.responseTimeMs
  if ($null -eq $path -or $null -eq $ms) { return }
  Add-Sample $path ([double]$ms)
}

function Try-IngestPrettyLine($line) {
  $t = $line.Trim()
  if ($t -match '^\[api\]\s+path:\s*"(.+)"\s*$') {
    $script:pendingPath = $Matches[1]
    return
  }
  if ($t -match '^\[api\]\s+path:\s*(.+)\s*$' -and $t -notmatch 'request_complete') {
    $script:pendingPath = $Matches[1].Trim().Trim('"')
    return
  }
  if ($t -match 'path:\s*"(.+)"') {
    $script:pendingPath = $Matches[1]
    return
  }
  if ($t -match 'responseTimeMs:\s*([\d.]+)') {
    $ms = [double]$Matches[1]
    if ($pendingPath) {
      Add-Sample $pendingPath $ms
    }
    $script:pendingPath = $null
  }
}

function Process-Line($line) {
  Try-IngestJsonLine $line
  Try-IngestPrettyLine $line
}

if ($Path -and (Test-Path $Path)) {
  Get-Content $Path -Encoding UTF8 | ForEach-Object { Process-Line $_ }
} else {
  [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
  while ($null -ne ($line = [Console]::In.ReadLine())) {
    Process-Line $line
  }
}

if ($byPath.Count -eq 0) {
  Write-Host "Hech qanday request_complete topilmadi (JSON yoki pino-pretty path + responseTimeMs)." -ForegroundColor Yellow
  exit 0
}

Write-Host "`npath | count | p95_ms | max_ms" -ForegroundColor Cyan
Write-Host "-----|------|--------|-------"
foreach ($entry in ($byPath.GetEnumerator() | Sort-Object { Get-P95 $_.Value } -Descending)) {
  $vals = $entry.Value
  $p95 = Get-P95 $vals
  $max = [Math]::Round(($vals | Measure-Object -Maximum).Maximum, 1)
  Write-Host ("{0} | {1} | {2} | {3}" -f $entry.Key, $vals.Count, $p95, $max)
}

Write-Host "`nNatijani .cursor/plans/db_slow_query_inventory.md P95 ustuniga qo'ying." -ForegroundColor Green
