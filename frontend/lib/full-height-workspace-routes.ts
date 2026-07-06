/**
 * Ichki sticky jadval + viewport scroll (tashqi sahifa emas).
 * Qolgan sahifalar — kontent balandligi bo‘yicha, sahifa scroll qiladi.
 */
const FULL_HEIGHT_EXACT: readonly string[] = [
  "/payments",
  "/client-expenses"
];

const FULL_HEIGHT_PREFIXES: readonly string[] = [
  "/clients",
  "/access",
  "/payments/edit-grants",
  "/orders/refusals",
  "/settings"
];

/**
 * Klient profili va uning barcha ichki sahifalari — tabiiy sahifa scroll.
 * (/clients — ro‘yxat jadvali full-height qoladi)
 */
const FULL_HEIGHT_EXCLUDE: readonly RegExp[] = [/^\/clients\/\d+(\/.*)?$/];

/** Spravochnik (agent, ekspeditor, …) — oddiy ro‘yxat, viewport to‘ldirmaydi. */
function isSpravochnikSettingsPath(path: string): boolean {
  return path === "/settings/spravochnik" || path.startsWith("/settings/spravochnik/");
}

export function isFullHeightWorkspaceRoute(pathname: string): boolean {
  const path = (pathname.split("?")[0] ?? "").replace(/\/$/, "") || "/";
  if (isSpravochnikSettingsPath(path)) return false;
  if (FULL_HEIGHT_EXCLUDE.some((re) => re.test(path))) return false;
  if (FULL_HEIGHT_EXACT.includes(path)) return true;
  return FULL_HEIGHT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
