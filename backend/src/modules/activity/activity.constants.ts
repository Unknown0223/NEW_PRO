/**
 * Faoliyat (activity) kuzatuvi konstantalari.
 *
 * Kuzatuv faqat ASOSIY modullar bo'yicha yig'iladi (reja: zakazlar, mijozlar,
 * xodimlar, kassa, sklad, dostup + поставщиклар, товар). Boshqa modullardan
 * kelgan eventlar `track` da rad etiladi.
 */

export const ACTIVITY_EVENT_TYPES = [
  "page_view",
  "navigation",
  "view_intent",
  "form_open",
  "form_abandon"
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export function isActivityEventType(v: unknown): v is ActivityEventType {
  return typeof v === "string" && (ACTIVITY_EVENT_TYPES as readonly string[]).includes(v);
}

/** Kuzatuvga ruxsat berilgan modullar (oq ro'yxat). */
export const ACTIVITY_MODULES = new Set<string>([
  "orders",
  "clients",
  "staff",
  "cash",
  "warehouse",
  "access",
  "suppliers",
  "settings",
  "dashboard"
]);

export function isTrackedModule(module: unknown): module is string {
  return typeof module === "string" && ACTIVITY_MODULES.has(module);
}

/**
 * Birlashtirilgan per-entity tarix uchun entity tipi → modul/bo'lim va manbalar.
 * `permission` — `<module>.<section>.history` guard uchun.
 *
 * Diqqat: URL'dagi entity tipi (`order`, `payment`, `sales_return` ...) bilan
 * `TenantAuditEvent.entity_type` qiymati doim mos kelmaydi (masalan to'lovlar
 * `finance` deb yoziladi). Shu sabab audit/activity uchun alohida ro'yxatlar.
 */
export type EntitySource = "orderStatus" | "orderChange" | "clientAudit" | "accessLog";

export type EntityHistoryDescriptor = {
  module: string;
  section: string;
  permissionHistory: string;
  permissionView: string;
  /** TenantAuditEvent.entity_type qiymatlari (IN). */
  auditEntityTypes: string[];
  /** UserActivityEvent.entity_type qiymatlari (IN). */
  activityEntityTypes: string[];
  /** Maxsus per-entity loglar (generic TenantAuditEvent doim qo'shiladi). */
  sources: EntitySource[];
};

const desc = (
  module: string,
  section: string,
  opts: {
    audit: string[];
    activity?: string[];
    sources?: EntitySource[];
  }
): EntityHistoryDescriptor => ({
  module,
  section,
  permissionHistory: `${module}.${section}.history`,
  permissionView: `${module}.${section}.view`,
  auditEntityTypes: opts.audit,
  activityEntityTypes: opts.activity ?? opts.audit,
  sources: opts.sources ?? []
});

/** entityType (lowercase) → descriptor. */
export const ENTITY_HISTORY: Record<string, EntityHistoryDescriptor> = {
  order: desc("orders", "zakaz", { audit: ["order"], sources: ["orderStatus", "orderChange"] }),
  client: desc("clients", "klient", { audit: ["client"], sources: ["clientAudit"] }),
  user: desc("staff", "agent", { audit: ["user"], sources: ["accessLog"] }),
  staff: desc("staff", "agent", { audit: ["user"], activity: ["user", "staff"], sources: ["accessLog"] }),
  supplier: desc("suppliers", "postavshchik", { audit: ["supplier"] }),
  product: desc("settings", "tovar", { audit: ["product"] }),
  product_price: desc("settings", "tsena", { audit: ["product_price"] }),
  warehouse: desc("warehouse", "sklady", { audit: ["warehouse"] }),
  goods_receipt: desc("warehouse", "postuplenie", { audit: ["goods_receipt"] }),
  stock: desc("warehouse", "ostatki", { audit: ["stock"] }),
  // To'lovlar audit'da `finance` deb yoziladi (payment.create/update/void/restore/allocate ...).
  payment: desc("cash", "oplaty_klientov", { audit: ["finance"], activity: ["payment", "finance"] }),
  finance: desc("cash", "otchety", { audit: ["finance"] }),
  // Qaytarishlar: per-return aniq audit (`sales_return` + return id).
  sales_return: desc("orders", "vozvrat", { audit: ["sales_return"], activity: ["sales_return", "return"] }),
  return: desc("orders", "vozvrat", { audit: ["sales_return"], activity: ["sales_return", "return"] }),
  work_slot: desc("work_slots", "raboche_mesto", { audit: ["work_slot"] }),
  geo_boundary: desc("settings", "geo_granitsy", { audit: ["geo_boundary"] }),
  territory: desc("settings", "territoriya", { audit: ["territory"] }),
  expense: desc("cash", "rashody_klienta", { audit: ["finance"], activity: ["expense", "finance"] }),
  report_builder: desc("reports", "otchety", { audit: ["report_builder"] }),
  automation_rule: desc("orders", "avtomatizatsiya", { audit: ["automation_rule"] }),
  warehouse_block: desc("warehouse", "sklady", { audit: ["warehouse_block"] }),
  stock_take: desc("warehouse", "inventarizatsiya", { audit: ["stock_take"] }),
  product_brand: desc("settings", "tovar", { audit: ["product_brand"] }),
  product_manufacturer: desc("settings", "tovar", { audit: ["product_manufacturer"] }),
  product_segment: desc("settings", "tovar", { audit: ["product_segment"] }),
  product_catalog_group: desc("settings", "tovar", { audit: ["product_catalog_group"] }),
  product_category: desc("settings", "tovar", { audit: ["product_category"] }),
  interchangeable_product_group: desc("settings", "tovar", {
    audit: ["interchangeable_product_group"]
  }),
  brand: desc("settings", "tovar", { audit: ["product_brand"], activity: ["product_brand", "brand"] }),
  /** Foto soft-void — asosan ClientAudit; entity tarixi client orqali. */
  photo: desc("clients", "klient", {
    audit: ["client"],
    activity: ["photo", "client"],
    sources: ["clientAudit"]
  }),
  client_photo: desc("clients", "klient", {
    audit: ["client"],
    activity: ["photo", "client"],
    sources: ["clientAudit"]
  }),
  access: desc("access", "dostup", {
    audit: ["user", "access_bulk"],
    activity: ["user", "access"],
    sources: ["accessLog"]
  }),
  currency_rate: desc("settings", "valyuta", { audit: ["currency_rate"] })
};

export function resolveEntityHistory(entityType: string): EntityHistoryDescriptor | null {
  return ENTITY_HISTORY[entityType.toLowerCase()] ?? null;
}
