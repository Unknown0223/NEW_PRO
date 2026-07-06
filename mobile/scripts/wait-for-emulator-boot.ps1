# Flutter oldidan emulyator device + boot_completed holatini kutadi.
param([int]$TimeoutSeconds = 300)

$ErrorActionPreference = 'SilentlyContinue'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { exit 1 }

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    $ready = $false
    foreach ($line in (& $adb devices 2>&1)) {
        if ($line -match '^(emulator-\d+)\s+device\s*$') {
            $ready = $true
            break
        }
    }
    if ($ready) {
        $boot = (& $adb shell getprop sys.boot_completed 2>&1 | Out-String).Trim()
        if ($boot -eq '1') { exit 0 }
    }
    Start-Sleep -Seconds 3
}

exit 1
