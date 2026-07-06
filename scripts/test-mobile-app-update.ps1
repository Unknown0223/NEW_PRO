# Mobile app update test (local API :18080, tenant test1)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Mobile = Join-Path $Root "mobile"
$BuildDir = "C:\salesdoc_mobile"
$ApkOut = Join-Path $BuildDir "build\app\outputs\flutter-apk\app-release.apk"
$Pubspec = Join-Path $Mobile "pubspec.yaml"
$Api = "http://127.0.0.1:18080"
$Slug = "test1"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

function Set-PubspecVersion([string]$ver, [int]$build) {
  $content = Get-Content $Pubspec -Raw
  $content = $content -replace '(?m)^version:\s*.*$', "version: ${ver}+${build}"
  Set-Content -Path $Pubspec -Value $content -NoNewline
}

function Sync-MobileBuild {
  & (Join-Path $Mobile "scripts\sync-to-build-dir.cmd") | Out-Null
}

$Flutter = "C:\Users\botir\flutter\bin\flutter.bat"
if (-not (Test-Path $Flutter)) { $Flutter = "C:\src\flutter\bin\flutter.bat" }
if (-not (Test-Path $Flutter)) { $Flutter = "flutter" }

function Build-Apk {
  Push-Location $BuildDir
  try {
    & $Flutter pub get
    if ($LASTEXITCODE -ne 0) { throw "flutter pub get failed" }
    & $Flutter build apk --release --no-tree-shake-icons --dart-define=APP_ENV=local
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk failed" }
    if (-not (Test-Path $ApkOut)) { throw "APK not found: $ApkOut" }
  } finally {
    Pop-Location
  }
}

function Get-AdminToken {
  $body = @{ slug = $Slug; login = "admin"; password = "secret123" } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$Api/api/auth/login" -Method POST -Body $body -ContentType "application/json"
  return $r.accessToken
}

function Upload-Apk([string]$token, [string]$apkPath) {
  $boundary = [guid]::NewGuid().ToString()
  $fileBytes = [System.IO.File]::ReadAllBytes($apkPath)
  $fileName = [System.IO.Path]::GetFileName($apkPath)
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
  return Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release/upload" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "multipart/form-data; boundary=$boundary" `
    -Body $bodyStream.ToArray()
}

function Set-ReleasePolicy([string]$token, [string]$latest, [bool]$force) {
  $body = @{
    min_version    = "3.0.0"
    latest_version = $latest
    force_update   = $force
    release_notes  = "Test update - cache preserved"
  } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" `
    -Method PATCH `
    -Headers @{ Authorization = "Bearer $token" } `
    -Body $body -ContentType "application/json"
}

function Test-AppRelease([string]$clientVersion) {
  $ver = [uri]::EscapeDataString($clientVersion)
  $u = "${Api}/api/mobile/app-release?slug=${Slug}&version=${ver}&platform=android"
  return Invoke-RestMethod -Uri $u -Method GET
}

Write-Step "1) Build and install v3.0.0 (local API)"
Set-PubspecVersion "3.0.0" 300
Sync-MobileBuild
Build-Apk
$apk300 = Join-Path $Root "mobile\releases\SalesDoc-local-3.0.0-release.apk"
New-Item -ItemType Directory -Force -Path (Split-Path $apk300) | Out-Null
Copy-Item $ApkOut $apk300 -Force
& adb install -r $apk300
if ($LASTEXITCODE -ne 0) { throw "adb install 3.0.0 failed" }
Write-Host "Installed 3.0.0" -ForegroundColor Green

Write-Step "2) Build v3.1.0 APK"
Set-PubspecVersion "3.1.0" 301
Sync-MobileBuild
Build-Apk
$apk310 = Join-Path $Root "mobile\releases\SalesDoc-local-3.1.0-release.apk"
Copy-Item $ApkOut $apk310 -Force
Write-Host "APK ready: $apk310" -ForegroundColor Green

Write-Step "3) Upload APK and set policy on server"
$token = Get-AdminToken
$upload = Upload-Apk $token $apk310
Write-Host "Uploaded bytes: $($upload.bytes)"
Write-Host "Download URL: $($upload.download_url)"
$policy = Set-ReleasePolicy $token "3.1.0" $true
# Emulyator uchun download URL (adb reverse bilan 127.0.0.1 ham ishlaydi)
$dlUrl = "http://127.0.0.1:18080/api/mobile/apk-download?slug=$Slug"
$policyBody2 = @{ download_url = $dlUrl } | ConvertTo-Json
Invoke-RestMethod -Uri "$Api/api/$Slug/settings/mobile-app-release" -Method PATCH `
  -Headers @{ Authorization = "Bearer $token" } -Body $policyBody2 -ContentType "application/json" | Out-Null
Write-Host "Policy latest=$($policy.policy.latest_version) force=$($policy.policy.force_update)"
Write-Host "download_url=$dlUrl"

Write-Step "4) API checks"
$before = Test-AppRelease "3.0.0"
$after = Test-AppRelease "3.1.0"
Write-Host "Client 3.0.0: required=$($before.update.required) optional=$($before.update.optional)"
Write-Host "apk_url=$($before.update.apk_url)"

if (-not $before.update.required -and -not $before.update.optional) {
  throw "FAIL: no update signal for 3.0.0"
}
if (-not $before.update.apk_url) {
  throw "FAIL: apk_url missing"
}

$apkDl = Invoke-WebRequest -Uri $before.update.apk_url -Method Head -UseBasicParsing
if ($apkDl.StatusCode -ne 200) { throw "FAIL: APK download HEAD $($apkDl.StatusCode)" }
Write-Host "APK download HEAD: OK" -ForegroundColor Green

Write-Host "Client 3.1.0: required=$($after.update.required) optional=$($after.update.optional) (should be false/false)"

Write-Step "5) adb reverse + launch app on emulator"
& adb reverse tcp:18080 tcp:18080 | Out-Null
& adb shell monkey -p uz.salesdoc.salesdoc_mobile -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host ""
Write-Host "=== API TEST PASSED ===" -ForegroundColor Green
Write-Host "Emulator: login test1/agent then tap Obnovit in update dialog"
Write-Host "Web admin: http://127.0.0.1:3000/settings/mobile-app"
