# Mobil dev: backend 18080 da bonus-preview route bor-yo'qligini tekshiradi.
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
    [string]$BaseUrl = "http://127.0.0.1:18080",
    [int]$WaitSeconds = 45
)

$probeUrl = "$BaseUrl/api/test1/mobile/orders/bonus-preview"

function Test-RouteRegistered {
    try {
        Invoke-WebRequest -Uri $probeUrl -Method POST -Body '{"client_id":1,"warehouse_id":1,"items":[{"product_id":1,"qty":1}]}' `
            -ContentType "application/json" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
        return $true
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 401 -or $code -eq 403 -or $code -eq 400) { return $true }
        if ($code -eq 404) {
            $body = $_.ErrorDetails.Message
            if ($body -and $body -notmatch 'Route POST:/api/.+/mobile/orders/bonus-preview not found') {
                return $true
            }
        }
        return $false
    }
}

function Get-ListenerPid {
    $c = Get-NetTCPConnection -LocalPort 18080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($c) { return $c.OwningProcess }
    return $null
}

if (Test-RouteRegistered) {
    Write-Host "Backend tayyor (bonus-preview mavjud)."
    exit 0
}

$pidListen = Get-ListenerPid
if ($pidListen) {
    Write-Host "Backend eski versiya (404). PID $pidListen toxtatilmoqda..."
    Stop-Process -Id $pidListen -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
} else {
    Write-Host "Backend ishlamayapti - ishga tushirilmoqda..."
}

$backendDir = Join-Path $RepoRoot "backend"
if (-not (Test-Path (Join-Path $backendDir "package.json"))) {
    Write-Host "Xato: backend papkasi topilmadi: $backendDir"
    exit 1
}

$argList = '/k npm run dev'
Start-Process -FilePath 'cmd.exe' -ArgumentList $argList -WorkingDirectory $backendDir -WindowStyle Normal

$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if (Test-RouteRegistered) {
        Write-Host 'Backend yangilandi va tayyor.'
        exit 0
    }
}

Write-Host 'Ogohlantirish: backend hali tayyor emas. npm run dev oynasini kuting, keyin mobilni R bilan qayta ishga tushiring.'
exit 0
