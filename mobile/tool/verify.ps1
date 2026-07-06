# Bitta ilova (mobile) — verify gate: analyze + unit/widget testlar
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "flutter analyze..."
flutter analyze --no-fatal-infos
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "flutter test..."
flutter test test/unit/ test/widget/
exit $LASTEXITCODE
