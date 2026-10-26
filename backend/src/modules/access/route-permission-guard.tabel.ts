/**
 * «Табель и посещаемость» hamda `/settings/tabel` marshrutlari uchun RBAC qoidalari.
 */
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type TabelRoutePermissionRule = { methods: Method[]; test: RegExp; anyOf: string[] };

const READ: Method[] = ["GET"];
const WRITE: Method[] = ["POST", "PUT", "PATCH"];
const DEL: Method[] = ["DELETE"];

function r(methods: Method[], test: RegExp, ...anyOf: string[]): TabelRoutePermissionRule {
  return { methods, test, anyOf };
}

export const TABEL_ROUTE_PERMISSION_RULES: TabelRoutePermissionRule[] = [
  // ─────────── Настройки: Табель, Face ID и посещаемость ───────────
  r(WRITE, /\/settings\/tabel(\/|$)/, "settings.tabel_pravila.update", "staff.tabel.update"),
  r(DEL, /\/settings\/tabel(\/|$)/, "settings.tabel_pravila.update", "staff.tabel.update"),
  r(READ, /\/settings\/tabel(\/|$)/, "settings.tabel_pravila.view", "settings.tabel_pravila.update", "staff.tabel.view"),

  // ─────────── Табель и посещаемость: ички бўлимлар ───────────
  r(READ, /\/tabel\/marks\/export/, "tabel.otmetki.export", "staff.tabel.export"),
  r(WRITE, /\/tabel\/(marks|problems)(\/|$)/, "tabel.otmetki.approve", "tabel.otmetki.update", "staff.tabel.update"),
  r(READ, /\/tabel\/analytics(\/|$)/, "tabel.statistika.view", "tabel.statistika.export", "tabel.otmetki.view", "staff.tabel.view"),
  r(READ, /\/tabel\/(marks|problems)(\/|$)/, "tabel.otmetki.view", "staff.tabel.view"),

  // Mobil davomat — global hook `/mobile/` ni skip qilmasin (faqat attendance).
  r(["POST"], /\/mobile\/attendance\/(punch|video-punch)$/, "tabel.mobilnaya_otmetka.create", "staff.tabel.update"),
  r(["POST"], /\/mobile\/attendance\/kiosk-punch$/, "tabel.ustroystva.assign"),
  r(["POST"], /\/mobile\/attendance\/my-requests$/, "tabel.mobilnaya_otmetka.create", "tabel.zayavki.create", "staff.tabel.update"),
  r(READ, /\/mobile\/attendance\/kiosk-team$/, "tabel.ustroystva.assign", "tabel.mobilnaya_otmetka.view"),
  r(READ, /\/mobile\/attendance\/(state|day-code|my-timesheet|my-requests)$/, "tabel.mobilnaya_otmetka.view", "staff.tabel.view"),

  r(["POST"], /\/tabel\/shifts(\/|$)/, "tabel.smeny.create", "tabel.smeny.update", "staff.rabochie_dni.update"),
  r(WRITE, /\/tabel\/shifts(\/|$)/, "tabel.smeny.update", "staff.rabochie_dni.update"),
  r(DEL, /\/tabel\/shifts(\/|$)/, "tabel.smeny.delete", "staff.rabochie_dni.delete"),
  r(READ, /\/tabel\/shifts(\/|$)/, "tabel.smeny.view", "staff.rabochie_dni.view"),

  r(WRITE, /\/tabel\/locations(\/|$)/, "settings.tabel_pravila.update", "tabel.smeny.update"),
  r(DEL, /\/tabel\/locations(\/|$)/, "settings.tabel_pravila.update", "tabel.smeny.delete"),
  r(READ, /\/tabel\/locations(\/|$)/, "settings.tabel_pravila.view", "tabel.smeny.view", "staff.tabel.view"),

  r(["POST"], /\/tabel\/absence-requests\/[^/]+\/(approve|reject)$/, "tabel.zayavki.approve", "staff.tabel.update"),
  r(["POST"], /\/tabel\/absence-requests(\/|$)/, "tabel.zayavki.create", "tabel.zayavki.approve", "staff.tabel.update"),
  r(WRITE, /\/tabel\/absence-requests(\/|$)/, "tabel.zayavki.approve", "tabel.zayavki.create", "staff.tabel.update"),
  r(DEL, /\/tabel\/absence-requests(\/|$)/, "tabel.zayavki.delete", "staff.tabel.update"),
  r(READ, /\/tabel\/absence-requests(\/|$)/, "tabel.zayavki.view", "staff.tabel.view"),

  r(["POST"], /\/tabel\/clearance-sheets\/[^/]+\/approve$/, "tabel.obhodnye.approve", "staff.sotrudniki.update"),
  r(["POST"], /\/tabel\/clearance-sheets(\/|$)/, "tabel.obhodnye.create", "tabel.obhodnye.update", "staff.sotrudniki.update"),
  r(WRITE, /\/tabel\/clearance-sheets(\/|$)/, "tabel.obhodnye.update", "tabel.obhodnye.approve", "staff.sotrudniki.update"),
  r(DEL, /\/tabel\/clearance-sheets(\/|$)/, "tabel.obhodnye.update", "staff.sotrudniki.update"),
  r(READ, /\/tabel\/clearance-sheets(\/|$)/, "tabel.obhodnye.view", "staff.sotrudniki.view", "staff.tabel.view"),

  r(["POST"], /\/tabel\/devices\/:id\/issue-token$/, "tabel.ustroystva.update"),
  r(["POST"], /\/tabel\/devices\/:id\/sync-faces$/, "tabel.ustroystva.assign", "tabel.ustroystva.update"),
  r(["POST"], /\/tabel\/devices(\/|$)/, "tabel.ustroystva.create", "tabel.ustroystva.update"),
  r(WRITE, /\/tabel\/devices(\/|$)/, "tabel.ustroystva.update"),
  r(DEL, /\/tabel\/devices(\/|$)/, "tabel.ustroystva.update"),
  r(READ, /\/tabel\/devices(\/|$)/, "tabel.ustroystva.view", "staff.tabel.view")
];
