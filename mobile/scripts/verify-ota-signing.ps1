# Sales Arena — OTA imzo kaliti tekshiruvi (PC dan mustaqil).
# Build/deploy oldidan: bir xil SHA-1 ekanini tasdiqlaydi.
param(
  [string]$MobileDir = ""
)

$ErrorActionPreference = "Stop"
if (-not $MobileDir) {
  $MobileDir = Resolve-Path (Join-Path $PSScriptRoot "..")
}

$Expected = "21FC3148B49A8928A2C2F04F6EDBA8CF36A8F882"
$Jks = Join-Path $MobileDir "android\keystore\salesdoc-ota.jks"
$Props = Join-Path $MobileDir "android\key.properties"
$Pin = Join-Path $MobileDir "android\keystore\EXPECTED_SHA1.txt"

Write-Host "=== OTA signing verify ===" -ForegroundColor Cyan
Write-Host "Mobile: $MobileDir"

if (-not (Test-Path $Jks)) {
  throw "salesdoc-ota.jks YO‘Q: $Jks — git pull qiling, kalitni qayta yaratmang."
}
if (-not (Test-Path $Props)) {
  throw "key.properties YO‘Q: $Props — git pull qiling."
}
if (Test-Path $Pin) {
  $pinLine = (Get-Content $Pin | Where-Object { $_ -match '^[0-9A-Fa-f]{40}$' } | Select-Object -First 1)
  if ($pinLine) { $Expected = $pinLine.Trim().ToUpperInvariant() }
}

$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome "bin\keytool.exe"))) {
  $studioJbr = "C:\Program Files\Android\Android Studio\jbr"
  if (Test-Path (Join-Path $studioJbr "bin\keytool.exe")) {
    $javaHome = $studioJbr
  }
}
$keytool = if ($javaHome) { Join-Path $javaHome "bin\keytool.exe" } else { "keytool" }
if (-not (Get-Command $keytool -ErrorAction SilentlyContinue) -and -not (Test-Path $keytool)) {
  throw "keytool topilmadi. JAVA_HOME ni sozlang."
}

$out = & $keytool -list -v -keystore $Jks -storepass android -alias androiddebugkey 2>&1 | Out-String
$m = [regex]::Match($out, "SHA1:\s*([0-9A-Fa-f:]+)")
if (-not $m.Success) {
  throw "keytool SHA1 o‘qilmadi. Alias/parol noto‘g‘ri bo‘lishi mumkin."
}
$sha1 = ($m.Groups[1].Value -replace ":", "").ToUpperInvariant()
Write-Host "SHA-1: $sha1"
if ($sha1 -ne $Expected.ToUpperInvariant()) {
  throw "NOTO‘G‘RI KALIT! kutilgan=$Expected hozirgi=$sha1 — salesdoc-ota.jks ni almashtirmang."
}

Write-Host "OK — OTA kalit pinned (PC o‘zgarsa ham shu)." -ForegroundColor Green
