# Bitta urinish: tarmoqdagi terminallardan parol togri kelganini serverga ulaydi.
param(
  [string]$Password = "",
  [string]$Branch = "",
  [string]$PairingCode = "",
  [string]$IngestUrl = "https://api.salesarena.sale/api/aksit/mobile/attendance/device-ingest",
  [string]$LinkUrl = "https://api.salesarena.sale/api/aksit/mobile/attendance/device-link-request",
  [string]$RecoveryEmail = "botirovanvar96@gmail.com",
  [string]$Slug = "aksit",
  [switch]$ProbeOnly
)

if ($PSCommandPath -and (Get-Content -LiteralPath $PSCommandPath -TotalCount 1 -ErrorAction SilentlyContinue) -match '<html|<!DOCTYPE') {
  throw "Yuklangan fayl skript emas. Sahifani yangilab, buyruqni qayta oling."
}
if (-not $ProbeOnly -and -not $PairingCode) { $PairingCode = Read-Host "Bog'lash kodi (sahifadagi kod)" }
if (-not $ProbeOnly -and -not $Branch) { $Branch = Read-Host "Filial nomi" }
if (-not $ProbeOnly -and -not $Password) {
  $secure = Read-Host "Terminal admin paroli" -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if (-not $ProbeOnly -and (-not $Password -or -not $PairingCode)) { throw "Parol va bog'lash kodi kerak." }

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Say([string]$text, [string]$color = "Gray") {
  Write-Host $text -ForegroundColor $color
}

function Fail([string]$title, [string]$detail) {
  Write-Host ""
  Write-Host "  Sales Arena Link" -ForegroundColor White
  Write-Host "  Ulanmadi" -ForegroundColor Red
  Write-Host "  $title" -ForegroundColor Red
  if ($detail) { Write-Host "  $detail" -ForegroundColor DarkGray }
  Write-Host ""
}

function Done([string]$title, [string[]]$lines) {
  Write-Host ""
  Write-Host "  Sales Arena Link" -ForegroundColor White
  Write-Host "  $title" -ForegroundColor Green
  foreach ($line in $lines) { Write-Host "  $line" -ForegroundColor Gray }
  Write-Host ""
}

function PortOpen([string]$ip, [int]$port) {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $c.BeginConnect($ip, $port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(250, $false)
    return $ok -and $c.Connected
  } catch { return $false } finally { $c.Close() }
}

function CurlRaw([string]$ip, [string]$path, [string]$method, [string]$user, [string]$pass, [string]$body, [string]$contentType = "application/xml") {
  $url = "http://$ip$path"
  $args = @("-sS", "--max-time", "8", "-D", "-", "-o", "-", "-w", "`n__HTTP__%{http_code}", "-X", $method, $url)
  if ($user) { $args = @("--digest", "-u", "${user}:$pass") + $args }
  if ($body) { $args += @("-H", "Content-Type: $contentType", "--data-binary", $body) }
  $raw = & curl.exe @args 2>$null
  $text = ($raw | Out-String)
  $code = 0
  if ($text -match "__HTTP__(\d+)") { $code = [int]$Matches[1] }
  return @{ code = $code; text = $text }
}

$ips = New-Object System.Collections.Generic.List[string]
foreach ($row in (arp -a)) {
  if ($row -match "^\s*(192\.168\.\d+\.\d+)\s+") { [void]$ips.Add($Matches[1]) }
}
$ips = $ips | Select-Object -Unique
$candidates = @()
foreach ($ip in $ips) {
  if (PortOpen $ip 8000) { $candidates += $ip }
}

Say "Tarmoq qidirilmoqda..." Cyan
if ($candidates.Count -eq 0) {
  Fail "Tarmoqda terminal topilmadi." "Kompyuter va terminal bitta tarmoqda ekanini tekshiring."
  exit 2
}
Say ("Topildi: " + ($candidates -join ", ")) Cyan

$tries = @()
$chosen = $null
foreach ($ip in $candidates) {
  Say "$ip tekshirilmoqda..." DarkCyan
  $probe = CurlRaw $ip "/ISAPI/System/deviceInfo" "GET" "" "" ""
  if ($probe.text -match "<lockStatus>\s*lock\s*</lockStatus>") {
    $tries += @{ ip = $ip; result = "locked" }
    continue
  }
  if ($ProbeOnly) {
    $tries += @{ ip = $ip; result = "unlocked" }
    continue
  }
  $auth = CurlRaw $ip "/ISAPI/System/deviceInfo" "GET" "admin" $Password ""
  if ($auth.text -match "<lockStatus>\s*lock\s*</lockStatus>") {
    $tries += @{ ip = $ip; result = "locked" }
    continue
  }
  if ($auth.code -eq 401 -or $auth.text -match "<statusValue>401</statusValue>") {
    $tries += @{ ip = $ip; result = "wrong_password" }
    continue
  }
  if ($auth.code -ge 200 -and $auth.code -lt 300 -and $auth.text -match "<deviceName>|<model>") {
    $tries += @{ ip = $ip; result = "ok" }
    $chosen = $ip
    break
  }
  $tries += @{ ip = $ip; result = "not_terminal" }
}

if ($ProbeOnly) {
  $open = @($tries | Where-Object { $_.result -eq "unlocked" })
  if ($open.Count -gt 0) {
    Done "Terminal topildi. Parol yuborilmadi." @($tries | ForEach-Object { "$($_.ip)  ochiq" })
    exit 0
  }
}

if (-not $chosen) {
  $wrong = @($tries | Where-Object { $_.result -eq "wrong_password" }).Count
  $locked = @($tries | Where-Object { $_.result -eq "locked" }).Count
  $msg = if ($locked -gt 0 -and $wrong -eq 0) { "Terminal loginni qulflagan. Qulf ochilguncha kuting." } elseif ($wrong -gt 0) { "Admin paroli togri kelmadi." } else { "Mos terminal topilmadi." }
  $detail = ($tries | ForEach-Object { "$($_.ip)" }) -join ", "
  Fail $msg $detail
  exit 3
}

$ingestHost = ([Uri]$IngestUrl).Host
$ingestPath = ([Uri]$IngestUrl).PathAndQuery
if ($PairingCode) {
  $join = if ($ingestPath.Contains("?")) { "&" } else { "?" }
  $ingestPath = "$ingestPath${join}pairing_code=$PairingCode"
}
$xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <HttpHostNotification>
    <id>1</id>
    <url>$ingestPath</url>
    <protocolType>HTTPS</protocolType>
    <parameterFormatType>JSON</parameterFormatType>
    <addressingFormatType>hostname</addressingFormatType>
    <hostName>$ingestHost</hostName>
    <portNo>443</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
    <SubscribeEvent><heartbeat>30</heartbeat><eventMode>all</eventMode><EventList><Event><type>AccessControllerEvent</type><minorAlarm></minorAlarm><minorException></minorException><minorOperation></minorOperation><minorEvent></minorEvent><pictureURLType>binary</pictureURLType></Event></EventList></SubscribeEvent>
  </HttpHostNotification>
</HttpHostNotificationList>
"@
Say "Server manzili yozilmoqda..." Cyan
$hostPut = CurlRaw $chosen "/ISAPI/Event/notification/httpHosts" "PUT" "admin" $Password $xml
if ($hostPut.code -lt 200 -or $hostPut.code -ge 300) {
  $xmlPlain = $xml -replace "<SubscribeEvent>[\s\S]*</SubscribeEvent>", ""
  $hostPut = CurlRaw $chosen "/ISAPI/Event/notification/httpHosts" "PUT" "admin" $Password $xmlPlain
}
if ($hostPut.code -lt 200 -or $hostPut.code -ge 300) {
  $saved = CurlRaw $chosen "/ISAPI/Event/notification/httpHosts" "GET" "admin" $Password ""
  if ($saved.text -notmatch [regex]::Escape($ingestHost)) {
    Fail "Server manzili yozilmadi." "$chosen  javob $($hostPut.code). Hodisalar saytga kelmaydi."
    exit 4
  }
}
$now = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$timeXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <timeMode>manual</timeMode>
  <localTime>$now</localTime>
  <timeZone>CST-5:00:00</timeZone>
</Time>
"@
Say "Vaqt moslanmoqda..." Cyan
$timePut = CurlRaw $chosen "/ISAPI/System/time" "PUT" "admin" $Password $timeXml

function New-TerminalPassword {
  $upper = "ABCDEFGHJKLMNPQRSTUVWXYZ".ToCharArray()
  $lower = "abcdefghijkmnopqrstuvwxyz".ToCharArray()
  $digit = "23456789".ToCharArray()
  $all = $upper + $lower + $digit
  $chars = @(
    $upper[(Get-Random -Maximum $upper.Length)],
    $lower[(Get-Random -Maximum $lower.Length)],
    $digit[(Get-Random -Maximum $digit.Length)]
  )
  1..9 | ForEach-Object { $chars += $all[(Get-Random -Maximum $all.Length)] }
  return -join ($chars | Sort-Object { Get-Random })
}

Say "Yangi parol o'rnatilmoqda..." Cyan
$newPassword = New-TerminalPassword
$users = CurlRaw $chosen "/ISAPI/Security/users" "GET" "admin" $Password ""
$userId = "1"
if ($users.text -match "<userName>\s*admin\s*</userName>[\s\S]{0,200}<id>\s*(\d+)\s*</id>") { $userId = $Matches[1] }
elseif ($users.text -match "<id>\s*(\d+)\s*</id>[\s\S]{0,200}<userName>\s*admin\s*</userName>") { $userId = $Matches[1] }
$passXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<User>
  <id>$userId</id>
  <userName>admin</userName>
  <password>$newPassword</password>
  <loginPassword>$Password</loginPassword>
  <userLevel>Administrator</userLevel>
</User>
"@
$passPut = CurlRaw $chosen "/ISAPI/Security/users/$userId" "PUT" "admin" $Password $passXml
if ($passPut.code -lt 200 -or $passPut.code -ge 300) {
  Fail "Terminal paroli yangilanmadi." "$chosen  javob $($passPut.code). Eski parol o'zgarishsiz qoldi."
  exit 4
}

Say "Yangi parol tekshirilmoqda..." Cyan
$recheck = CurlRaw $chosen "/ISAPI/System/deviceInfo" "GET" "admin" $newPassword ""
if ($recheck.code -lt 200 -or $recheck.code -ge 300 -or $recheck.text -notmatch "<deviceName>|<model>") {
  Fail "Parol yangilandi, lekin yangi parol bilan kira olmadim." "Tiklash paroli: $newPassword"
  exit 4
}

Say "Pochta yozilmoqda..." Cyan
if (-not $RecoveryEmail) { $RecoveryEmail = "botirovanvar96@gmail.com" }
$emailJson = '{"SecurityEmail":{"password":"' + $newPassword + '","SecurityInformation":[{"emailAddress":"' + $RecoveryEmail + '"}]}}'
$emailPut = CurlRaw $chosen "/ISAPI/Security/email/parameter?format=json" "PUT" "admin" $newPassword $emailJson "application/json"
$emailOk = $emailPut.code -ge 200 -and $emailPut.code -lt 300
if (-not $emailOk) {
  $mailing = CurlRaw $chosen "/ISAPI/System/Network/mailing" "GET" "admin" $newPassword ""
  if ($mailing.text -match "<emailAddress>") {
    $mailingXml = [regex]::Replace($mailing.text, "<emailAddress>[^<]*</emailAddress>", "<emailAddress>$RecoveryEmail</emailAddress>", 1)
    $mailingXml = ($mailingXml -replace "(?s)^.*?(<\?xml)", '$1') -replace "__HTTP__\d+", ""
    $mailPut = CurlRaw $chosen "/ISAPI/System/Network/mailing" "PUT" "admin" $newPassword $mailingXml.Trim()
    if ($mailPut.code -ge 200 -and $mailPut.code -lt 300) { $emailOk = $true }
  }
}

Say "Yuz himoyasi yoqilmoqda..." Cyan
try {
  $readerRaw = CurlRaw $chosen "/ISAPI/AccessControl/CardReaderCfg/1?format=json" "GET" "admin" $newPassword ""
  $readerJson = ($readerRaw.text -replace "(?s)^.*?(\{)", '$1') -replace "__HTTP__\d+", ""
  $reader = $readerJson | ConvertFrom-Json
  if ($reader.CardReaderCfg) {
    $cfg = $reader.CardReaderCfg
    $cfg.enable = $true
    $cfg.livingBodyDetect = $true
    $cfg.liveDetLevelSet = "professional"
    $cfg.enableLiveDetAntiAttack = $true
    if ($null -ne $cfg.faceMatchThresholdN -and [double]$cfg.faceMatchThresholdN -gt 85) { $cfg.faceMatchThresholdN = 80 }
    $readerBody = $reader | ConvertTo-Json -Depth 20 -Compress
    $null = CurlRaw $chosen "/ISAPI/AccessControl/CardReaderCfg/1?format=json" "PUT" "admin" $newPassword $readerBody "application/json"
  }
} catch {}

Say "Surat yuborish yoqilmoqda..." Cyan
try {
  $acsRaw = CurlRaw $chosen "/ISAPI/AccessControl/AcsCfg?format=json" "GET" "admin" $newPassword ""
  $acsJson = ($acsRaw.text -replace "(?s)^.*?(\{)", '$1') -replace "__HTTP__\d+", ""
  $acs = $acsJson | ConvertFrom-Json
  if ($acs.AcsCfg) {
    foreach ($key in @("uploadCapPic", "saveCapPic", "uploadVerificationPic", "saveVerificationPic", "showPicture")) {
      if ($acs.AcsCfg.PSObject.Properties.Name -contains $key) { $acs.AcsCfg.$key = $true }
    }
    $acsBody = $acs | ConvertTo-Json -Depth 20 -Compress
    $null = CurlRaw $chosen "/ISAPI/AccessControl/AcsCfg?format=json" "PUT" "admin" $newPassword $acsBody "application/json"
  }
} catch {}

Say "Saytga tasdiq so'rovi yuborilmoqda..." Cyan
$linkOk = $false
$linkError = ""
if ($PairingCode) {
  try {
    $null = Invoke-RestMethod -Method POST -Uri $LinkUrl -ContentType "application/json" -Body (@{ pairing_code = $PairingCode; terminal_password = $newPassword; ip = $chosen; recovery_email = $RecoveryEmail } | ConvertTo-Json -Compress) -TimeoutSec 20
    $linkOk = $true
  } catch {
    $linkError = $_.Exception.Message
  }
}

$dir = Join-Path $env:LOCALAPPDATA "SALEC\terminal-link"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$secret = ConvertTo-SecureString $newPassword -AsPlainText -Force
$blob = $secret | ConvertFrom-SecureString
$safeBranch = if ($Branch) { $Branch } else { "device" }
Set-Content -Path (Join-Path $dir "$safeBranch.txt") -Value $blob -Encoding ascii

$lines = @(
  "Terminal   $chosen",
  "Filial     $Branch",
  "Kod        $PairingCode",
  "Yangi parol  $newPassword",
  "Pochta     $RecoveryEmail$(if ($emailOk) { '' } else { '  (terminal javobi ' + $emailPut.code + ')' })"
)
if ($linkOk) {
  Done "Ulandi. Saytda «Подтвердить» ni bosing." $lines
  exit 0
}
Done "Parol yangilandi, lekin sayt so'rovni olmadi." ($lines + @($linkError))
exit 5
