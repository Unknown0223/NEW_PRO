param(
  [string]$BuildDir = ""
)

$ErrorActionPreference = "SilentlyContinue"
if (-not $BuildDir) {
  $BuildDir = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "mobile"
}

$gradlew = Join-Path $BuildDir "android\gradlew.bat"
if (Test-Path $gradlew) {
  & cmd /c "`"$gradlew`" --stop" 2>$null | Out-Null
  Start-Sleep -Milliseconds 500
  & cmd /c "`"$gradlew`" --stop" 2>$null | Out-Null
}

Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
  Where-Object { $_.CommandLine -match 'GradleDaemon|org\.gradle\.launcher\.daemon' } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
  }

$androidDir = Join-Path $BuildDir "android"
Get-ChildItem -Path $androidDir -Filter "hs_err_pid*.log" -ErrorAction SilentlyContinue |
  Remove-Item -Force

Write-Host "[gradle] Daemonlar to'xtatildi, eski JVM qoldiqlari tozalandi."
