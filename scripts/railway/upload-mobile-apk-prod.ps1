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
$force = if ($NoForce) { $false } else { $true }
if ($ForceUpdate) { $force = $true }

Write-Host "=== APK yuklash (production) ===" -ForegroundColor Cyan
Write-Host "API: $Api"
Write-Host "APK: $ApkPath"
Write-Host "Versiya: $LatestVersion  force=$force"

$loginBody = @{ slug = $Slug; login = $AdminLogin; password = $AdminPassword } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri "$Api/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json").accessToken

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
$minVer = if ($minParts.Length -ge 2) { "$($minParts[0]).$($minParts[1]).0" } else { $LatestVersion }
$policy = @{
  min_version    = $minVer
  latest_version = $LatestVersion
  force_update   = $force
  release_notes  = "Production yangilash $LatestVersion"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" `
  -Method PATCH `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $policy -ContentType "application/json" | Out-Null

$dlUrl = "$Api/api/mobile/apk-download?slug=$Slug"
$dlPatch = @{ download_url = $dlUrl } | ConvertTo-Json
Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" `
  -Method PATCH `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $dlPatch -ContentType "application/json" | Out-Null

Write-Host "Yuklandi: $($upload.bytes) bayt" -ForegroundColor Green
Write-Host "download_url: $dlUrl"
Write-Host "Veb: https://sales-arena.up.railway.app/settings/mobile-app"
