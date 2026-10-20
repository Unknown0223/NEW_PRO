# Andijon (diler 1) ni SalesDoc dan guruhlab olish.
# Parol faylga yozilmaydi. Ishga tushirishdan oldin:
#   $env:SALESDOC_PASSWORD = "..."
# Foto hisobotlar olinmaydi.
param(
  [int]$DealerId = 1,
  [string]$DealerName = "Andijon",
  [string]$From = "2020-01-01",
  [string]$To = (Get-Date -Format "yyyy-MM-dd"),
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath("Desktop")) "salesdoc-andijon"),
  [ValidateSet("all", "1", "2", "3", "4", "5", "6", "7", "8")]
  [string]$Group = "all"
)

$ErrorActionPreference = "Stop"
$base = "https://aksitgroupcs.salesdoc.io"
$user = if ($env:SALESDOC_USER) { $env:SALESDOC_USER } else { "admin" }
$pass = $env:SALESDOC_PASSWORD
if (-not $pass) { throw "SALESDOC_PASSWORD berilmagan." }

function Want([string]$n) { $Group -eq "all" -or $Group -eq $n }

function Save-Json([string]$folder, [string]$name, $obj) {
  $dir = Join-Path $OutDir $folder
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $path = Join-Path $dir $name
  $json = $obj | ConvertTo-Json -Depth 40 -Compress
  [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
  $len = (Get-Item $path).Length
  Write-Host "$folder/$name  $len bayt"
}

function Save-Raw([string]$folder, [string]$name, [string]$text) {
  $dir = Join-Path $OutDir $folder
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $path = Join-Path $dir $name
  [IO.File]::WriteAllText($path, $text, [Text.UTF8Encoding]::new($false))
  $len = (Get-Item $path).Length
  Write-Host "$folder/$name  $len bayt"
}

function Read-ErrorBody($err) {
  $detail = $err.Exception.Message
  $resp = $err.Exception.Response
  if ($resp) {
    try {
      $stream = $resp.GetResponseStream()
      if ($stream) {
        $reader = New-Object IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
        if ($text) {
          $flat = ($text -replace '\s+', ' ')
          $detail = $flat.Substring(0, [Math]::Min(240, $flat.Length))
        }
      }
    } catch {}
  }
  return $detail
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$null = Invoke-WebRequest -Uri "$base/user/login" -WebSession $session -UseBasicParsing
$loginBody = @{
  "LoginForm[username]" = $user
  "LoginForm[password]" = $pass
  "LoginForm[rememberMe]" = "1"
}
$login = Invoke-RestMethod -Uri "$base/user/login" -Method POST -WebSession $session -Body $loginBody
if (-not $login.result) { throw "Login rad etildi." }
Write-Host "Kirish ochildi. Diler: $DealerName ($DealerId). $From .. $To"

function Post-Sd([string]$path, $body) {
  $json = if ($null -eq $body) { "{}" } else { $body | ConvertTo-Json -Depth 12 -Compress }
  try {
    return Invoke-RestMethod -Uri "$base$path" -Method POST -WebSession $session -ContentType "application/json; charset=utf-8" -Body $json
  } catch {
    throw "$path : $(Read-ErrorBody $_)"
  }
}

function Post-SdRaw([string]$path, [string]$json) {
  try {
    $r = Invoke-WebRequest -Uri "$base$path" -Method POST -WebSession $session -ContentType "application/json; charset=utf-8" -Body $json -UseBasicParsing
    return $r.Content
  } catch {
    throw "$path : $(Read-ErrorBody $_)"
  }
}

function Get-SdRaw([string]$pathAndQuery) {
  try {
    $r = Invoke-WebRequest -Uri "$base$pathAndQuery" -WebSession $session -UseBasicParsing
    return $r.Content
  } catch {
    throw "$pathAndQuery : $(Read-ErrorBody $_)"
  }
}

function Get-BalancedJson([string]$html, [string]$marker) {
  $at = $html.IndexOf($marker)
  if ($at -lt 0) { throw "Sahifada marker topilmadi: $marker" }
  $i = $html.IndexOf("{", $at)
  $depth = 0
  $inStr = $false
  $esc = $false
  for ($p = $i; $p -lt $html.Length; $p++) {
    $c = $html[$p]
    if ($inStr) {
      if ($esc) { $esc = $false; continue }
      if ($c -eq "\") { $esc = $true; continue }
      if ($c -eq '"') { $inStr = $false }
      continue
    }
    if ($c -eq '"') { $inStr = $true; continue }
    if ($c -eq "{") { $depth++ }
    elseif ($c -eq "}") {
      $depth--
      if ($depth -eq 0) {
        return $html.Substring($i, $p - $i + 1) | ConvertFrom-Json
      }
    }
  }
  throw "JSON yopilmagan: $marker"
}

function Get-PageJson([string]$path, [string]$marker) {
  $html = Get-SdRaw $path
  return Get-BalancedJson $html $marker
}

function Each-Month([datetime]$start, [datetime]$end, [scriptblock]$action) {
  $cursor = $start
  while ($cursor -le $end) {
    $monthEnd = $cursor.AddMonths(1).AddDays(-1)
    if ($monthEnd -gt $end) { $monthEnd = $end }
    & $action $cursor $monthEnd
    $cursor = $monthEnd.AddDays(1)
  }
}

$sellFields = {
  param($a, $b)
  @{
    orderType = @(2, 3)
    dateType = "order.DATE_LOAD"
    forecast = $false
    product_id = @()
    type = 2
    header_label = @()
    category_id = @()
    client_category_id = @()
    sub_cat_id = @()
    dealer_id = "$DealerId"
    trade_id = $null
    group_id = @()
    brand_id = @()
    segment_id = @()
    channel_id = @()
    store = $false
    label = 0
    current_country_id = $null
    date = @($a, $b)
  }
}

$purchaseFields = {
  param($a, $b)
  @{
    forecast = $false
    product_id = @()
    type = 2
    header_label = $null
    category_id = @()
    client_category_id = $null
    dealer_id = "$DealerId"
    trade_id = $null
    group_id = $null
    brand_id = $null
    segment_id = $null
    channel_id = $null
    store = $false
    label = 0
    current_country_id = $null
    date = @($a, $b)
  }
}

$returnFields = @(
  "dealer.id", "dealer.name", "order.ORDER_ID", "order.STATUS", "order.client.NAME",
  "order.agent.FIO", "product.PRODUCT_ID", "product.NAME", "order.rejectDefect.NAME",
  "t.SUMMA", "t.COUNT", "t.DEFECT", "t.VOLUME"
)

if (Want "1") {
  $filials = Post-Sd "/directory/api/getFilials" @{ current_country_id = $null }
  Save-Json "01-hudud" "filials.json" $filials
}

if (Want "2") {
  $page = Get-PageJson "/directory/product" '))({"data":'
  Save-Json "02-tovar" "products.json" $page
}

if (Want "3") {
  $columns = $null
  $agents = $null
  $rows = New-Object System.Collections.Generic.List[object]
  $year = [datetime]::Parse($From)
  $end = [datetime]::Parse($To)
  while ($year -le $end) {
    $yearEnd = Get-Date -Year $year.Year -Month 12 -Day 31
    if ($yearEnd -gt $end) { $yearEnd = $end }
    $a = $year.ToString("yyyy-MM-dd")
    $b = $yearEnd.ToString("yyyy-MM-dd")
    # Sahifa filial_id=0 yuboradi. filial_id=1 serverda 500 beradi.
    $pack = Post-Sd "/report/clientData/getData" @{
      current_country_id = $null
      date = @($a, $b)
      filial_id = 0
      client_cat_id = ""
      agent_id = ""
      active = 0
      dateType = 1
    }
    if ($pack -is [System.Array] -and $pack.Count -ge 2) {
      $columns = $pack[0]
      $agents = $pack[$pack.Count - 1]
      $dilerIdx = [array]::IndexOf($columns, "diler")
      for ($i = 1; $i -lt $pack.Count - 1; $i++) {
        $row = $pack[$i]
        if ($dilerIdx -ge 0 -and "$($row[$dilerIdx])" -ne $DealerName) { continue }
        $rows.Add($row)
      }
    }
    Write-Host "mijoz $a..$b  jami $DealerName $($rows.Count)"
    $year = $yearEnd.AddDays(1)
  }
  Save-Json "03-mijoz" "clients.json" @{
    note = "filial_id=0 javobidan $DealerName qatorlari. dateType=1."
    columns = $columns
    agents = $agents
    rows = $rows
  }
}

if (Want "4") {
  $stock = Post-Sd "/report/store/getData" @{
    active_stores = $false
    all_actives = $false
    all = $false
    type = 1
    category_id = @()
    group_id = $null
    brand_id = @()
    current_country_id = $null
    label = 0
    label_order = 0
    store_type = @()
    price_type = $null
  }
  $otherIds = @("2", "5", "6", "7", "8", "9", "10", "11")
  $andijonStock = @()
  foreach ($row in @($stock.data)) {
    $copy = [ordered]@{}
    foreach ($p in $row.PSObject.Properties) {
      if ($otherIds -contains $p.Name) { continue }
      $copy[$p.Name] = $p.Value
    }
    $andijonStock += [pscustomobject]$copy
  }
  Save-Json "04-ombor" "stock-$To.json" @{
    note = "Qoldiq hisoboti, qator tarixi emas. Ustun 1 = Andijon."
    result = $stock.result
    data = $andijonStock
  }
  $script:chunks = @()
  Each-Month ([datetime]::Parse($From)) ([datetime]::Parse($To)) {
    param($s, $e)
    $a = $s.ToString("yyyy-MM-dd")
    $b = $e.ToString("yyyy-MM-dd")
    $purchase = Post-Sd "/report/purchase/getData" (& $purchaseFields $a $b)
    $script:chunks += @{ from = $a; to = $b; data = $purchase.data }
    Write-Host "kirim $a..$b"
  }
  Save-Json "04-ombor" "purchase.json" @{
    note = "dealer_id=$DealerId. getData kirim yig'indisi."
    months = $script:chunks
  }
}

if (Want "5") {
  Each-Month ([datetime]::Parse($From)) ([datetime]::Parse($To)) {
    param($s, $e)
    $a = $s.ToString("yyyy-MM-dd")
    $b = $e.ToString("yyyy-MM-dd")
    $sales = Post-Sd "/report/sell/getData" (& $sellFields $a $b)
    Save-Json "05-buyurtma" "sell-$a.json" @{
      note = "Kunlik yig'indi, qator tarixi emas. Qatorlar: sale-lines."
      data = $sales.data
      totals = $sales.totals
    }
    $q = "/pivot/saleDetail/pivotData?date_load=$a,$b&status=1,2,3,4&filials=$DealerId&orderType=all"
    $lines = Get-SdRaw $q
    Save-Raw "05-buyurtma" "sale-lines-$a.json" $lines
  }
  Each-Month ([datetime]::Parse($From)) ([datetime]::Parse($To)) {
    param($s, $e)
    $a = $s.ToString("yyyy-MM-dd")
    $b = $e.ToString("yyyy-MM-dd")
    $json = @{
      conditions = @{ "dealer.id" = "$DealerId" }
      category_id = $null
      trade_id = $null
      group_id = $null
      label = 0
      current_country_id = $null
      date = @($a, $b)
      type = 1
      dateBy = "DATE_LOAD"
      status = @(2, 3, 4)
      fields = $returnFields
    } | ConvertTo-Json -Depth 6 -Compress
    $raw = Post-SdRaw "/pivot/defect/getData" $json
    Save-Raw "05-buyurtma" "returns-$a.json" $raw
  }
}

if (Want "6") {
  $debt = Post-Sd "/report/debt/getData" @{ current_country_id = $null }
  $one = @($debt.data | Where-Object { "$($_.id)" -eq "$DealerId" })
  Save-Json "06-pul" "debt.json" @{
    note = "Joriy debitor yig'indisi, to'lov tarixi emas."
    data = $one
  }
  Each-Month ([datetime]::Parse($From)) ([datetime]::Parse($To)) {
    param($s, $e)
    $a = $s.ToString("yyyy-MM-dd")
    $b = $e.ToString("yyyy-MM-dd")
    $cash = Post-Sd "/pivot/transactions/pivotData" @{
      filial_id = $DealerId
      trans_type_id = @(1, 2, 3, 4, 5, 6, 7, 8, 9)
      currency_id = @()
      trade_direction_id = @()
      date = @($a, $b)
    }
    Save-Json "06-pul" "cash-$a.json" $cash
  }
  # Diler kassasi soatni qaytaradi (CS3 pivot faqat sana). Izoh ustuni yo‘q.
  $open = Get-SdRaw "/directory/dealer/open?returnUrl=/clients/finans/report&id=$DealerId"
  $dealerUser = [regex]::Match($open, 'name="LoginForm\[username\]" value="([^"]+)"').Groups[1].Value
  # aksitgroup logini hozircha faqat Andijon kassasini ochadi. Boshqa dilerda soat yozilmaydi.
  if ($DealerId -eq 1 -and $dealerUser) {
    $dealer = "https://aksitgroup.salesdoc.io"
    $ds = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $null = Invoke-WebRequest -Uri "$dealer/site/login" -WebSession $ds -UseBasicParsing
    $null = Invoke-WebRequest -Uri "$dealer/site/login" -Method POST -WebSession $ds -Body @{
      "LoginForm[username]" = $dealerUser
      "LoginForm[password]" = $pass
    } -UseBasicParsing
    Each-Month ([datetime]::Parse($From)) ([datetime]::Parse($To)) {
      param($s, $e)
      $a = $s.ToString("dd-MM-yyyy")
      $b = $e.ToString("dd-MM-yyyy")
      $body = "{`"startDate`":`"$a 00:00:00`",`"endDate`":`"$b 23:59:59`"}"
      $raw = Invoke-WebRequest -Uri "$dealer/clients/finans/getData" -Method POST -WebSession $ds -ContentType "application/json" -Body $body -UseBasicParsing
      $stamp = $s.ToString("yyyy-MM-dd")
      Save-Raw "06-pul" "cash-clock-$stamp.json" $raw.Content
    }
  }
}

if (Want "7") {
  $page = Get-PageJson "/directory/bonus" '})({"data":['
  $list = @($page.data | Where-Object { @($_.filials) -contains "$DealerId" })
  $details = @()
  foreach ($item in $list) {
    $id = "$($item.id)"
    try {
      $details += Post-Sd "/directory/bonus/getBonus" @{ id = $id }
    } catch {
      $details += @{ id = $id; error = $_.Exception.Message }
    }
  }
  Save-Json "07-bonus" "bonus.json" @{
    list = $list
    details = $details
  }
}

if (Want "8") {
  $agents = Post-Sd "/report/agent/getAgents" @{}
  $sale = Get-SdRaw "/pivot/saleDetail/dilerCatalog?filial=$DealerId" | ConvertFrom-Json
  $inv = Get-SdRaw "/report/pivotInventory/dilerCatalog?filial=$DealerId" | ConvertFrom-Json
  function Rows($table) { return @($table | Select-Object -Skip 1) }
  function Fid($id) { return "$id" -replace "^f$DealerId-", "" }
  $agentById = @{}
  foreach ($r in @(if ($agents.data) { $agents.data | Select-Object -Skip 1 })) {
    if ("$($r[7])" -ne $DealerName) { continue }
    $agentById["$($r[0])"] = $r
  }
  $agentRows = @()
  foreach ($r in (Rows $sale.agents)) {
    if ("$($r[0])" -notlike "f$DealerId-*") { continue }
    $id = Fid $r[0]
    $extra = $agentById[$id]
    $agentRows += [ordered]@{
      id = $id
      name = "$($r[1])"
      code = "$($r[2])"
      phone = if ($extra) { "$($extra[3])" } else { "" }
      active = if ($extra) { "$($extra[4])" -match "Актив" } else { $true }
      kind = if ($extra) { "$($extra[5])" } else { "" }
    }
  }
  $expRows = @()
  foreach ($r in (Rows $sale.expeditors)) {
    if ("$($r[0])" -notlike "f$DealerId-*") { continue }
    $expRows += [ordered]@{ id = (Fid $r[0]); name = "$($r[1])" }
  }
  $svRows = @()
  foreach ($r in (Rows $sale.supervisors)) {
    if ("$($r[0])" -notlike "f$DealerId-*") { continue }
    $svRows += [ordered]@{
      id = (Fid $r[0])
      name = "$($r[1])"
      code = "$($r[2])"
      agents = @("$($r[3])" -split "," | ForEach-Object { Fid $_.Trim() } | Where-Object { $_ })
    }
  }
  $userRows = @()
  foreach ($r in (Rows $inv.users)) {
    if ("$($r[0])" -notlike "f$DealerId-*") { continue }
    $userRows += [ordered]@{ id = (Fid $r[0]); name = "$($r[1])" }
  }
  $storeRows = @()
  foreach ($r in (Rows $sale.stores)) {
    if ("$($r[0])" -notlike "f$DealerId-*") { continue }
    $storeRows += [ordered]@{ id = (Fid $r[0]); name = "$($r[1])" }
  }
  Save-Json "08-xodim" "staff.json" @{
    note = "Andijon filial. agent id, expeditor id va user id alohida."
    agents = $agentRows
    expeditors = $expRows
    supervisors = $svRows
    users = $userRows
    stores = $storeRows
  }
}

Write-Host "Tayyor: $OutDir"
