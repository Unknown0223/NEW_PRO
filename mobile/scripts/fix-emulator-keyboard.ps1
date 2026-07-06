# Emulyatorda fizik klaviatura ishlashi uchun AVD + Android sozlamalari.
param(
    [string]$AvdName = 'salesdoc_pixel7'
)

$ErrorActionPreference = 'SilentlyContinue'

$avdDir = Join-Path $env:USERPROFILE ".android\avd\${AvdName}.avd"
if (Test-Path $avdDir) {
    $config = Join-Path $avdDir 'config.ini'
    $qemu = Join-Path $avdDir 'hardware-qemu.ini'
    foreach ($file in @($config, $qemu)) {
        if (-not (Test-Path $file)) { continue }
        $text = Get-Content $file -Raw -Encoding UTF8
        $text = $text -replace '(?m)^hw\.keyboard\s*=\s*no\s*$', 'hw.keyboard=yes'
        $text = $text -replace '(?m)^hw\.keyboard\s*=\s*false\s*$', 'hw.keyboard = true'
        $text = $text -replace '(?m)^hw\.keyboard\.lid\s*=\s*yes\s*$', 'hw.keyboard.lid=no'
        $text = $text -replace '(?m)^hw\.keyboard\.lid\s*=\s*true\s*$', 'hw.keyboard.lid = false'
        Set-Content -Path $file -Value $text -Encoding UTF8 -NoNewline
    }
}

$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { exit 0 }

$ready = $false
foreach ($line in (& $adb devices 2>&1)) {
    if ($line -match '^emulator-\d+\s+device\s*$') { $ready = $true; break }
}
if (-not $ready) { exit 0 }

$boot = (& $adb shell getprop sys.boot_completed 2>&1 | Out-String).Trim()
if ($boot -ne '1') { exit 0 }
# 0 = fizik klaviatura bilan ekran klaviaturasini majburan ochmaslik
& $adb shell settings put secure show_ime_with_hard_keyboard 0 | Out-Null
& $adb shell settings put secure default_input_method 'com.google.android.inputmethod.latin/com.android.inputmethod.latin.LatinIME' | Out-Null

Write-Host '[keyboard] Fizik klaviatura yoqildi (keyingi cold boot dan keyin ham saqlanadi).'
