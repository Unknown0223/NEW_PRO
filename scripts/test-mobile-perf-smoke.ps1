# Mobil tezlik / API smoke (production)
# Ishlatish: pwsh scripts/test-mobile-perf-smoke.ps1
param(
  [string]$Api = "https://backend-production-3cf2.up.railway.app",
  [string]$Slug = "test1"
)

$ErrorActionPreference = "Stop"
$fail = 0

function Assert([string]$name, [bool]$cond, [string]$detail = "") {
  if ($cond) { Write-Host "[OK] $name" -ForegroundColor Green }
  else { Write-Host "[FAIL] $name $detail" -ForegroundColor Red; $script:fail++ }
}

Write-Host "=== Mobil perf / OTA smoke ===" -ForegroundColor Cyan

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$health = Invoke-RestMethod -Uri "$Api/health" -TimeoutSec 15
Assert "health" ($health.status -eq "ok")
Write-Host "  health ms=$($sw.ElapsedMilliseconds)"

$sw.Restart()
$rel = Invoke-RestMethod -Uri "$Api/api/mobile/app-release?slug=$Slug&version=3.1.6&platform=android"
Assert "app-release" ($null -ne $rel.policy.latest_version)
Write-Host "  latest=$($rel.policy.latest_version) required=$($rel.update.required) ms=$($sw.ElapsedMilliseconds)"

$sw.Restart()
try {
  $head = Invoke-WebRequest -Uri "$Api/api/mobile/apk-download?slug=$Slug" -Method Head -UseBasicParsing -TimeoutSec 30
  Assert "apk HEAD" ($head.StatusCode -eq 200)
  Write-Host "  apk HEAD ms=$($sw.ElapsedMilliseconds)"
} catch {
  Assert "apk HEAD" $false $_.Exception.Message
}

$loginBody = @{ slug = $Slug; login = "admin"; password = "secret123" } | ConvertTo-Json
$tok = (Invoke-RestMethod -Uri "$Api/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json").accessToken
$H = @{ Authorization = "Bearer $tok" }
$pol = Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" -Headers $H
Assert "apk.ready" ($pol.apk.ready -eq $true) "ready=$($pol.apk.ready)"
Write-Host "  apk bytes=$($pol.apk.bytes) latest=$($pol.policy.latest_version)"

Write-Host ""
if ($fail -eq 0) {
  Write-Host "=== ALL PASSED ===" -ForegroundColor Green
  exit 0
}
Write-Host "=== FAILED: $fail ===" -ForegroundColor Red
exit 1
