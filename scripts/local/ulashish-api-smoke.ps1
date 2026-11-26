# Ulashish / partners — lokal API+contract smoke (qurilmasiz).
# Qurilma E2E: ikkita TezYuk APK, bir xil ombor yoki web partnyor bog'lash.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

Write-Host "== backend share + partners tests =="
Push-Location (Join-Path $root "backend")
try {
  npx vitest run `
    tests/share-state.pure.test.ts `
    tests/share-partner-eligibility.pure.test.ts `
    tests/share-accept-handoff.pure.test.ts `
    tests/share-sender-cannot-act.test.ts `
    tests/share-create.lock.test.ts `
    tests/share-handoff-photo.route.contract.test.ts `
    tests/share-notify.pure.test.ts `
    tests/share-recipients.pure.test.ts `
    tests/share-recipients.route.contract.test.ts
} finally {
  Pop-Location
}

Write-Host "== frontend partners contract =="
Push-Location $root
try {
  npm run test --prefix frontend -- tests/expeditor-partners.contract.test.ts
} finally {
  Pop-Location
}

Write-Host @"

Qurilma qadamlari (ikkita TezYuk):
1) Web /settings/expeditor-partners — partnyor bog'lash (yoki bir xil ombor).
2) A: Ulashish → Yangi → zakaz + qabulchi NOMI → yuborish.
3) B: Kiruvchi → qabul → handoff kamera+GPS.
4) A: return-request; B: return-accept (agar kerak).
"@
