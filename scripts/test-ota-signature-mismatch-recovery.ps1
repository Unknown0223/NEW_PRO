# OTA signature-mismatch recovery — to'liq avtomatik test (emulyator + prod API)
# Ishlatish:  powershell -File scripts\test-ota-signature-mismatch-recovery.ps1
param(
  [string]$Device = "emulator-5554",
  [string]$Api = "https://backend-production-3cf2.up.railway.app",
  [string]$Slug = "test1",
  [string]$ExpectedOtaSha1 = "21FC3148B49A8928A2C2F04F6EDBA8CF36A8F882",
  [string]$WrongApk = "",
  [string]$OtaApk = ""
)

$ErrorActionPreference = "Continue"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Releases = Join-Path $Root "mobile\releases"
if (-not $WrongApk) { $WrongApk = Join-Path $Releases "SalesDoc-3.1.19-WRONG-KEY-PROD.apk" }
if (-not $OtaApk) {
  $cand = Join-Path $Releases "SalesDoc-3.1.24-release.apk"
  if (Test-Path $cand) { $OtaApk = $cand } else { $OtaApk = Join-Path $Releases "SalesDoc-latest-release.apk" }
}

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
$bt = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
$apksigner = Join-Path $bt.FullName "apksigner.bat"
$failed = 0
$passed = 0
$ServerApk = $null

