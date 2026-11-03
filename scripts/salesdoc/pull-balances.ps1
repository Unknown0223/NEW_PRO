# Har bir diler kassasidagi mijoz saldo (yo‘nalishlar yig‘indisi).
# Parol muhitdan. Faylga parol yozilmaydi.
$ErrorActionPreference = "Stop"
$pass = $env:SALESDOC_PASSWORD
if (-not $pass) { throw "SALESDOC_PASSWORD yoq" }
$base = "https://aksitgroupcs.salesdoc.io"
$dealers = @(
  @{ id = 1; dir = "andijon" },
  @{ id = 2; dir = "namangan" },
  @{ id = 5; dir = "qoqon" },
  @{ id = 6; dir = "fargona" },
  @{ id = 7; dir = "xorazm" },
  @{ id = 8; dir = "nukus" },
  @{ id = 9; dir = "samarqand" },
  @{ id = 10; dir = "buxoro" },
  @{ id = 11; dir = "navoiy" }
)
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$null = Invoke-WebRequest -Uri "$base/user/login" -WebSession $s -UseBasicParsing
$null = Invoke-RestMethod -Uri "$base/user/login" -Method POST -WebSession $s -Body @{
  "LoginForm[username]" = "admin"
  "LoginForm[password]" = $pass
  "LoginForm[rememberMe]" = "1"
}
function Parse-Money([string]$raw) {
  $t = $raw.Trim()
  if (-not $t) { return 0.0 }
  $neg = $t.StartsWith("-")
  $n = [double](($t -replace "[^0-9.]", ""))
  if ($neg) { return -$n }
  return $n
}
foreach ($d in $dealers) {
  $open = Invoke-WebRequest -Uri "$base/directory/dealer/open?returnUrl=/clients/finans/report&id=$($d.id)" -WebSession $s -UseBasicParsing
  $user = [regex]::Match($open.Content, 'name="LoginForm\[username\]" value="([^"]+)"').Groups[1].Value
  $action = [regex]::Match($open.Content, 'action="([^"]+)"').Groups[1].Value
  $hostMatch = [regex]::Match($action, "^//([^/]+)/")
  if (-not $user -or -not $hostMatch.Success) { Write-Host "SKIP $($d.dir)"; continue }
  $hostName = $hostMatch.Groups[1].Value
  $dealerHost = "https://$hostName"
  $ds = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $null = Invoke-WebRequest -Uri "$dealerHost/site/login" -WebSession $ds -UseBasicParsing
  $null = Invoke-WebRequest -Uri "$dealerHost/site/login" -Method POST -WebSession $ds -Body @{
    "LoginForm[username]" = $user
    "LoginForm[password]" = $pass
  } -UseBasicParsing
  $r = Invoke-WebRequest -Uri "$dealerHost/clients/finans/AjaxReport/" -Method POST -WebSession $ds -ContentType "application/x-www-form-urlencoded" -Body "draw=1&start=0&length=5" -UseBasicParsing
  $parsed = $r.Content | ConvertFrom-Json
  $sum = @{}
  foreach ($row in @($parsed.data)) {
    $id = "$($row[0])".Trim()
    if (-not $id) { continue }
    $bal = Parse-Money "$($row[11])"
    if ($sum.ContainsKey($id)) { $sum[$id] += $bal } else { $sum[$id] = $bal }
  }
  $clients = foreach ($id in $sum.Keys) {
    [ordered]@{ id = $id; balance = [math]::Round($sum[$id], 2) }
  }
  $dir = Join-Path "D:\salesdoc-pull" $d.dir
  New-Item -ItemType Directory -Force -Path (Join-Path $dir "06-pul") | Out-Null
  $out = Join-Path $dir "06-pul\client-balances.json"
  @{ note = "Kassa kartasi. Yo'nalishlar yig'indisi. Manfiy = qarz."; clients = @($clients) } |
    ConvertTo-Json -Depth 5 -Compress |
    ForEach-Object { [IO.File]::WriteAllText($out, $_, [Text.UTF8Encoding]::new($false)) }
  $total = 0.0
  foreach ($v in $sum.Values) { $total += $v }
  Write-Host "$($d.dir) clients=$($sum.Count) sum=$([math]::Round($total,0))"
}
Write-Host "BALANCES_DONE"
