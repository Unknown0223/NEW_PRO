# Run all EXPLAIN samples. Usage: npm run perf:explain
# Default DB: postgresql://postgres:0223@localhost:15432/savdo_db (docker-compose)

$ErrorActionPreference = "Continue"

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://postgres:0223@localhost:15432/savdo_db"
  Write-Host "DATABASE_URL default: $($env:DATABASE_URL)"
}

$dir = $PSScriptRoot
$files = @(
  "explain-dashboard-sales-scope.sql",
  "explain-dashboard-supervisor-order-scope.sql",
  "explain-orders-list-paged.sql",
  "explain-clients-list-paged.sql",
  "explain-clients-references.sql",
  "explain-products-list-paged.sql",
  "explain-stock-balances-summary.sql",
  "explain-linkage-agent-sold-products.sql",
  "explain-reports-sales.sql",
  "explain-reports-order-debts.sql",
  "explain-report-builder-orders-aggregate.sql"
)

$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
$container = "savdo_postgres"
if (-not $env:EXPLAIN_DOCKER_CONTAINER) { } else { $container = $env:EXPLAIN_DOCKER_CONTAINER }

if (-not $psqlCmd) {
  Write-Host "psql not found - using docker exec $container"
}

foreach ($f in $files) {
  $path = Join-Path $dir $f
  Write-Host ""
  Write-Host "=== $f ===" -ForegroundColor Cyan
  if ($psqlCmd) {
    & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $path
  } else {
    Get-Content $path -Raw | docker exec -i $container psql -U postgres -d savdo_db -v ON_ERROR_STOP=1
  }
}

Write-Host ""
Write-Host "Done. Copy results to scripts/perf/EXPLAIN_ARCHIVE.md" -ForegroundColor Green
