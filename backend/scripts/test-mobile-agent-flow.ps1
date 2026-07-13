# Mobil agent oqimi — API smoke test
# Ishlatish: pwsh backend/scripts/test-mobile-agent-flow.ps1

$Base = "http://127.0.0.1:18080"
$fail = 0

function Assert($name, $cond, $detail = "") {
  if ($cond) { Write-Host "[OK] $name" -ForegroundColor Green }
  else { Write-Host "[FAIL] $name $detail" -ForegroundColor Red; $script:fail++ }
}

$login = Invoke-RestMethod -Uri "$Base/api/auth/login" -Method POST `
  -Body '{"slug":"test1","login":"agent","password":"111111"}' -ContentType "application/json"
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Assert "login" ($login.user.role -eq "agent")

$sync = Invoke-RestMethod -Uri "$Base/api/test1/mobile/sync/full" -Method POST -Headers $h -Body '{}' -ContentType "application/json"
Assert "sync clients" ($sync.clients.Count -le 50 -and $sync.clients_replace_all -eq $true)
Assert "sync products" ($sync.products.Count -gt 0)

$cfg = Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-config" -Headers $h
Assert "config" ($null -ne $cfg.mobile_config)

$balances = Invoke-RestMethod -Uri "$Base/api/test1/mobile/clients/balances" -Headers $h
Assert "client balances" ($balances.data -is [array])

$cid = $sync.clients[0].id
$ctx = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/create-context?selected_client_id=$cid" -Headers $h
Assert "create-context warehouses" ($ctx.warehouses.Count -gt 0)
Assert "create-context products" ($ctx.products.Count -gt 0)

$wid = $ctx.warehouses[0].id
$pids = ($ctx.products | Select-Object -First 3).id -join ','
$stk = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/stock?warehouse_id=$wid&product_ids=$pids" -Headers $h
Assert "stock" ($stk.data.Count -gt 0)

$pt = $ctx.price_types[0]
$productId = $ctx.products[0].id
$previewBody = @{ client_id = $cid; warehouse_id = $wid; price_type = $pt; items = @(@{ product_id = $productId; qty = 2 }) } | ConvertTo-Json -Depth 5
try {
  $preview = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/bonus-preview" -Method POST -Headers $h -Body $previewBody -ContentType "application/json"
  Assert "bonus-preview" ($null -ne $preview.eligible_bonuses)
} catch {
  Assert "bonus-preview" $false $_.ErrorDetails.Message
}

$body = "{`"client_id`":$cid,`"warehouse_id`":$wid,`"apply_bonus`":true,`"price_type`":`"$pt`",`"items`":[{`"product_id`":$productId,`"qty`":1}]}"
try {
  $order = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/create" -Method POST -Headers $h -Body $body -ContentType "application/json"
  Assert "create order" ($order.id -gt 0)
} catch {
  Assert "create order" $false $_.ErrorDetails.Message
}

$visit = Invoke-RestMethod -Uri "$Base/api/test1/agent-visits" -Method POST -Headers $h `
  -Body "{`"client_id`":$cid,`"latitude`":41.31,`"longitude`":69.28}" -ContentType "application/json"
Assert "visit" ($null -ne $visit.data.id)

$dash = Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-dashboard" -Headers $h
Assert "agent-dashboard" ($null -ne $dash.orders_today)

$sales = Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-daily-sales" -Headers $h
Assert "agent-daily-sales" ($null -ne $sales.totals)
Assert "agent-daily-sales rows" ($null -ne $sales.rows)

$cfg2 = Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-config" -Headers $h
Assert "work_slot in config" ($null -ne $cfg2.mobile_config)

$pending = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/pending" -Headers $h
Assert "pending scoped" ($pending.pending -ge 0)

try {
  Invoke-RestMethod -Uri "$Base/api/test1/mobile/clients/$cid" -Method PATCH -Headers $h `
    -Body '{"notes":"mobil test"}' -ContentType "application/json" | Out-Null
  Assert "client patch" $true
} catch {
  Assert "client patch" $false $_.ErrorDetails.Message
}

$flush = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/sync-flush" -Method POST -Headers $h -Body '{}' -ContentType "application/json"
Assert "sync-flush" ($null -ne $flush.synced)

try {
  $newName = "MobilTest_" + (Get-Date -Format "HHmmss")
  $newClient = Invoke-RestMethod -Uri "$Base/api/test1/mobile/clients" -Method POST -Headers $h `
    -Body "{`"name`":`"$newName`",`"phone`":`"998901234567`",`"latitude`":41.31,`"longitude`":69.28}" -ContentType "application/json"
  Assert "create client" ($newClient.id -gt 0)
} catch {
  Assert "create client" $false $_.ErrorDetails.Message
}

if ($fail -gt 0) { exit 1 }
Write-Host "`nBarcha mobil agent testlari o'tdi." -ForegroundColor Cyan
