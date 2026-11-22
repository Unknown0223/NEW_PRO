# Flutter Broken pipe (32) / package service o‘lsa — ADB qayta + install.
param(
    [Parameter(Mandatory = $true)][string]$ApkPath,
    [string]$PackageId = 'uz.salesdoc.salesdoc_mobile',
    [string]$DeviceId = 'emulator-5554',
    [int]$Retries = 3
)

$ErrorActionPreference = 'Continue'
if (-not (Test-Path -LiteralPath $ApkPath)) {
    Write-Host "APK yo'q: $ApkPath" -ForegroundColor Red
    exit 1
}

function Wait-DeviceReady([string]$id, [int]$sec = 90) {
    adb -s $id wait-for-device 2>$null | Out-Null
    $deadline = (Get-Date).AddSeconds($sec)
    while ((Get-Date) -lt $deadline) {
        $boot = (adb -s $id shell getprop sys.boot_completed 2>$null | Out-String).Trim()
        $pm = (adb -s $id shell cmd package list packages 2>$null | Select-Object -First 1 | Out-String).Trim()
        if ($boot -eq '1' -and $pm -ne '') { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

for ($i = 1; $i -le $Retries; $i++) {
    Write-Host "ADB install urinish $i/$Retries..." -ForegroundColor Cyan
    if ($i -gt 1) {
        adb kill-server 2>$null | Out-Null
        Start-Sleep -Seconds 2
        adb start-server 2>$null | Out-Null
    }
    if (-not (Wait-DeviceReady $DeviceId)) {
        Write-Host 'Emulyator/package manager tayyor emas.' -ForegroundColor Yellow
        continue
    }
    adb -s $DeviceId uninstall $PackageId 2>$null | Out-Null
    Start-Sleep -Seconds 1
    $out = adb -s $DeviceId install -r -t -d $ApkPath 2>&1 | Out-String
    Write-Host $out
    if ($out -match '(?i)Success') {
        Write-Host 'APK o''rnatildi.' -ForegroundColor Green
        exit 0
    }
    if ($out -match '(?i)Broken pipe|Failure calling service package') {
        Write-Host 'Broken pipe — biroz kutib qayta...' -ForegroundColor Yellow
        Start-Sleep -Seconds 4
        continue
    }
}

Write-Host 'ADB install muvaffaqiyatsiz.' -ForegroundColor Red
exit 1