function Step([string]$msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ok([string]$msg) { $script:passed++; Write-Host "PASS: $msg" -ForegroundColor Green }
function Fail([string]$msg) { $script:failed++; Write-Host "FAIL: $msg" -ForegroundColor Red }

function Invoke-DeviceAdb {
  param([Parameter(Mandatory)][string[]]$Cmd)
  & adb.exe -s $Device @Cmd
}

function Get-ApkSha1([string]$path) {
  $out = & $apksigner verify --print-certs $path 2>&1 | Out-String
  if ($out -match 'SHA-1 digest:\s*([0-9a-fA-F]+)') { return $Matches[1].ToUpperInvariant() }
  throw "SHA-1 topilmadi: $path`n$out"
}

function Get-InstalledMeta {
  $dump = (& adb.exe -s $Device shell dumpsys package uz.salesdoc.salesdoc_mobile 2>&1 | Out-String)
  $vn = if ($dump -match 'versionName=([^\s]+)') { $Matches[1] } else { $null }
  $vc = if ($dump -match 'versionCode=(\d+)') { $Matches[1] } else { $null }
  $sig = if ($dump -match 'signatures:\[([^\]]+)\]') { $Matches[1] } else { $null }
  [pscustomobject]@{ versionName = $vn; versionCode = $vc; sig = $sig }
}

Step "Preflight"
$state = & adb.exe -s $Device get-state 2>&1 | Out-String
if ($state -notmatch 'device') { throw "Device $Device topilmadi: $state" }
if (-not (Test-Path $WrongApk)) { throw "Wrong APK yo'q: $WrongApk" }
if (-not (Test-Path $OtaApk)) { throw "OTA APK yo'q: $OtaApk" }
Ok "device + APK fayllar bor"

Step "1) Kalitlar farqi"
$shaWrong = Get-ApkSha1 $WrongApk
$shaOta = Get-ApkSha1 $OtaApk
Write-Host "WRONG: $shaWrong"
Write-Host "OTA:   $shaOta"
if ($shaWrong -eq $shaOta) { Fail "Kalitlar BIR XIL — mismatch test imkonsiz" } else { Ok "Kalitlar farq qiladi" }
if ($shaOta -eq $ExpectedOtaSha1.ToUpperInvariant()) { Ok "OTA SHA-1 pinned ($ExpectedOtaSha1)" } else { Fail "OTA SHA-1 kutilgan emas: $shaOta" }

Step "2) Prod API release (3.1.19 → yangi)"
try {
  $rel = Invoke-RestMethod -Uri "$Api/api/mobile/app-release?slug=$Slug&version=3.1.19&platform=android" -TimeoutSec 30
  Write-Host (($rel | ConvertTo-Json -Depth 6 -Compress))
  $upd = $rel.update
  if (-not $upd) { $upd = $rel }
  $latest = [string]$upd.latest_version
  $apkUrl = [string]$upd.apk_url
  if (-not $apkUrl) { $apkUrl = [string]$upd.download_url }
  Write-Host "latest=$latest apk_url=$apkUrl"
  if ($latest -and ($latest -ne '3.1.19')) { Ok "API latest=$latest (19 dan yangi)" } else { Fail "API latest yangilanmagan: $latest" }
  if ($apkUrl) { Ok "API apk_url bor" } else { Fail "API apk_url yo'q" }

  if ($apkUrl) {
    $tmpDl = Join-Path $env:TEMP "salec-ota-from-server.apk"
    Invoke-WebRequest -Uri $apkUrl -OutFile $tmpDl -TimeoutSec 180
    $shaServer = Get-ApkSha1 $tmpDl
    Write-Host "SERVER APK SHA-1: $shaServer  size=$((Get-Item $tmpDl).Length)"
    if ($shaServer -eq $ExpectedOtaSha1.ToUpperInvariant()) { Ok "Server APK OTA kalit bilan" } else { Fail "Server APK SHA-1 noto'g'ri: $shaServer" }
    $ServerApk = $tmpDl
  }
} catch {
  Fail "Prod API: $($_.Exception.Message)"
}

Step "3) Wrong-key 3.1.19 o'rnatish"
& adb.exe -s $Device uninstall uz.salesdoc.salesdoc_mobile 2>$null | Out-Null
$inst = & adb.exe -s $Device install -r $WrongApk 2>&1 | Out-String
if ($inst -match 'Success') { Ok "Wrong-key APK o'rnatildi" } else { Fail "Install: $inst"; throw "stop" }
& adb.exe -s $Device shell appops set uz.salesdoc.salesdoc_mobile REQUEST_INSTALL_PACKAGES allow | Out-Null
$meta = Get-InstalledMeta
Write-Host "installed: v=$($meta.versionName) code=$($meta.versionCode) sig=$($meta.sig)"
if ($meta.versionName -eq '3.1.19') { Ok "versionName=3.1.19" } else { Fail "versionName=$($meta.versionName)" }
$sigWrongInstalled = $meta.sig

Step "4) Ustiga OTA o'rnatish RAD etilishi kerak (UPDATE_INCOMPATIBLE)"
$upgrade = & adb.exe -s $Device install -r $OtaApk 2>&1 | Out-String
Write-Host $upgrade.Trim()
if ($upgrade -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match|UPDATE_INCOMPATIBLE') {
  Ok "In-place update bloklandi (kutilgan)"
} elseif ($upgrade -match 'Success') {
  Fail "In-place update SUCCESS — kalitlar mos emasligi isbotlanmadi"
} else {
  Fail "Kutilmagan install natija: $upgrade"
}
$meta2 = Get-InstalledMeta
if ($meta2.versionName -eq '3.1.19') { Ok "Hali ham 3.1.19 (yangilanmagan)" } else { Fail "Versiya o'zgardi: $($meta2.versionName)" }

Step "5) Recovery: APK ni Downloads ga qo'yish"
& adb.exe -s $Device shell mkdir -p /sdcard/Download 2>$null | Out-Null
& adb.exe -s $Device shell rm -f /sdcard/Download/SalesArena-update.apk 2>$null | Out-Null
$srcForDl = if ($ServerApk -and (Test-Path $ServerApk)) { $ServerApk } else { $OtaApk }
& adb.exe -s $Device push $srcForDl /sdcard/Download/SalesArena-update.apk | Out-Null
$ls = & adb.exe -s $Device shell ls -la /sdcard/Download/SalesArena-update.apk 2>&1 | Out-String
Write-Host $ls.Trim()
if ($ls -match 'SalesArena-update\.apk' -and $ls -notmatch 'No such file') { Ok "Downloads/SalesArena-update.apk bor" } else { Fail "Downloads ga yozilmadi: $ls" }

Step "6) Ilovani o'chirish"
$un = & adb.exe -s $Device uninstall uz.salesdoc.salesdoc_mobile 2>&1 | Out-String
if ($un -match 'Success') { Ok "Uninstall OK" } else { Fail "Uninstall: $un" }
$gone = & adb.exe -s $Device shell pm path uz.salesdoc.salesdoc_mobile 2>&1 | Out-String
if ($gone -match 'package:') { Fail "Paket hali bor" } else { Ok "Paket o'chirilgan" }

Step "7) Downloads / tmp dan yangi o'rnatish"
# Emulator SELinux: pm install /sdcard/... ko'pincha rad etadi.
# Ishonchli yo'l: /data/local/tmp + pm install (yoki host adb install).
& adb.exe -s $Device push $srcForDl /data/local/tmp/SalesArena-update.apk | Out-Null
$fromDl = & adb.exe -s $Device shell pm install -r -t /data/local/tmp/SalesArena-update.apk 2>&1 | Out-String
Write-Host $fromDl.Trim()
if ($fromDl -notmatch 'Success') {
  Write-Host "tmp pm install ishlamadi — host adb install..." -ForegroundColor Yellow
  $fromDl = & adb.exe -s $Device install $OtaApk 2>&1 | Out-String
  Write-Host $fromDl.Trim()
}
if ($fromDl -match 'Success') { Ok "Fresh install Success" } else { Fail "Fresh install: $fromDl"; throw "stop" }

$meta3 = Get-InstalledMeta
Write-Host "after recovery: v=$($meta3.versionName) code=$($meta3.versionCode) sig=$($meta3.sig)"
if ($meta3.versionName -and ($meta3.versionName -ne '3.1.19')) { Ok "Yangi versiya: $($meta3.versionName)" } else { Fail "Versiya hali 3.1.19" }
if ($meta3.sig -and $sigWrongInstalled -and ($meta3.sig -ne $sigWrongInstalled)) {
  Ok "Imzo o'zgardi (wrong → OTA)"
} elseif ($meta3.sig -eq $sigWrongInstalled) {
  Fail "Imzo o'zgarmagan (hali wrong key)"
} else {
  Ok "Imzo meta: $($meta3.sig)"
}

Step "8) Bir xil kalit bilan keyingi OTA (3.1.23 → 3.1.24)"
$prev = Join-Path $Releases "SalesDoc-3.1.23-release.apk"
if (Test-Path $prev) {
  & adb.exe -s $Device uninstall uz.salesdoc.salesdoc_mobile 2>$null | Out-Null
  $i1 = & adb.exe -s $Device install $prev 2>&1 | Out-String
  $r = & adb.exe -s $Device install -r $OtaApk 2>&1 | Out-String
  Write-Host "install 23: $($i1.Trim())"
  Write-Host "upgrade 24: $($r.Trim())"
  if ($r -match 'Success') { Ok "Bir xil kalit bilan 3.1.23 → 3.1.24 OK" } else { Fail "Same-key upgrade: $r" }
  $meta4 = Get-InstalledMeta
  if ($meta4.versionName -eq '3.1.24') { Ok "Final versionName=3.1.24" } else { Fail "Final=$($meta4.versionName)" }
} else {
  Ok "Same-key upgrade skip (3.1.23 APK yo'q)"
}

Step "Natija"
Write-Host "PASS=$passed  FAIL=$failed" -ForegroundColor $(if ($failed -eq 0) { 'Green' } else { 'Red' })
if ($failed -gt 0) { exit 1 } else { exit 0 }
