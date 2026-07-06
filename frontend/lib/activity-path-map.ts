/**
 * Frontend route (pathname) → backend modul/bo'lim/entity moslovi.
 * Faqat asosiy modullar kuzatiladi (backend `ACTIVITY_MODULES` bilan mos).
 * Mos kelmasa `null` qaytadi — bunday sahifalar kuzatilmaydi.
 */

export type ActivityPathInfo = {
  module: string;
  section: string;
  entityType?: string;
  entityId?: string;
};

type Rule = {
  /** Birinchi yo'l segmenti(lar)i. */
  match: string[];
  module: string;
  section: string;
  /** Numerik id bo'lsa shu entity tipi bilan bog'lanadi. */
  entityType?: string;
};

const RULES: Rule[] = [
  { match: ["orders"], module: "orders", section: "zakaz", entityType: "order" },
  { match: ["returns"], module: "orders", section: "vozvrat", entityType: "sales_return" },
  { match: ["clients"], module: "clients", section: "klient", entityType: "client" },
  { match: ["staff", "users"], module: "staff", section: "agent", entityType: "user" },
  { match: ["payments", "cash-desks", "expenses", "cash"], module: "cash", section: "oplaty_klientov", entityType: "payment" },
  {
    match: ["stock", "warehouses", "goods-receipts", "warehouse-transfers", "stock-takes", "warehouse-blocks"],
    module: "warehouse",
    section: "ostatki",
    entityType: "warehouse"
  },
  { match: ["suppliers"], module: "suppliers", section: "postavshchik", entityType: "supplier" },
  { match: ["products"], module: "settings", section: "tovar", entityType: "product" },
  { match: ["settings"], module: "settings", section: "tovar" },
  { match: ["access"], module: "access", section: "upravlenie" },
  { match: ["dashboard"], module: "dashboard", section: "prodazhi" }
];

export function activityPathInfo(pathname: string): ActivityPathInfo | null {
  const clean = (pathname || "").split("?")[0]!.split("#")[0]!;
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) {
    return { module: "dashboard", section: "prodazhi" };
  }
  const first = segments[0]!.toLowerCase();
  const rule = RULES.find((r) => r.match.includes(first));
  if (!rule) return null;

  const info: ActivityPathInfo = { module: rule.module, section: rule.section };
  if (rule.entityType && segments[1] && /^\d+$/.test(segments[1])) {
    info.entityType = rule.entityType;
    info.entityId = segments[1];
  }
  return info;
}
