# Foundation Sprint 3+6 — operatsion qadamlar (staging/local).
# Ishlatish:
#   $env:DATABASE_URL = "postgresql://..."
#   npm run foundation:ops

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

Write-Host "=== 1/2 EXPLAIN (barcha namunalar) ===" -ForegroundColor Cyan
& (Join-Path $here "run-all-explain.ps1")

Write-Host "`n=== 2/2 P95 (ixtiyoriy: log fayl) ===" -ForegroundColor Cyan
$logPath = Join-Path (Split-Path $here -Parent | Split-Path -Parent) "logs\app.log"
if (Test-Path $logPath) {
  & (Join-Path $here "summarize-p95-from-log.ps1") -Path $logPath
} else {
  Write-Host "Log topilmadi: $logPath" -ForegroundColor Yellow
  Write-Host "Qo'lda: Get-Content <log> -Tail 20000 | npm run perf:p95"
}

Write-Host "`nKeyingi (qo'lda):" -ForegroundColor Green
Write-Host "  - Natijalarni scripts/perf/EXPLAIN_ARCHIVE.md ga yozing"
Write-Host "  - .cursor/plans/db_slow_query_inventory.md P95 ustuni"
Write-Host "  - docs/grafana/dashboard-foundation-api.json import"
