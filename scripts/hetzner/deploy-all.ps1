# SALEC — Hetzner to'liq deploy: veb (+ ixtiyoriy mobil APK)
# Ishlatish: .\deploy-prod.cmd   |   .\deploy-all.cmd
param(
  [string]$ApiUrl = "https://api.salesarena.sale",
  [string]$FrontendUrl = "https://salesarena.sale",
  [string]$AdminPassword = "",
  [string]$TenantSlug = "aksit",
  [switch]$SkipMobile,
  [switch]$SkipWeb,
  [switch]$NoCache,
  [switch]$ForceUpdate
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$HetznerDeploy = Join-Path $PSScriptRoot "deploy.ps1"
$MobileEnvScript = Join-Path $Root "scripts\env\switch-production-mobile.ps1"
$FlutterEnvScript = Join-Path $Root "scripts\env\resolve-flutter.ps1"
$UploadScript = Join-Path $Root "scripts\railway\upload-mobile-apk-prod.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SALEC Hetzner TO'LIQ DEPLOY" -ForegroundColor Cyan
Write-Host "  $FrontendUrl" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Backend + Frontend (Hetzner) ---
if (-not $SkipWeb) {
  Write-Host "[1/3] Backend va Frontend → Hetzner..." -ForegroundColor Yellow
  $webArgs = @{}
  if ($NoCache) { $webArgs.NoCache = $true }
  & $HetznerDeploy @webArgs
  if ($LASTEXITCODE -ne 0) { throw "Hetzner web deploy xato" }
} else {
  Write-Host "[1/3] Web deploy o'tkazib yuborildi (-SkipWeb)" -ForegroundColor DarkYellow
}

# --- 2–3. Mobil APK ---
if (-not $SkipMobile) {
  if (-not $AdminPassword) {
    Write-Host ""
    Write-Host "Mobil APK yuklash uchun admin parol kerak." -ForegroundColor Yellow
    Write-Host "  .\deploy-prod.cmd -SkipMobile" -ForegroundColor DarkGray
    Write-Host "  yoki: -AdminPassword '...' " -ForegroundColor DarkGray
    throw "AdminPassword berilmagan — mobil OTA uchun kerak (yoki -SkipMobile)"
  }

  Write-Host ""
  Write-Host "[2/3] Mobil APK yig'ilmoqda..." -ForegroundColor Yellow
  & $MobileEnvScript
  . $FlutterEnvScript
  $envInfo = Set-MobileBuildEnv
  $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle"

  $MobileDir = Join-Path $Root "mobile"
  $BuildDir = "C:\salesdoc_mobile"
  $SyncCmd = Join-Path $MobileDir "scripts\sync-to-build-dir.cmd"
  $StopGradle = Join-Path $MobileDir "scripts\stop-gradle-daemons.ps1"
  $VerifySigning = Join-Path $MobileDir "scripts\verify-ota-signing.ps1"

  if (Test-Path $VerifySigning) {
    & $VerifySigning -MobileDir $MobileDir
  }

  Write-Host "Sync: $MobileDir -> $BuildDir" -ForegroundColor DarkGray
  & cmd /c "`"$SyncCmd`""
  if ($LASTEXITCODE -ne 0) { throw "sync-to-build-dir xato" }
  robocopy (Join-Path $MobileDir "android") (Join-Path $BuildDir "android") /E /XD .gradle /NFL /NDL /NJH /NJS | Out-Null
  if (Test-Path (Join-Path $MobileDir ".env")) {
    Copy-Item (Join-Path $MobileDir ".env") (Join-Path $BuildDir ".env") -Force
  }
  if (Test-Path $VerifySigning) {
    & $VerifySigning -MobileDir $BuildDir
  }

  if (Test-Path $StopGradle) {
    & $StopGradle -BuildDir $BuildDir
  }

  $Releases = Join-Path $MobileDir "releases"
  $ApkOut = Join-Path $BuildDir "build\app\outputs\flutter-apk\app-release.apk"
  New-Item -ItemType Directory -Force -Path $Releases | Out-Null

  Push-Location $BuildDir
  try {
    flutter pub get
    if ($LASTEXITCODE -ne 0) { throw "flutter pub get xato" }
    Write-Host "Gradle build boshlandi (5-15 daqiqa)..." -ForegroundColor DarkYellow
    flutter build apk --release --no-tree-shake-icons
    if ($LASTEXITCODE -ne 0) { throw "flutter build apk xato" }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $ApkOut)) { throw "APK yaratilmadi: $ApkOut" }

  $versionLine = (Get-Content (Join-Path $MobileDir "pubspec.yaml") | Where-Object { $_ -match '^version:' } | Select-Object -First 1)
  $appVer = if ($versionLine -match 'version:\s*([0-9.]+)') { $Matches[1] } else { "latest" }
  $latestApk = Join-Path $Releases "SalesDoc-latest-release.apk"
  $versionApk = Join-Path $Releases "SalesDoc-$appVer-release.apk"
  Copy-Item $ApkOut $latestApk -Force
  Copy-Item $ApkOut $versionApk -Force
  Write-Host "APK tayyor: $latestApk ($appVer)" -ForegroundColor Green

  Write-Host ""
  Write-Host "[3/3] APK Hetzner API ga yuklanmoqda..." -ForegroundColor Yellow
  if ($ForceUpdate) {
    & $UploadScript -Api $ApiUrl -Slug $TenantSlug -AdminPassword $AdminPassword -ApkPath $latestApk -LatestVersion $appVer -ForceUpdate
  } else {
    & $UploadScript -Api $ApiUrl -Slug $TenantSlug -AdminPassword $AdminPassword -ApkPath $latestApk -LatestVersion $appVer -NoForce
  }
} else {
  Write-Host "[2/3] Mobil o'tkazib yuborildi (-SkipMobile)" -ForegroundColor DarkYellow
  Write-Host "[3/3] APK yuklash o'tkazib yuborildi" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY YAKUNLANDI" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Veb:   $FrontendUrl"
Write-Host "API:   $ApiUrl"
Write-Host "Mobil: $FrontendUrl/settings/mobile-app"
Write-Host "Slug:  $TenantSlug"
Write-Host ""
