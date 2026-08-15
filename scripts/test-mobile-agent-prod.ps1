# Mobil agent smoke — production API (login, config, visits flag, create-context warehouses)
# Ishlatish: pwsh scripts/test-mobile-agent-prod.ps1
param(
  [string]$Api = "https://backend-production-3cf2.up.railway.app",
  [string]$Slug = "test1",
  [string]$Login = "agent",
  [string]$Password = "111111"
)

$ErrorActionPreference = "Stop"
$fail = 0

function Assert([string]$name, [bool]$cond, [string]$detail = "") {
  if ($cond) { Write-Host "[OK] $name" -ForegroundColor Green }
  else { Write-Host "[FAIL] $name $detail" -ForegroundColor Red; $script:fail++ }
}

Write-Host "=== Mobil agent prod smoke ===" -ForegroundColor Cyan
Write-Host "API: $Api"

$loginBody = @{ slug = $Slug; login = $Login; password = $Password; apk_version = "3.1.6" } | ConvertTo-Json
try {
  $login = Invoke-RestMethod -Uri "$Api/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
} catch {
  Write-Host "[FAIL] login: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Assert "login role=agent" ($login.user.role -eq "agent")

$cfg = Invoke-RestMethod -Uri "$Api/api/$Slug/mobile/agent-config" -Headers $h
Assert "agent-config" ($null -ne $cfg.mobile_config)
$visitFlag = $cfg.mobile_config.misc.visit_start_end_enabled
Write-Host "  visit_start_end_enabled=$visitFlag"
# Ro‘yxat endi mobil da doim ko‘rinadi; flag faqat start/stop uchun

$sync = Invoke-RestMethod -Uri "$Api/api/$Slug/mobile/sync/full" -Method POST -Headers $h -Body '{}' -ContentType "application/json"
$clientCount = @($sync.clients).Count
Assert "sync clients>0" ($clientCount -gt 0) "count=$clientCount"
Assert "sync products>0" (@($sync.products).Count -gt 0)

$cid = $sync.clients[0].id
$ctx = Invoke-RestMethod -Uri "$Api/api/$Slug/mobile/orders/create-context?selected_client_id=$cid" -Headers $h
$whCount = @($ctx.warehouses).Count
Assert "create-context warehouses>0" ($whCount -gt 0) "warehouses=$whCount (Продолжить uchun kerak)"
Write-Host "  warehouses=$whCount price_types=$((@($ctx.price_types)).Count)"
if ($whCount -gt 0) {
  Write-Host "  first warehouse: id=$($ctx.warehouses[0].id) name=$($ctx.warehouses[0].name)"
}

$rel = Invoke-RestMethod -Uri "$Api/api/mobile/app-release?slug=$Slug&version=3.1.5&platform=android"
Assert "app-release offers 3.1.6" (
  $rel.update.required -eq $true -or $rel.update.optional -eq $true -or $rel.policy.latest_version -eq "3.1.6"
) "latest=$($rel.policy.latest_version)"

Write-Host ""
if ($fail -eq 0) {
  Write-Host "=== ALL PASSED ===" -ForegroundColor Green
  exit 0
}
Write-Host "=== FAILED: $fail ===" -ForegroundColor Red
exit 1
