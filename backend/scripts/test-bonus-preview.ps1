$Base = "http://127.0.0.1:18080"
$login = Invoke-RestMethod -Uri "$Base/api/auth/login" -Method POST `
  -Body '{"slug":"test1","login":"agent","password":"111111"}' -ContentType "application/json"
$h = @{ Authorization = "Bearer $($login.accessToken)" }
$sync = Invoke-RestMethod -Uri "$Base/api/test1/mobile/sync/full" -Method POST -Headers $h -Body '{}' -ContentType "application/json"
$cid = $sync.clients[0].id
$ctx = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/create-context?selected_client_id=$cid" -Headers $h
$wid = $ctx.warehouses[0].id
$productId = $ctx.products[0].id
$pt = $ctx.price_types[0]
$body = @{
  client_id = $cid
  warehouse_id = $wid
  price_type = $pt
  items = @(@{ product_id = $productId; qty = 2 })
} | ConvertTo-Json -Depth 5
try {
  $preview = Invoke-RestMethod -Uri "$Base/api/test1/mobile/orders/bonus-preview" -Method POST -Headers $h -Body $body -ContentType "application/json"
  Write-Host "[OK] bonus-preview"
  Write-Host "eligible_bonuses: $($preview.eligible_bonuses.Count)"
  Write-Host "eligible_discounts: $($preview.eligible_discounts.Count)"
} catch {
  Write-Host "[FAIL] bonus-preview: $($_.Exception.Message)"
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
