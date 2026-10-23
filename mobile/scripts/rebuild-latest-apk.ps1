# Rebuild latest production APK, keep only current version files, upload OTA (no force).
$ErrorActionPreference = "Stop"
$Mobile = Split-Path $PSScriptRoot -Parent
$Root = Split-Path $Mobile -Parent
$BuildDir = "C:\salesdoc_mobile"
$Releases = Join-Path $Mobile "releases"
$ApkOut = Join-Path $BuildDir "build\app\outputs\flutter-apk\app-release.apk"
$DebugApk = Join-Path $BuildDir "build\app\outputs\flutter-apk\app-debug.apk"

function Get-PubspecVersion {
  $line = Get-Content (Join-Path $Mobile "pubspec.yaml") | Where-Object { $_ -match '^version:\s*' } | Select-Object -First 1
  if ($line -match 'version:\s*([0-9.]+)') { return $Matches[1] }
  throw "pubspec.yaml version not found"
}

. (Join-Path $Root "scripts\env\resolve-flutter.ps1")
Set-MobileBuildEnv | Out-Null
& (Join-Path $Root "scripts\env\switch-production-mobile.ps1")
& (Join-Path $Mobile "scripts\verify-ota-signing.ps1") -MobileDir $Mobile

Write-Host "=== Sync + test ===" -ForegroundColor Cyan
& (Join-Path $Mobile "scripts\sync-to-build-dir.cmd")
if ($LASTEXITCODE -ne 0) { throw "sync failed" }
robocopy (Join-Path $Mobile "android") (Join-Path $BuildDir "android") /E /XD .gradle /NFL /NDL /NJH /NJS | Out-Null
if (Test-Path (Join-Path $Mobile ".env")) {
  Copy-Item (Join-Path $Mobile ".env") (Join-Path $BuildDir ".env") -Force
}
Copy-Item (Join-Path $Mobile "test\unit\app_update_info_test.dart") (Join-Path $BuildDir "test\unit\app_update_info_test.dart") -Force
Copy-Item (Join-Path $Mobile "pubspec.yaml") (Join-Path $BuildDir "pubspec.yaml") -Force

$StopGradle = Join-Path $Mobile "scripts\stop-gradle-daemons.ps1"
if (Test-Path $StopGradle) { & $StopGradle -BuildDir $BuildDir }

Push-Location $BuildDir
try {
  flutter pub get
  if ($LASTEXITCODE -ne 0) { throw "flutter pub get failed" }
  flutter test test/unit/app_update_info_test.dart
  if ($LASTEXITCODE -ne 0) { throw "flutter test failed" }
  Write-Host "=== Release APK ===" -ForegroundColor Cyan
  flutter build apk --release --no-tree-shake-icons
  if ($LASTEXITCODE -ne 0) { throw "flutter build apk failed" }
} finally {
  Pop-Location
}

if (-not (Test-Path $ApkOut)) { throw "APK missing: $ApkOut" }

$ver = Get-PubspecVersion
New-Item -ItemType Directory -Force -Path $Releases | Out-Null
$latest = Join-Path $Releases "SalesDoc-latest-release.apk"
$versioned = Join-Path $Releases "SalesDoc-$ver-release.apk"
Copy-Item $ApkOut $latest -Force
Copy-Item $ApkOut $versioned -Force

Get-ChildItem -LiteralPath $Releases -Filter "SalesDoc-*-release.apk" | Where-Object {
  $_.Name -ne "SalesDoc-latest-release.apk" -and $_.Name -ne "SalesDoc-$ver-release.apk"
} | Remove-Item -Force

if (Test-Path $DebugApk) { Remove-Item $DebugApk -Force }

Write-Host "APK: $latest ($ver)" -ForegroundColor Green
Write-Host "=== Upload (force=false) ===" -ForegroundColor Cyan
& (Join-Path $Root "scripts\railway\upload-mobile-apk-prod.ps1") -ApkPath $latest -LatestVersion $ver
