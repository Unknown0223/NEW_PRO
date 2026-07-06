# Play Market / tashqi ilovalar o'rnatish muammolarini tekshirish va tuzatish.
# Ishga tushirish: powershell -ExecutionPolicy Bypass -File mobile\scripts\fix-emulator-playstore.ps1

$ErrorActionPreference = "Stop"
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  Write-Error "adb topilmadi: $adb"
}

Write-Host "=== Emulator holati ===" -ForegroundColor Cyan
& $adb devices
& $adb shell getprop ro.product.model
& $adb shell getprop ro.build.fingerprint

$hasVending = & $adb shell pm list packages com.android.vending 2>$null
$hasGms = & $adb shell pm list packages com.google.android.gms 2>$null
Write-Host "Play Store (vending): $(if ($hasVending) { 'OK' } else { 'YOQ' })"
Write-Host "Google Play Services: $(if ($hasGms) { 'OK' } else { 'YOQ' })"

Write-Host "`n=== Google akkaunt ===" -ForegroundColor Cyan
& $adb shell dumpsys account 2>$null | Select-String -Pattern "type=com.google" | Select-Object -First 3

Write-Host "`n=== Play Store keshini tozalash (HTTP 500 / yuklab olish xatosi) ===" -ForegroundColor Cyan
& $adb shell pm clear com.android.vending 2>&1 | Out-Null
Write-Host "com.android.vending kesh tozalandi. Play Market qayta ochiladi — Google akkauntga qayta kiring."

Write-Host "`n=== Aurora Store (zaxira o'rnatuvchi) ===" -ForegroundColor Cyan
$aurora = & $adb shell pm list packages com.aurora.store 2>$null
if (-not $aurora) {
  $apk = Join-Path $env:TEMP "AuroraStore.apk"
  if (-not (Test-Path $apk)) {
    Write-Host "Aurora Store yuklanmoqda (F-Droid)..."
    curl.exe -L -o $apk "https://f-droid.org/repo/com.aurora.store_64.apk"
  }
  if ((Test-Path $apk) -and ((Get-Item $apk).Length -gt 1MB)) {
    & $adb install -r $apk
    Write-Host "Aurora Store o'rnatildi."
  }
} else {
  Write-Host "Aurora Store allaqachon o'rnatilgan."
}

Write-Host "`n=== Cactus Agent sahifasini ochish ===" -ForegroundColor Cyan
& $adb shell am start -a android.intent.action.VIEW -d "market://details?id=com.cactus.system.agent" 2>&1 | Out-Null
Start-Sleep -Seconds 1
& $adb shell am start -a android.intent.action.VIEW -d "https://play.google.com/store/apps/details?id=com.cactus.system.agent" com.aurora.store 2>&1 | Out-Null

Write-Host @"

Tavsiyalar:
  1) AVD: salesdoc_pixel7 (google_apis_playstore) ishlating — Pixel_9a ba'zan 16KB muammosi beradi.
  2) Play Market: Settings -> Network preferences -> App download preference = Over any network.
  3) HTTP 500 xatosi: bir necha daqiqadan keyin qayta Install bosing yoki Aurora Store orqali o'rnating.
  4) Cactus Agent paket: com.cactus.system.agent

"@ -ForegroundColor Yellow
