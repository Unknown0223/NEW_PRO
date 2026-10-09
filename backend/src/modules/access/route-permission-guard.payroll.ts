/**
 * Зарплата / Аванс / Выдача marshrutlari. Umumiy `/staff/` va `/cash-desks/`
 * qoidalaridan OLDIN turishi shart (birinchi mos kelgan qoida ishlatiladi).
 */
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type PayrollRoutePermissionRule = { methods: Method[]; test: RegExp; anyOf: string[] };

const READ: Method[] = ["GET"];
const WRITE: Method[] = ["POST", "PUT", "PATCH"];
const DEL: Method[] = ["DELETE"];

function r(methods: Method[], test: RegExp, ...anyOf: string[]): PayrollRoutePermissionRule {
  return { methods, test, anyOf };
}

export const PAYROLL_ROUTE_PERMISSION_RULES: PayrollRoutePermissionRule[] = [
  r(
    READ,
    /\/payroll\/settings$/,
    "staff.zarplaty.view",
    "staff.avans.view",
    "cash.vydacha_zarplaty.view",
    "finance.avans.view"
  ),

  // Kassir navbati va to'lovlar
  r(READ, /\/payroll\/cashier-queue(\/|$)/, "cash.vydacha_zarplaty.view"),
  r(WRITE, /\/payroll\/cashier-queue\/[^/]+\/skip$/, "cash.vydacha_zarplaty.create"),
  r(WRITE, /\/payroll\/payouts\/[^/]+\/reverse$/, "cash.vydacha_zarplaty.void"),
  r(WRITE, /\/payroll\/payouts$/, "cash.vydacha_zarplaty.create"),
  r(READ, /\/payroll\/payouts(\/|$)/, "cash.vydacha_zarplaty.view", "cash.vydacha_zarplaty.history", "staff.zarplaty.view"),

  // Avans tasdiqlash (moliya)
  r(WRITE, /\/payroll\/advance-approvals(\/|$)/, "finance.avans.approve"),
  r(READ, /\/payroll\/advance-approvals(\/|$)/, "finance.avans.view", "finance.avans.approve"),

  // Avans limitlari
  r(WRITE, /\/payroll\/advance-limits(\/|$)/, "staff.avans_limity.update"),
  r(DEL, /\/payroll\/advance-limits(\/|$)/, "staff.avans_limity.update"),
  r(READ, /\/payroll\/advance-limits(\/|$)/, "staff.avans_limity.view", "staff.avans.view"),

  // Avans (rahbar)
  r(WRITE, /\/payroll\/advances\/import$/, "staff.avans.import"),
  r(WRITE, /\/payroll\/advances\/(send|cancel)$/, "staff.avans.status"),
  r(["POST"], /\/payroll\/advances$/, "staff.avans.create"),
  r(["PUT", "PATCH"], /\/payroll\/advances\/[^/]+$/, "staff.avans.update"),
  r(DEL, /\/payroll\/advances\/[^/]+$/, "staff.avans.delete"),
  r(READ, /\/payroll\/advances(\/|$)/, "staff.avans.view"),

  // Oylik varag'i: status / davr
  r(WRITE, /\/payroll\/records\/(confirm|reject)$/, "staff.zarplaty.approve"),
  r(WRITE, /\/payroll\/records\/(submit|reopen)$/, "staff.zarplaty.status", "staff.zarplaty.approve"),
  r(WRITE, /\/payroll\/periods\/[^/]+\/(close|reopen)$/, "staff.zarplaty.approve"),
  r(WRITE, /\/payroll\/records\/transfer$/, "staff.zarplaty.copy", "staff.zarplaty.update"),
  r(WRITE, /\/payroll\/compare\/[^/]+\/sign-off$/, "staff.zarplaty.import", "staff.zarplaty.approve"),
  r(WRITE, /\/payroll\/(import|compare)(\/|$)/, "staff.zarplaty.import"),
  r(WRITE, /\/payroll\/bonus-assignments(\/|$)/, "staff.zarplaty.assign"),
  r(DEL, /\/payroll\/bonus-assignments(\/|$)/, "staff.zarplaty.assign"),
  r(READ, /\/payroll\/export(\/|$)/, "staff.zarplaty.copy"),

  // Sozlamalar / katalog / formulalar / okladlar / qatorlar
  r(["POST"], /\/payroll\/(items|formulas|role-configs|employee-configs)$/, "staff.zarplaty.create", "staff.zarplaty.update"),
  r(WRITE, /\/payroll\/formulas\/validate$/, "staff.zarplaty.view"),
  r(WRITE, /\/payroll(\/|$)/, "staff.zarplaty.update"),
  r(DEL, /\/payroll(\/|$)/, "staff.zarplaty.delete"),
  r(READ, /\/payroll(\/|$)/, "staff.zarplaty.view")
];
