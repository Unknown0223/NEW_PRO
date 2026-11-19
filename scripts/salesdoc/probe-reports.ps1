# SalesDoc Отчёт: CS login → diler ochish → menyu + stub match + sahifa probe.
# Parol faylga yozilmaydi.
#
# Katalog:
#   $env:SALESDOC_PASSWORD = "..."
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/salesdoc/probe-reports.ps1
#
# Bitta sahifa:
#   ... -Slug "client-sales-3" -FetchSample -SaveHtml

param(
  [string]$BaseUrl = "https://aksitgroupcs.salesdoc.io",
  [string]$User = $(if ($env:SALESDOC_USER) { $env:SALESDOC_USER } else { "admin" }),
  [string]$Password = $env:SALESDOC_PASSWORD,
  [int]$DealerId = 1,
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath("Desktop")) "salesdoc-reports-probe"),
  [string]$Slug = "",
  [string]$PageUrl = "",
  [switch]$FetchSample,
  [switch]$SaveHtml,
  [switch]$MatchOnly,
  [int]$HtmlMaxKb = 800,
  [switch]$CsOnly
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not $Password) {
  throw "Parol yo‘q. `$env:SALESDOC_PASSWORD yoki -Password bering."
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$mapPath = Join-Path $PSScriptRoot "report-stubs-map.json"
if (-not (Test-Path $mapPath)) { throw "Topilmadi: $mapPath" }
$map = Get-Content -LiteralPath $mapPath -Raw -Encoding UTF8 | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$pagesDir = Join-Path $OutDir "pages"
New-Item -ItemType Directory -Force -Path $pagesDir | Out-Null

function Save-Json([string]$path, $obj) {
  $dir = Split-Path -Parent $path
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  # -InputObject: Generic.List / pipeline type mismatch oldini oladi
  if ($null -eq $obj) {
    $json = "null"
  } elseif ($obj -is [System.Collections.IList] -and -not ($obj -is [string])) {
    $json = ConvertTo-Json -InputObject @($obj) -Depth 40
  } else {
    $json = ConvertTo-Json -InputObject $obj -Depth 40
  }
  [IO.File]::WriteAllText($path, $json, [Text.UTF8Encoding]::new($false))
  $rel = $path
  try { $rel = (Resolve-Path $path).Path.Replace((Resolve-Path $OutDir).Path + "\", "") } catch {}
  Write-Host ("OK  {0}  {1} bayt" -f $rel, (Get-Item $path).Length)
}

function Read-ErrorBody($err) {
  $detail = $err.Exception.Message
  try {
    $resp = $err.Exception.Response
    if ($resp) {
      $stream = $resp.GetResponseStream()
      if ($stream) {
        $reader = New-Object IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
        if ($text) {
          $flat = ($text -replace '\s+', ' ')
          $detail = $flat.Substring(0, [Math]::Min(280, $flat.Length))
        }
      }
    }
  } catch {}
  return $detail
}

function Norm-Text([string]$s) {
  if (-not $s) { return "" }
  return (($s -replace '\s+', ' ').Trim().ToLowerInvariant())
}

function Get-BalancedJson([string]$text, [int]$braceStart) {
  $stack = 0
  $inStr = $false
  $esc = $false
  $quote = [char]0
  for ($p = $braceStart; $p -lt $text.Length; $p++) {
    $c = $text[$p]
    if ($inStr) {
      if ($esc) { $esc = $false; continue }
      if ($c -eq "\") { $esc = $true; continue }
      if ($c -eq $quote) { $inStr = $false }
      continue
    }
    if ($c -eq '"' -or $c -eq "'") { $inStr = $true; $quote = $c; continue }
    if ($c -eq "{" -or $c -eq "[") { $stack++; continue }
    if ($c -eq "}" -or $c -eq "]") {
      $stack--
      if ($stack -eq 0) { return $text.Substring($braceStart, $p - $braceStart + 1) }
    }
  }
  return $null
}

function Flatten-MenuNode($node, [string]$parent, $sink) {
  $name = [string]$node.name
  $url = [string]$node.url
  [void]$sink.Add([pscustomobject]@{ source = "cs"; parent = $parent; name = $name; href = $url })
  if ($node.items) {
    foreach ($child in @($node.items)) {
      Flatten-MenuNode $child $name $sink
    }
  }
}

function Extract-CsMenu([string]$html) {
  $mark = $html.IndexOf('})({"data":')
  if ($mark -lt 0) { $mark = $html.IndexOf('({"data":') }
  if ($mark -lt 0) { return @() }
  $brace = $html.IndexOf("{", $mark)
  $json = Get-BalancedJson $html $brace
  if (-not $json) { return @() }
  $obj = $json | ConvertFrom-Json
  $menuObj = if ($obj.data) { $obj.data } else { $obj }
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($prop in $menuObj.PSObject.Properties) {
    Flatten-MenuNode $prop.Value "" $rows
  }
  return $rows.ToArray()
}

function Extract-DealerSidebar([string]$html) {
  $rows = New-Object System.Collections.Generic.List[object]
  $rx = [regex]'<a\s+href="([^"]+)"\s*>\s*<span\s*>\s*([^<]+?)\s*</span>'
  foreach ($m in $rx.Matches($html)) {
    $href = $m.Groups[1].Value.Trim()
    $name = ($m.Groups[2].Value -replace '\s+', ' ').Trim()
    if (-not $href -or $href -eq "#" -or $href.StartsWith("javascript:")) { continue }
    if ($href -notmatch '/(report|pivot|clients/|finans|stock/report|orders/recovery)') { continue }
    $rows.Add([pscustomobject]@{ source = "dealer"; parent = ""; name = $name; href = $href })
  }
  # dedupe by href+name
  return @($rows | Group-Object href, name | ForEach-Object { $_.Group[0] })
}

function Match-Stub($stub, $links) {
  $best = $null
  $bestScore = 0
  $label = Norm-Text $stub.label
  # ё/е yumshatish
  $labelFlat = $label -replace "ё", "е"
  foreach ($link in $links) {
    $name = Norm-Text $link.name
    $nameFlat = $name -replace "ё", "е"
    $href = Norm-Text $link.href
    $blob = "$name $href"
    $score = 0
    if ($labelFlat -and $nameFlat -eq $labelFlat) { $score += 100 }
    elseif ($labelFlat -and $nameFlat.Contains($labelFlat)) { $score += 40 }
    foreach ($key in @($stub.search)) {
      $k = (Norm-Text $key) -replace "ё", "е"
      if (-not $k) { continue }
      if ($nameFlat -eq $k) { $score += 50 }
      elseif ($nameFlat.Contains($k)) { $score += 15 + [Math]::Min(20, $k.Length) }
      elseif (($blob -replace "ё","е").Contains($k)) { $score += 8 }
    }
    # versiya chalkashligi: "sku 3" ↔ "sku 2" kabi
    if ($labelFlat -match '(\d+(?:\.\d+)?)' -and $nameFlat -match '(\d+(?:\.\d+)?)') {
      if ($Matches[1] -ne $null) {
        $lv = [regex]::Match($labelFlat, '(\d+(?:\.\d+)?)').Groups[1].Value
        $nv = [regex]::Match($nameFlat, '(\d+(?:\.\d+)?)').Groups[1].Value
        if ($lv -and $nv -and $lv -ne $nv) { $score -= 40 }
      }
    }
    if ($score -gt $bestScore) {
      $bestScore = $score
      $best = $link
    }
  }
  if ($bestScore -lt 20) { return $null }
  return [pscustomobject]@{ href = $best.href; name = $best.name; source = $best.source; score = $bestScore }
}

function Extract-Endpoints([string]$html) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($m in [regex]::Matches($html, '(?i)["''](/[a-z0-9_./?-]*(?:report|pivot|ajax|getData|export|download|Data)[a-z0-9_./?-]*)["'']')) {
    $v = $m.Groups[1].Value
    if ($v.Length -gt 220) { continue }
    if ($v -match '\.(css|png|jpg|jpeg|gif|svg|woff2?|ico)(\?|$)') { continue }
    [void]$set.Add($v)
  }
  return @($set | Sort-Object)
}

function Extract-Filters([string]$html) {
  $filters = New-Object System.Collections.Generic.List[object]
  foreach ($m in [regex]::Matches($html, '<(input|select|textarea)\b([^>]*)>')) {
    $tag = $m.Groups[1].Value.ToLowerInvariant()
    $attrs = $m.Groups[2].Value
    $name = [regex]::Match($attrs, '(?i)\bname\s*=\s*"([^"]+)"').Groups[1].Value
    $id = [regex]::Match($attrs, '(?i)\bid\s*=\s*"([^"]+)"').Groups[1].Value
    $type = [regex]::Match($attrs, '(?i)\btype\s*=\s*"([^"]+)"').Groups[1].Value
    if (-not $name -and -not $id) { continue }
    if ($type -match '^(hidden|submit|button|password)$') { continue }
    $filters.Add([pscustomobject]@{ tag = $tag; name = $name; id = $id; type = $type })
  }
  return $filters.ToArray()
}

function Extract-Title([string]$html) {
  $m = [regex]::Match($html, '(?is)<title[^>]*>(.*?)</title>')
  if ($m.Success) { return (($m.Groups[1].Value -replace '\s+', ' ').Trim()) }
  return ""
}

# --- Login CS ---
$cs = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Write-Host "Login CS: $BaseUrl user=$User"
$null = Invoke-WebRequest -Uri "$BaseUrl/user/login" -WebSession $cs -UseBasicParsing
$login = Invoke-RestMethod -Uri "$BaseUrl/user/login" -Method POST -WebSession $cs -Body @{
  "LoginForm[username]" = $User
  "LoginForm[password]" = $Password
  "LoginForm[rememberMe]" = "1"
}
if (-not $login.result) { throw "CS login rad etildi." }
Write-Host "CS kirish OK."

$csDaily = Invoke-WebRequest -Uri "$BaseUrl/dashboard/daily" -WebSession $cs -UseBasicParsing
$csLinks = @(Extract-CsMenu $csDaily.Content)
if ($csLinks.Count -eq 1 -and $csLinks[0] -is [System.Array]) { $csLinks = @($csLinks[0]) }
Save-Json (Join-Path $OutDir "01-cs-menu.json") $csLinks
Write-Host "CS menyu: $($csLinks.Count)"

$activeBase = $BaseUrl
$activeSession = $cs
$dealerHost = $null
$dealerUser = $null

if (-not $CsOnly) {
  Write-Host "Diler ochish id=$DealerId"
  $open = Invoke-WebRequest -Uri "$BaseUrl/directory/dealer/open?returnUrl=/&id=$DealerId" -WebSession $cs -UseBasicParsing
  $dealerUser = [regex]::Match($open.Content, 'name="LoginForm\[username\]" value="([^"]+)"').Groups[1].Value
  $action = [regex]::Match($open.Content, 'action="([^"]+)"').Groups[1].Value
  $hostMatch = [regex]::Match($action, "^//([^/]+)/")
  if (-not $dealerUser -or -not $hostMatch.Success) { throw "Diler login formasi topilmadi." }
  $dealerHost = "https://$($hostMatch.Groups[1].Value)"
  $ds = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $null = Invoke-WebRequest -Uri "$dealerHost/site/login" -WebSession $ds -UseBasicParsing
  $null = Invoke-WebRequest -Uri "$dealerHost/site/login" -Method POST -WebSession $ds -Body @{
    "LoginForm[username]" = $dealerUser
    "LoginForm[password]" = $Password
  } -UseBasicParsing
  Write-Host "Diler kirish OK: $dealerHost ($dealerUser)"
  $dealerHome = Invoke-WebRequest -Uri "$dealerHost/" -WebSession $ds -UseBasicParsing
  $dealerLinks = @(Extract-DealerSidebar $dealerHome.Content)
  if ($dealerLinks.Count -eq 1 -and $dealerLinks[0] -is [System.Array]) { $dealerLinks = @($dealerLinks[0]) }
  Save-Json (Join-Path $OutDir "01-dealer-menu.json") $dealerLinks
  Write-Host "Diler report linklari: $($dealerLinks.Count)"
  $activeBase = $dealerHost
  $activeSession = $ds
  $allLinks = @($dealerLinks) + @($csLinks)
} else {
  $allLinks = $csLinks
}

Save-Json (Join-Path $OutDir "01-menu-all.json") $allLinks

$matches = New-Object System.Collections.Generic.List[object]
foreach ($stub in @($map.stubs)) {
  $hit = Match-Stub $stub $allLinks
  $matches.Add([pscustomobject]@{
    slug = $stub.slug
    label = $stub.label
    matched = [bool]$hit
    href = $(if ($hit) { $hit.href } else { $null })
    menuText = $(if ($hit) { $hit.name } else { $null })
    source = $(if ($hit) { $hit.source } else { $null })
    score = $(if ($hit) { $hit.score } else { 0 })
  })
}
Save-Json (Join-Path $OutDir "02-stubs-match.json") $matches.ToArray()
$matchedCount = @($matches | Where-Object { $_.matched }).Count
Write-Host "Stub match: $matchedCount / $($matches.Count)"

function Get-Active([string]$pathAndQuery) {
  $url = if ($pathAndQuery -match '^https?://') { $pathAndQuery } else { "$activeBase$pathAndQuery" }
  try {
    return Invoke-WebRequest -Uri $url -WebSession $activeSession -UseBasicParsing -MaximumRedirection 5
  } catch {
    throw "GET $pathAndQuery : $(Read-ErrorBody $_)"
  }
}

function Post-ActiveJson([string]$path, $body) {
  $url = if ($path -match '^https?://') { $path } else { "$activeBase$path" }
  $json = if ($null -eq $body) { "{}" } else { ($body | ConvertTo-Json -Depth 16 -Compress) }
  return Invoke-WebRequest -Uri $url -Method POST -WebSession $activeSession `
    -ContentType "application/json; charset=utf-8" -Body $json -UseBasicParsing
}

function Probe-Page([string]$href, [string]$slugHint) {
  Write-Host "PROBE $href"
  $resp = Get-Active $href
  $html = $resp.Content
  $title = Extract-Title $html
  $endpoints = Extract-Endpoints $html
  $filters = Extract-Filters $html
  $folderName = if ($slugHint) { $slugHint } else { ($href -replace '[^\w\-]+', '_').Trim('_') }
  if ($folderName.Length -gt 80) { $folderName = $folderName.Substring(0, 80) }
  $dir = Join-Path $pagesDir $folderName

  $finalUrl = $null
  try { $finalUrl = $resp.BaseResponse.ResponseUri.AbsoluteUri } catch { $finalUrl = "$activeBase$href" }
  Save-Json (Join-Path $dir "page-meta.json") ([pscustomobject]@{
    slugHint = $slugHint
    href = $href
    host = $activeBase
    finalUrl = $finalUrl
    status = [int]$resp.StatusCode
    title = $title
    htmlBytes = [Text.Encoding]::UTF8.GetByteCount($html)
    endpointCount = @($endpoints).Count
    filterCount = @($filters).Count
    probedAt = (Get-Date).ToString("o")
  })
  Save-Json (Join-Path $dir "endpoints.json") @($endpoints)
  Save-Json (Join-Path $dir "filters.json") @($filters)

  if ($SaveHtml) {
    $max = $HtmlMaxKb * 1024
    $toSave = if ($html.Length -gt $max) { $html.Substring(0, $max) + "`n<!-- truncated -->" } else { $html }
    $htmlPath = Join-Path $dir "page.html"
    [IO.File]::WriteAllText($htmlPath, $toSave, [Text.UTF8Encoding]::new($false))
    Write-Host ("OK  pages/{0}/page.html  {1} bayt" -f $folderName, (Get-Item $htmlPath).Length)
  }

  if ($FetchSample) {
    $tryUrls = @($endpoints | Where-Object {
      $_ -match '(getData|pivotData|Ajax|ajax|/data|Report)' -and $_ -notmatch '\.js(\?|$)'
    } | Select-Object -First 8)
    $samples = New-Object System.Collections.Generic.List[object]
    foreach ($ep in $tryUrls) {
      $entry = [ordered]@{ endpoint = $ep; ok = $false; status = $null; bytes = 0; preview = $null; error = $null }
      try {
        $body = @{
          date = @((Get-Date).AddDays(-7).ToString("yyyy-MM-dd"), (Get-Date).ToString("yyyy-MM-dd"))
        }
        $r = Post-ActiveJson $ep $body
        $entry.ok = $true
        $entry.status = [int]$r.StatusCode
        $entry.bytes = [Text.Encoding]::UTF8.GetByteCount($r.Content)
        $preview = $r.Content
        if ($preview.Length -gt 4000) { $preview = $preview.Substring(0, 4000) + "...[cut]" }
        $entry.preview = $preview
      } catch {
        $entry.error = $_.Exception.Message
        try {
          $r2 = Get-Active $ep
          $entry.ok = $true
          $entry.status = [int]$r2.StatusCode
          $entry.bytes = [Text.Encoding]::UTF8.GetByteCount($r2.Content)
          $preview = $r2.Content
          if ($preview.Length -gt 4000) { $preview = $preview.Substring(0, 4000) + "...[cut]" }
          $entry.preview = $preview
          $entry.error = $null
          $entry.note = "GET fallback"
        } catch {
          $entry.error = $_.Exception.Message
        }
      }
      $samples.Add([pscustomobject]$entry)
    }
    Save-Json (Join-Path $dir "sample-calls.json") $samples.ToArray()
  }

  return [pscustomobject]@{
    title = $title
    endpointCount = @($endpoints).Count
    filterCount = @($filters).Count
  }
}

$toProbe = New-Object System.Collections.Generic.List[object]
if (-not $MatchOnly) {
  if ($PageUrl) {
    $href = if ($PageUrl -match '^https?://') { ([Uri]$PageUrl).PathAndQuery } else { $PageUrl }
    if (-not $href.StartsWith("/")) { $href = "/$href" }
    $toProbe.Add([pscustomobject]@{ slug = $(if ($Slug) { $Slug } else { "manual" }); href = $href })
  } elseif ($Slug) {
    $row = $matches | Where-Object { $_.slug -eq $Slug } | Select-Object -First 1
    if (-not $row -or -not $row.matched) {
      throw "Slug '$Slug' topilmadi. Avval katalog rejimini ishga tushiring yoki -PageUrl bering."
    }
    $toProbe.Add([pscustomobject]@{ slug = $Slug; href = $row.href })
  } else {
    foreach ($row in $matches) {
      if ($row.matched) { $toProbe.Add([pscustomobject]@{ slug = $row.slug; href = $row.href }) }
    }
  }
} else {
  Write-Host "MatchOnly: sahifa probe o‘tkazib yuborildi."
}

$probeResults = New-Object System.Collections.Generic.List[object]
foreach ($item in $toProbe) {
  try {
    $res = Probe-Page -href $item.href -slugHint $item.slug
    $probeResults.Add([pscustomobject]@{
      slug = $item.slug; href = $item.href; title = $res.title
      endpointCount = $res.endpointCount; filterCount = $res.filterCount
      ok = $true; error = $null
    })
  } catch {
    $probeResults.Add([pscustomobject]@{
      slug = $item.slug; href = $item.href; title = $null
      endpointCount = 0; filterCount = 0; ok = $false; error = $_.Exception.Message
    })
    Write-Host "FAIL $($item.slug): $($_.Exception.Message)"
  }
}
Save-Json (Join-Path $OutDir "03-probe-summary.json") $probeResults.ToArray()

$meta = [pscustomobject]@{
  baseUrl = $BaseUrl
  dealerHost = $dealerHost
  dealerId = $DealerId
  dealerUser = $dealerUser
  user = $User
  outDir = (Resolve-Path $OutDir).Path
  slugFilter = $Slug
  pageUrl = $PageUrl
  fetchSample = [bool]$FetchSample
  saveHtml = [bool]$SaveHtml
  csMenuCount = $csLinks.Count
  linkCount = $allLinks.Count
  stubTotal = $matches.Count
  stubMatched = $matchedCount
  probed = $probeResults.Count
  probedOk = @($probeResults | Where-Object { $_.ok }).Count
  generatedAt = (Get-Date).ToString("o")
}
Save-Json (Join-Path $OutDir "00-meta.json") $meta

$md = New-Object System.Text.StringBuilder
[void]$md.AppendLine("# SalesDoc Отчёт probe")
[void]$md.AppendLine("")
[void]$md.AppendLine("- CS: ``$BaseUrl``")
if ($dealerHost) { [void]$md.AppendLine("- Diler: ``$dealerHost`` (id=$DealerId, user=``$dealerUser``)") }
[void]$md.AppendLine("- Stub match: **$matchedCount / $($matches.Count)**")
[void]$md.AppendLine("- Vaqt: $($meta.generatedAt)")
[void]$md.AppendLine("")
[void]$md.AppendLine("## Stublar")
[void]$md.AppendLine("")
[void]$md.AppendLine("| slug | label | match | source | href |")
[void]$md.AppendLine("|---|---|---|---|---|")
foreach ($row in $matches) {
  $m = if ($row.matched) { "yes" } else { "NO" }
  $h = if ($row.href) { $row.href } else { "" }
  $src = if ($row.source) { $row.source } else { "" }
  [void]$md.AppendLine("| ``$($row.slug)`` | $($row.label) | $m | $src | ``$h`` |")
}
[void]$md.AppendLine("")
[void]$md.AppendLine("## Probe")
[void]$md.AppendLine("")
[void]$md.AppendLine("| slug | ok | title | endpoints | filters |")
[void]$md.AppendLine("|---|---|---|---|---|")
foreach ($p in $probeResults) {
  $ok = if ($p.ok) { "yes" } else { "FAIL" }
  $t = if ($p.title) { ($p.title -replace '\|', '/') } else { "" }
  [void]$md.AppendLine("| ``$($p.slug)`` | $ok | $t | $($p.endpointCount) | $($p.filterCount) |")
}
$catalogPath = Join-Path $OutDir "CATALOG.md"
[IO.File]::WriteAllText($catalogPath, $md.ToString(), [Text.UTF8Encoding]::new($false))
Write-Host "CATALOG: $catalogPath"
Write-Host "DONE"
