#Requires -Version 5.1
<#
.SYNOPSIS
  Downloads Unity Capture and registers the DirectShow virtual camera (Unity Video Capture).

.NOTES
  Requires an interactive UAC approval (Run as administrator). Non-interactive shells
  cannot elevate; run this script from an elevated or normal PowerShell window and accept UAC.
#>
$ErrorActionPreference = "Stop"

$DeviceName = "Unity Video Capture"
$UnityCaptureZipUrl = "https://github.com/schellingb/UnityCapture/archive/refs/heads/master.zip"
$ScriptDir = $PSScriptRoot
$VendorRoot = Join-Path $ScriptDir ".vendor"
$VendorDir = Join-Path $VendorRoot "UnityCapture"
$InstallBat = Join-Path $VendorDir "Install\Install.bat"
$ArchiveFolderName = "UnityCapture-master"

function Test-UnityVideoCapturePresent {
    $pnp = @(Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object {
            $_.FriendlyName -and $_.FriendlyName -like "*$DeviceName*"
        })
    if ($pnp.Count -gt 0) {
        return $true
    }

    $clsidKeys = @(
        "HKLM:\SOFTWARE\Classes\CLSID\{5c2cd55c-92ad-4999-8666-912bd3e70020}",
        "HKLM:\SOFTWARE\WOW6432Node\Classes\CLSID\{5c2cd55c-92ad-4999-8666-912bd3e70010}"
    )
    foreach ($key in $clsidKeys) {
        if (Test-Path -LiteralPath $key) {
            return $true
        }
    }

    return $false
}

function Ensure-UnityCaptureSources {
    if (Test-Path -LiteralPath $InstallBat) {
        return
    }

    New-Item -ItemType Directory -Force -Path $VendorRoot | Out-Null
    $zipPath = Join-Path $VendorRoot "$ArchiveFolderName.zip"
    $extracted = Join-Path $VendorRoot $ArchiveFolderName

    Write-Host "Unity Capture yuklanmoqda (GitHub: schellingb/UnityCapture)..."
    Invoke-WebRequest -Uri $UnityCaptureZipUrl -OutFile $zipPath -UseBasicParsing

    if (Test-Path -LiteralPath $extracted) {
        Remove-Item -LiteralPath $extracted -Recurse -Force
    }
    if (Test-Path -LiteralPath $VendorDir) {
        Remove-Item -LiteralPath $VendorDir -Recurse -Force
    }

    Expand-Archive -LiteralPath $zipPath -DestinationPath $VendorRoot -Force
    if (-not (Test-Path -LiteralPath $extracted)) {
        throw "Kutilmagan arxiv tuzilishi: $extracted topilmadi"
    }

    Move-Item -LiteralPath $extracted -Destination $VendorDir
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path -LiteralPath $InstallBat)) {
        throw "Install.bat topilmadi: $InstallBat"
    }
}

if (Test-UnityVideoCapturePresent) {
    Write-Host "OK: '$DeviceName' allaqachon ro'yxatdan o'tgan."
    exit 0
}

Ensure-UnityCaptureSources

$installDir = Split-Path -Parent $InstallBat
Write-Host ""
Write-Host "Keyingi qadam: UAC oynasida administrator huquqlarini tasdiqlang."
Write-Host "Unity Capture o'rnatiladi; brauzerda qurilma nomi: $DeviceName"
Write-Host ""

try {
    $process = Start-Process -FilePath $InstallBat -WorkingDirectory $installDir -Verb RunAs -Wait -PassThru
    if ($null -ne $process -and $process.ExitCode -ne 0) {
        Write-Warning "Install.bat tugadi, chiqish kodi: $($process.ExitCode)"
    }
}
catch {
    Write-Error @"
UAC yoki administrator oynasi rad etildi yoki ochilmadi.
Qo'lda: '$InstallBat' ustiga o'ng tugma -> Run as administrator.
Xato: $($_.Exception.Message)
"@
}

Start-Sleep -Seconds 2

if (Test-UnityVideoCapturePresent) {
    Write-Host "OK: '$DeviceName' o'rnatildi."
    exit 0
}

Write-Warning @"
'$DeviceName' hali ko'rinmadi. UAC rad etilgan bo'lishi mumkin yoki brauzerni qayta ishga tushiring.
Vendor: $VendorDir
"@
exit 1