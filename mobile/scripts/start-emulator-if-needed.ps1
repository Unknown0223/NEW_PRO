# Offline emulyatorni tozalab, kamera + GPU rejimida ishga tushiradi.
param(
    [string]$AndroidHome = $(Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
    [int]$BootWaitSeconds = 45,
    [switch]$WipeData
)

$ErrorActionPreference = 'SilentlyContinue'
$adb = Join-Path $AndroidHome 'platform-tools\adb.exe'
$emulatorExe = Join-Path $AndroidHome 'emulator\emulator.exe'
$argsFile = Join-Path $env:TEMP 'salec-emulator-camera.args'
$gpuPrefFile = Join-Path $env:TEMP 'salec-emulator-gpu.txt'

function Test-EmulatorReady {
    if (-not (Test-Path $adb)) { return $false }
    foreach ($line in (& $adb devices 2>&1)) {
        if ($line -match '^emulator-\d+\s+device\s*$') { return $true }
    }
    return $false
}

function Test-BootCompleted {
    if (-not (Test-EmulatorReady)) { return $false }
    $value = (& $adb shell getprop sys.boot_completed 2>&1 | Out-String).Trim()
    return $value -eq '1'
}

function Test-QemuRunning {
    return [bool](Get-Process -Name 'qemu-system-x86_64' -ErrorAction SilentlyContinue)
}

function Wait-EmulatorBoot {
    param([int]$TimeoutSeconds = 420)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastReconnect = [datetime]::MinValue
    while ((Get-Date) -lt $deadline) {
        if (Test-EmulatorReady) { return $true }
        if (-not (Test-QemuRunning)) { return $false }
        if (((Get-Date) - $lastReconnect).TotalSeconds -ge 20) {
            & $adb reconnect offline 2>&1 | Out-Null
            $lastReconnect = Get-Date
        }
        Start-Sleep -Seconds 5
    }
    return (Test-EmulatorReady)
}

function Wait-BootCompleted {
    param([int]$TimeoutSeconds = 300)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-BootCompleted) { return $true }
        if (-not (Test-QemuRunning)) { return $false }
        Start-Sleep -Seconds 5
    }
    return (Test-BootCompleted)
}

function Stop-StuckEmulators {
    if (-not (Test-Path $adb)) { return }
    foreach ($line in (& $adb devices 2>&1)) {
        if ($line -match '^(emulator-\d+)\s+(offline|unauthorized)\s*$') {
            $id = $Matches[1]
            Write-Host ('[emulator] ' + $id + ' holati notogri - toxtatilmoqda...')
            & $adb -s $id emu kill 2>&1 | Out-Null
        }
    }
    Get-Process -Name 'qemu-system-x86_64', 'emulator' -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 3
}

function Start-EmulatorInstance {
    param(
        [string]$Avd,
        [string]$Gpu,
        [string]$CameraArgs,
        [switch]$Wipe
    )
    $emuArgs = @(
        '-avd', $Avd,
        '-no-snapshot-load',
        '-no-snapshot-save',
        '-no-boot-anim',
        '-gpu', $Gpu
    )
    if ($Wipe) { $emuArgs += '-wipe-data' }
    $emuArgs += ($CameraArgs -split '\s+')
    Start-Process -FilePath $emulatorExe -ArgumentList $emuArgs -WorkingDirectory 'C:\' -WindowStyle Normal | Out-Null
    Start-Sleep -Seconds 12
}

if (Test-BootCompleted) {
    Write-Host 'Emulyator ulangan va tayyor.'
    exit 0
}

if (Test-EmulatorReady) {
    Write-Host 'Emulyator ulangan, Android yuklanmoqda...'
    if (Wait-BootCompleted -TimeoutSeconds ($BootWaitSeconds + 240)) {
        Write-Host 'Emulyator tayyor.'
        exit 0
    }
}

Stop-StuckEmulators

if (-not (Test-Path $argsFile)) {
    Write-Host 'Xato: kamera sozlamalari topilmadi. Avval fix-emulator-webcam.ps1 ishga tushiring.'
    exit 1
}

$cameraArgs = (Get-Content $argsFile -Raw).Trim()
if (-not $cameraArgs) { $cameraArgs = '-camera-back emulated' }

$avd = $null
if (Test-Path (Join-Path $env:USERPROFILE '.android\avd\salesdoc_pixel7.avd')) {
    $avd = 'salesdoc_pixel7'
} elseif (Test-Path (Join-Path $env:USERPROFILE '.android\avd\Pixel_9a.avd')) {
    $avd = 'Pixel_9a'
}

if (-not $avd) {
    Write-Host 'AVD topilmadi. Android Studio - Device Manager.'
    exit 1
}

if (-not (Test-Path $emulatorExe)) {
    Write-Host ('Xato: emulator.exe topilmadi: ' + $emulatorExe)
    exit 1
}

$gpuModes = @('auto', 'swangle', 'swiftshader', 'host')
if (Test-Path $gpuPrefFile) {
    $savedGpu = (Get-Content $gpuPrefFile -Raw).Trim()
    if ($savedGpu -and $gpuModes -contains $savedGpu) {
        $gpuModes = @($savedGpu) + ($gpuModes | Where-Object { $_ -ne $savedGpu })
    }
}

foreach ($gpu in $gpuModes) {
    if ($gpu -ne $gpuModes[0]) {
        Stop-StuckEmulators
    }

    $wipe = [bool]$WipeData
    Write-Host ('Emulyator ishga tushirilmoqda (' + $avd + ', ' + $cameraArgs + ', -gpu ' + $gpu + $(if ($wipe) { ', wipe-data' } else { '' }) + ')...')
    Write-Host 'Cold boot 2-5 daqiqa davom etishi mumkin, kuting...'
    Start-EmulatorInstance -Avd $avd -Gpu $gpu -CameraArgs $cameraArgs -Wipe:$wipe

    if (-not (Test-QemuRunning)) {
        Write-Host ('[emulator] -gpu ' + $gpu + ' jarayoni boshlanmadi, keyingi rejim...')
        continue
    }

    if (-not (Wait-EmulatorBoot -TimeoutSeconds 420)) {
        if (Test-QemuRunning) {
            Write-Host '[emulator] ADB hali offline, qemu ishlayapti - yana 3 daqiqa kutamiz...'
            if (-not (Wait-EmulatorBoot -TimeoutSeconds 180)) {
                Write-Host ('[emulator] -gpu ' + $gpu + ' bilan ulanmadi.')
                continue
            }
        } else {
            Write-Host ('[emulator] -gpu ' + $gpu + ' jarayoni toxtadi, keyingi rejim...')
            continue
        }
    }

    if (Wait-BootCompleted -TimeoutSeconds ($BootWaitSeconds + 300)) {
        Set-Content -Path $gpuPrefFile -Value $gpu -Encoding ASCII -NoNewline
        Write-Host ('Emulyator tayyor (-gpu ' + $gpu + ').')
        exit 0
    }

    Write-Host ('[emulator] -gpu ' + $gpu + ' bilan Android boot tugamadi, keyingi rejim...')
}

Write-Host 'Emulyator ishga tushmadi. Android Studio - Device Manager - Wipe Data sinab koring.'
exit 1
