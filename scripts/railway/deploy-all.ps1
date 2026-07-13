# SALEC — to'liq production deploy: backend + frontend + mobil APK
# Ishlatish: repo ildizidan  .\deploy-all.cmd
param(
  [string]$ProjectName = "artistic-endurance",
  [string]$ApiUrl = "https://backend-production-3cf2.up.railway.app",
  [string]$FrontendUrl = "https://sales-arena.up.railway.app",
  [string]$AdminPassword = "secret123",
  [string]$TenantSlug = "test1",
  [switch]$SkipBootstrap,
  [switch]$SkipMobile,
  [switch]$SkipWeb,
  [switch]$WipeDatabase
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$RailwayScript = Join-Path $PSScriptRoot "deploy.ps1"
$MobileEnvScript = Join-Path $Root "scripts\env\switch-production-mobile.ps1"
$FlutterEnvScript = Join-Path $Root "scripts\env\resolve-flutter.ps1"
$UploadScript = Join-Path $PSScriptRoot "upload-mobile-apk-prod.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SALEC TO'LIQ PRODUCTION DEPLOY" -ForegroundColor Cyan
Write-Host "  $Root" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Backend + Frontend (Railway) ---
if (-not $SkipWeb) {
  Write-Host "[1/3] Backend va Frontend deploy..." -ForegroundColor Yellow
  if ($SkipBootstrap -and $WipeDatabase) {
    & $RailwayScript -ProjectName $ProjectName -SkipBootstrap -WipeDatabase
  } elseif ($SkipBootstrap) {
    & $RailwayScript -ProjectName $ProjectName -SkipBootstrap
  } elseif ($WipeDatabase) {
    & $RailwayScript -ProjectName $ProjectName -WipeDatabase
  } else {
    & $RailwayScript -ProjectName $ProjectName
  }
} else {
  Write-Host "[1/3] Web deploy o'tkazib yuborildi (-SkipWeb)" -ForegroundColor DarkYellow
}

# --- 2. Mobil APK yig'ish ---
if (-not $SkipMobile) {
  Write-Host ""
  Write-Host "[2/3] Mobil APK yig'ilmoqda..." -ForegroundColor Yellow
  & $MobileEnvScript
  . $FlutterEnvScript
  $envInfo = Set-MobileBuildEnv
  $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle"
  Write-Host "Flutter: $($envInfo.FlutterBin)" -ForegroundColor DarkGray
  Write-Host "Java:    $($envInfo.JavaHome)" -ForegroundColor DarkGray

  $MobileDir = Join-Path $Root "mobile"
  $BuildDir = "C:\salesdoc_mobile"
  $SyncCmd = Join-Path $MobileDir "scripts\sync-to-build-dir.cmd"
  $StopGradle = Join-Path $MobileDir "scripts\stop-gradle-daemons.ps1"

  # Cyrillic/D: disk muammosi: APK C:\salesdoc_mobile da yig'iladi
  Write-Host "Sync: $MobileDir -> $BuildDir" -ForegroundColor DarkGray
  & cmd /c "`"$SyncCmd`""
  if ($LASTEXITCODE -ne 0) { throw "sync-to-build-dir xato" }
  # Android gradle sozlamalarini yangilash (lintVital o'chirilgan)
  robocopy (Join-Path $MobileDir "android") (Join-Path $BuildDir "android") /E /XD .gradle /NFL /NDL /NJH /NJS | Out-Null
  if (Test-Path (Join-Path $MobileDir ".env")) {
    Copy-Item (Join-Path $MobileDir ".env") (Join-Path $BuildDir ".env") -Force
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

  # --- 3. APK serverga yuklash ---
  Write-Host ""
  Write-Host "[3/3] APK serverga yuklanmoqda..." -ForegroundColor Yellow
  & $UploadScript -Api $ApiUrl -Slug $TenantSlug -AdminPassword $AdminPassword -ApkPath $latestApk -LatestVersion $appVer
} else {
  Write-Host "[2/3] Mobil o'tkazib yuborildi (-SkipMobile)" -ForegroundColor DarkYellow
  Write-Host "[3/3] APK yuklash o'tkazib yuborildi" -ForegroundColor DarkYellow
}

# --- Smoke check ---
Write-Host ""
Write-Host "Smoke check..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
try {
  $health = Invoke-RestMethod -Uri "$ApiUrl/health" -TimeoutSec 30
  Write-Host "Backend: $($health.status)" -ForegroundColor Green
} catch {
  Write-Host "Backend health: KUTMOQDA (build tugashini kuting)" -ForegroundColor DarkYellow
}
try {
  $login = Invoke-WebRequest -Uri "$FrontendUrl/login" -UseBasicParsing -TimeoutSec 30
  Write-Host "Frontend /login: HTTP $($login.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "Frontend: KUTMOQDA" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOY YAKUNLANDI" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Veb:   $FrontendUrl"
Write-Host "API:   $ApiUrl"
Write-Host "Mobil: $FrontendUrl/settings/mobile-app"
Write-Host ""
