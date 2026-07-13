# Android emulyator kamerasi: PC veb-kamera bo'lsa webcam0, bo'lmasa emulated.
param(
    [string[]]$AvdNames = @('salesdoc_pixel7', 'Pixel_9a'),
    [int]$WebcamIndex = 0,
    [switch]$ClearSnapshots
)

$ErrorActionPreference = 'SilentlyContinue'
$emulator = Join-Path $env:LOCALAPPDATA 'Android\Sdk\emulator\emulator.exe'
$argsFile = Join-Path $env:TEMP 'salec-emulator-camera.args'
$modeFile = Join-Path $env:TEMP 'salec-emulator-camera.mode'

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

function Get-WindowsWebcamStatus {
    $devices = @()
    foreach ($cls in @('Camera', 'Image')) {
        Get-PnpDevice -Class $cls -ErrorAction SilentlyContinue | ForEach-Object {
            $devices += $_
        }
    }

    $working = @($devices | Where-Object { $_.Status -eq 'OK' -and $_.Present -eq $true })
    $broken = @($devices | Where-Object {
        $_.Present -ne $true -or $_.Status -ne 'OK' -or $_.Problem -ne 0
    })

    return [PSCustomObject]@{
        Working = $working
        Broken = $broken
        HasWorking = ($working.Count -gt 0)
    }
}

function Get-EmulatorWebcamList {
    if (-not (Test-Path $emulator)) { return @() }

    $raw = (& $emulator -webcam-list 2>&1 | Out-String).Trim()
    if (-not $raw) { return @() }

    $found = [regex]::Matches($raw, 'webcam\d+') | ForEach-Object { $_.Value } | Select-Object -Unique
    return @($found)
}

function Get-AvailableWebcam {
    $fromEmulator = Get-EmulatorWebcamList
    if ($fromEmulator.Count -gt 0) {
        $preferred = "webcam$WebcamIndex"
        if ($fromEmulator -contains $preferred) { return $preferred }
        return $fromEmulator[0]
    }

    $win = Get-WindowsWebcamStatus
    if ($win.HasWorking) {
        return "webcam$WebcamIndex"
    }

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

$winStatus = Get-WindowsWebcamStatus
$webcam = Get-AvailableWebcam
if ($webcam) {
    $device = $webcam
    $cameraArgs = "-camera-back $webcam"
    $detectedBy = if ((Get-EmulatorWebcamList).Count -gt 0) { 'emulator -webcam-list' } else { 'Windows qurilma ro''yxati' }
    $modeLabel = "PC veb-kamera ($webcam, $detectedBy)"
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
Set-Content -Path $modeFile -Value $device -Encoding ASCII -NoNewline

Write-Host ""
if (Test-Path $emulator) {
  $emuList = Get-EmulatorWebcamList
  if ($emuList.Count -gt 0) {
    Write-Host 'Emulyator web-kameralar:' -ForegroundColor Cyan
    $emuList | ForEach-Object { Write-Host "  $_" }
  } elseif ($winStatus.Working.Count -gt 0) {
    Write-Host 'Windows veb-kameralar (emulator -webcam-list bo''sh, lekin qurilma bor):' -ForegroundColor Cyan
    $winStatus.Working | ForEach-Object { Write-Host ('  ' + $_.FriendlyName + ' [' + $_.Status + ']') }
  } elseif ($winStatus.Broken.Count -gt 0) {
    Write-Host 'Windows da kamera yozuvi bor, lekin u faol emas:' -ForegroundColor Yellow
    $winStatus.Broken | ForEach-Object {
      $hint = if ($_.Present -ne $true) { 'ulanmagan (USB ni qayta ulang)' } else { $_.Status }
      Write-Host ('  ' + $_.FriendlyName + ' - ' + $hint)
    }
    Write-Host 'Shuning uchun virtual kamera ishlatiladi.' -ForegroundColor Yellow
  } else {
    Write-Host 'PC veb-kamera topilmadi - emulyator virtual kamera bilan ishlaydi.' -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host ('Kamera rejimi: ' + $modeLabel) -ForegroundColor Cyan
if ($webcam) {
    Write-Host 'Windows: Sozlamalar - Maxfiylik - Kamera - Android Emulator ruxsati yoqilgan bo''lsin.' -ForegroundColor Cyan
    Write-Host 'Agar hali ham virtual rasm ko''rinsa: mobile\restart-emulator-webcam.cmd ishga tushiring.' -ForegroundColor Cyan
}
