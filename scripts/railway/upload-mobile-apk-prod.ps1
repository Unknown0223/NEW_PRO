# Production Railway API ga APK yuklash + versiya siyosati
param(
  [string]$Api = "https://backend-production-3cf2.up.railway.app",
  [string]$Slug = "test1",
  [string]$AdminLogin = "admin",
  [string]$AdminPassword = "secret123",
  [string]$ApkPath = "",
  [string]$LatestVersion = "",
  [switch]$ForceUpdate,
  [switch]$NoForce
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Mobile = Join-Path $Root "mobile"
$Pubspec = Join-Path $Mobile "pubspec.yaml"

function Get-PubspecVersion {
  $line = Get-Content $Pubspec | Where-Object { $_ -match '^version:\s*' } | Select-Object -First 1
  if ($line -match 'version:\s*([0-9.]+)') { return $Matches[1] }
  throw "pubspec.yaml version topilmadi"
}

if (-not $ApkPath) {
  $ver = Get-PubspecVersion
  $ApkPath = Join-Path $Mobile "releases\SalesDoc-$ver-release.apk"
  if (-not (Test-Path $ApkPath)) {
    $ApkPath = Join-Path $Mobile "releases\SalesDoc-latest-release.apk"
  }
}
if (-not (Test-Path $ApkPath)) {
  throw "APK topilmadi: $ApkPath — avval deploy-mobile-prod.cmd ishga tushiring"
}

if (-not $LatestVersion) { $LatestVersion = Get-PubspecVersion }
# Default: ixtiyoriy yangilash (dialog + «Обновить»). Majburiy bloklash: -ForceUpdate.
$force = $false
if ($ForceUpdate) { $force = $true }
if ($NoForce) { $force = $false }

Write-Host "=== APK yuklash (production) ===" -ForegroundColor Cyan
Write-Host "API: $Api"
Write-Host "APK: $ApkPath"
Write-Host "Versiya: $LatestVersion  force=$force (ixtiyoriy=$([bool](-not $force)))"

$loginBody = @{ slug = $Slug; login = $AdminLogin; password = $AdminPassword } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri "$Api/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json").accessToken

# Joriy siyosat — soft OTA da min_version ni saqlab qolamiz
$prevPolicy = $null
try {
  $prevPolicy = Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" `
    -Method GET -Headers @{ Authorization = "Bearer $token" }
} catch { }

$boundary = [guid]::NewGuid().ToString()
$fileBytes = [System.IO.File]::ReadAllBytes($ApkPath)
$fileName = [System.IO.Path]::GetFileName($ApkPath)
$enc = [System.Text.Encoding]::UTF8
$lf = "`r`n"
$bodyStream = New-Object System.IO.MemoryStream
$header = "--$boundary$lf" +
  "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"$lf" +
  "Content-Type: application/vnd.android.package-archive$lf$lf"
$bodyStream.Write($enc.GetBytes($header), 0, $header.Length)
$bodyStream.Write($fileBytes, 0, $fileBytes.Length)
$footer = "$lf--$boundary--$lf"
$bodyStream.Write($enc.GetBytes($footer), 0, $footer.Length)

$upload = Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release/upload" `
  -Method POST `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "multipart/form-data; boundary=$boundary" `
  -Body $bodyStream.ToArray()

$minParts = $LatestVersion -split '\.'
$minFloor = if ($minParts.Length -ge 2) { "$($minParts[0]).$($minParts[1]).0" } else { $LatestVersion }
$prevMin = $null
if ($prevPolicy -and $prevPolicy.policy -and $prevPolicy.policy.min_version) {
  $prevMin = [string]$prevPolicy.policy.min_version
}
# Soft: eski min saqlanadi (yoki null). Force: past versiyalarni bloklash uchun floor.
$minVer = if ($force) { $minFloor } else { if ($prevMin) { $prevMin } else { $null } }

$notes = if ($force) {
  "Production majburiy yangilash $LatestVersion"
} else {
  "Production ixtiyoriy yangilash $LatestVersion — ilova ichida «Обновить» yoki «Позже»"
}

$policy = @{
  latest_version = $LatestVersion
  force_update   = $force
  download_url   = "$Api/api/mobile/apk-download?slug=$Slug"
  release_notes  = $notes
}
if ($null -ne $minVer -and $minVer -ne "") {
  $policy.min_version = $minVer
} else {
  $policy.min_version = $null
}
# PowerShell string Body ba'zan Content-Length nomuvofiqligiga olib keladi — UTF-8 bayt yuboramiz
$policyJson = $policy | ConvertTo-Json -Compress
$policyBytes = [System.Text.Encoding]::UTF8.GetBytes($policyJson)
Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" `
  -Method PATCH `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $policyBytes `
  -ContentType "application/json; charset=utf-8" | Out-Null

Write-Host "Yuklandi: $($upload.bytes) bayt" -ForegroundColor Green
Write-Host "latest=$LatestVersion min=$minVer force=$force" -ForegroundColor DarkGray
Write-Host "download_url: $Api/api/mobile/apk-download?slug=$Slug"
Write-Host "Veb: https://sales-arena.up.railway.app/settings/mobile-app"
