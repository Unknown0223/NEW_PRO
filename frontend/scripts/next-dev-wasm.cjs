/**
 * Next.js dev launcher.
 *
 * Avval NATIVE SWC (@next/swc-win32-x64-msvc) yuklanishini tekshiramiz — u WASM
 * SWC'dan tezroq kompilyatsiya qiladi (bu loyihada transform ~1.3x tez).
 *
 * Faqat native binary yuklanmasa (masalan Windows Application Control bloklasa),
 * WebContainer rejimiga o'tib WASM SWC (@next/swc-wasm-nodejs) ga tushamiz.
 * Majburlashni `NEXT_FORCE_WASM=1` orqali ham yoqsa bo'ladi.
 */
function nativeSwcLoads() {
  if (process.env.NEXT_FORCE_WASM === "1") return false;
  try {
    require("@next/swc-win32-x64-msvc");
    return true;
  } catch {
    return false;
  }
}

if (!nativeSwcLoads()) {
  // Native SWC topilmadi yoki bloklangan — WASM SWC fallback.
  if (!process.versions.webcontainer) {
    process.versions.webcontainer = "1";
  }
  process.stdout.write("[next-dev] native SWC topilmadi — WASM SWC ishlatilmoqda (sekinroq)\n");
} else {
  process.stdout.write("[next-dev] native SWC ishlatilmoqda (tez)\n");
}

require("next/dist/bin/next");
