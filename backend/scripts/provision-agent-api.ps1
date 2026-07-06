$ErrorActionPreference = "Stop"
$base = "https://backend-production-3cf2.up.railway.app"
$slug = "test1"

$loginBody = @{ slug = $slug; login = "admin"; password = "secret123" } | ConvertTo-Json
$auth = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body $loginBody
$token = $auth.accessToken
$headers = @{ Authorization = "Bearer $token" }

$agents = Invoke-RestMethod -Method Get -Uri "$base/api/$slug/agents" -Headers $headers
$existing = @($agents.data) | Where-Object { $_.login -eq "agent" }
if ($existing.Count -gt 0) {
  Write-Host "Agent allaqachon mavjud: login=agent id=$($existing[0].id)"
  exit 0
}

$wh = Invoke-RestMethod -Method Get -Uri "$base/api/$slug/warehouses/pickers" -Headers $headers
$whId = $null
if ($wh.data -and $wh.data.Count -gt 0) { $whId = $wh.data[0].id }

$createBody = @{
  first_name = "Agent"
  login = "agent"
  password = "111111"
  can_authorize = $true
  agent_entitlements = @{
    price_types = @("default")
    product_rules = @()
    mobile_config = @{ sync = @{ block_sync = $false } }
  }
}
if ($whId) { $createBody.warehouse_id = $whId }

$json = $createBody | ConvertTo-Json -Depth 6 -Compress
$res = Invoke-RestMethod -Method Post -Uri "$base/api/$slug/agents" -Headers $headers -ContentType "application/json" -Body $json
Write-Host "Agent yaratildi: login=agent parol=111111 id=$($res.id)"
