# Android emulyator kamerasi: PC veb-kamera bo'lsa webcam0, bo'lmasa emulated.
param(
    [string[]]$AvdNames = @('salesdoc_pixel7', 'Pixel_9a'),
    [int]$WebcamIndex = 0,
    [switch]$ClearSnapshots
)

$ErrorActionPreference = 'SilentlyContinue'
$emulator = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'
$argsFile = Join-Path $env:TEMP 'salec-emulator-camera.args'

function Set-IniValue {
    param(
        [string]$File,
        [string]$Key,
        [string]$Value
    )
    if (-not (Test-Path $File)) { return }
    $lines = Get-Content $File -Encoding UTF8
    $out = @()
    $done = $false
    foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $out += "$Key=$Value"
            $done = $true
        } else {
            $out += $line
        }
    }
    if (-not $done) { $out += "$Key=$Value" }
    Set-Content -Path $File -Value ($out -join "`r`n") -Encoding UTF8
}

function Get-AvailableWebcam {
    if (-not (Test-Path $emulator)) { return $null }
    $list = (& $emulator -webcam-list 2>&1 | Out-String).Trim()
    if (-not $list) { return $null }
    if ($list -match "webcam$WebcamIndex") { return "webcam$WebcamIndex" }
    if ($list -match "'(webcam\d+)'") { return $Matches[1] }
    if ($list -match '(webcam\d+)') { return $Matches[1] }
    return $null
}

function Set-AvdCamera {
    param([string]$AvdDir, [string]$Device)
    foreach ($name in @('config.ini', 'hardware-qemu.ini')) {
        Set-IniValue -File (Join-Path $AvdDir $name) -Key 'hw.camera.back' -Value $Device
        Set-IniValue -File (Join-Path $AvdDir $name) -Key 'hw.camera.front' -Value 'none'
    }

    $snapRoot = Join-Path $AvdDir 'snapshots'
    if (Test-Path $snapRoot) {
        Get-ChildItem -Path $snapRoot -Recurse -Filter 'hardware.ini' -ErrorAction SilentlyContinue | ForEach-Object {
            Set-IniValue -File $_.FullName -Key 'hw.camera.back' -Value $Device
            Set-IniValue -File $_.FullName -Key 'hw.camera.front' -Value 'none'
        }
    }

    Set-IniValue -File (Join-Path $AvdDir 'config.ini') -Key 'fastboot.forceColdBoot' -Value $(if ($ClearSnapshots) { 'yes' } else { 'no' })
    Set-IniValue -File (Join-Path $AvdDir 'config.ini') -Key 'fastboot.forceFastBoot' -Value $(if ($ClearSnapshots) { 'no' } else { 'yes' })
}

$webcam = Get-AvailableWebcam
if ($webcam) {
    $device = $webcam
    $cameraArgs = "-camera-back $webcam"
    $modeLabel = "PC veb-kamera ($webcam)"
} else {
    $device = 'emulated'
    $cameraArgs = '-camera-back emulated'
    $modeLabel = 'emulyatsiya (veb-kamera yo''q)'
}

$root = Join-Path $env:USERPROFILE '.android\avd'
foreach ($avd in $AvdNames) {
    $dir = Join-Path $root "$avd.avd"
    if (-not (Test-Path $dir)) { continue }

    if ($ClearSnapshots) {
        $snapDir = Join-Path $dir 'snapshots'
        if (Test-Path $snapDir) {
            Remove-Item -Path $snapDir -Recurse -Force
            Write-Host "[camera] $avd snapshots o'chirildi (cold boot)"
        }
    }

    Set-AvdCamera -AvdDir $dir -Device $device
    Write-Host "[camera] $avd <= $device ($modeLabel)"
}

Set-Content -Path $argsFile -Value $cameraArgs -Encoding ASCII -NoNewline

if (Test-Path $emulator) {
    Write-Host ""
    if ($webcam) {
        Write-Host "Emulyator web-kameralar:" -ForegroundColor Cyan
        & $emulator -webcam-list 2>&1 | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host 'PC veb-kamera topilmadi - emulyator virtual kamera bilan ishlaydi.' -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host ('Kamera rejimi: ' + $modeLabel) -ForegroundColor Cyan
if ($webcam) {
    Write-Host 'Windows: Sozlamalar - Maxfiylik - Kamera - Android Emulator ruxsati.' -ForegroundColor Cyan
}
