# Bonus 5+1 scoped — mahalliy smoke test
# Ishlatish: pwsh backend/scripts/test-bonus-5plus1.ps1 [-BaseUrl http://127.0.0.1:18080]

param(
  [string]$Base = "http://127.0.0.1:18080",
  [int]$Qty = 10
)

$fail = 0
function Assert($name, $cond, $detail = "") {
  if ($cond) { Write-Host "[OK] $name" -ForegroundColor Green }
  else { Write-Host "[FAIL] $name $detail" -ForegroundColor Red; $script:fail++ }
}

$login = Invoke-RestMethod -Uri "$Base/api/auth/login" -Method POST `
  -Body '{"slug":"test1","login":"agent","password":"111111"}' -ContentType "application/json"
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Assert "login" ($login.user.role -eq "agent")

$rules = Invoke-RestMethod -Uri "$Base/api/test1/bonus-rules?is_active=true" -Headers $h
$rule = $rules.data | Where-Object { $_.name -like "*5*1*" -or $_.name -eq "5+1" } | Select-Object -First 1
if (-not $rule) {
  Write-Host "5+1 qoida topilmadi — preview umumiy qty bilan tekshiriladi" -ForegroundColor Yellow
}

$sync = Invoke-RestMethod -Uri "$Base/api/test1/mobile/sync/full" -Method POST -Headers $h -Body '{}' -ContentType "application/json"
$cid = $sync.clients[0].id
$ctx = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/create-context?selected_client_id=$cid" -Headers $h
$wid = $ctx.warehouses[0].id

$prod = $null
if ($rule -and $rule.product_ids.Count -gt 0) {
  $pid = $rule.product_ids[0]
  $prod = $sync.products | Where-Object { $_.id -eq $pid } | Select-Object -First 1
}
if (-not $prod) {
  $prod = $sync.products | Where-Object { $_.name -like "*TURSIK*" } | Select-Object -First 1
}
if (-not $prod) { $prod = $sync.products[0] }
Write-Host "product: $($prod.id) $($prod.name)" -ForegroundColor Cyan

$previewBody = @{
  client_id = $cid
  warehouse_id = $wid
  price_type = "retail"
  items = @(@{ product_id = $prod.id; qty = $Qty })
} | ConvertTo-Json -Depth 5

$preview = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/bonus-preview" -Method POST -Headers $h -Body $previewBody -ContentType "application/json"
$expected = [math]::Floor($Qty / 5)
Assert "eligible bonuses" ($preview.eligible_bonuses.Count -gt 0) "none"
if ($preview.eligible_bonuses.Count -gt 0) {
  $b = $preview.eligible_bonuses[0]
  Write-Host "  rule=$($b.name) bonus_qty=$($b.bonus_qty) expected~$expected" -ForegroundColor Cyan
  Assert "bonus_qty >= $expected" ($b.bonus_qty -ge $expected) "got $($b.bonus_qty)"
}
Assert "auto_apply gifts" ($preview.auto_apply.bonus_gifts.Count -gt 0) ($preview.auto_apply | ConvertTo-Json -Compress)

$createBody = @{
  client_id = $cid
  warehouse_id = $wid
  apply_bonus = $true
  price_type = "retail"
  items = @(@{ product_id = $prod.id; qty = $Qty })
} | ConvertTo-Json -Depth 5

$order = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/create" -Method POST -Headers $h -Body $createBody -ContentType "application/json"
Assert "order created" ($order.id -gt 0)
Write-Host "order #$($order.id) bonus_sum=$($order.bonus_sum)" -ForegroundColor Cyan
Assert "order bonus_sum > 0" ([double]$order.bonus_sum -gt 0) "bonus_sum=$($order.bonus_sum)"

if ($fail -gt 0) { exit 1 }
Write-Host "`nBonus 5+1 test o'tdi." -ForegroundColor Cyan
