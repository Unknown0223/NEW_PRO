/**
 * Ommaviy tahrir (`PATCH /clients/bulk`, `/clients/bulk-items`) — har bir maydon guruhi alohida ruxsat bilan.
 * «Назначение визитов на карте» — har bir tugma (agent, kunlar, ekspeditor, ombor, kassa) alohida kalit.
 * Ro'yxatda yo'q maydonlar oddiy tahrir (`clients.klient.update`) hisoblanadi.
 */

export const CLIENT_GROUP_TAGS_PERMISSION = "clients.gr_tegi.update";
const CLIENT_UPDATE = "clients.klient.update";
const TEAM = "clients.gr_komanda.update";

export const VISIT_PLANNER_PERMISSIONS = {
  agent: "clients.vizity_agent.update",
  days: "clients.vizity_dni.update",
  expeditor: "clients.vizity_ekspeditor.update",
  warehouse: "clients.vizity_sklad.update",
  cashDesk: "clients.vizity_kassa.update"
} as const;
const VP = VISIT_PLANNER_PERMISSIONS;

type FieldGroup = { fields: readonly string[]; anyOf: readonly string[] };

const FIELD_GROUPS: readonly FieldGroup[] = [
  { fields: ["agent_id"], anyOf: [TEAM, VP.agent] },
  { fields: ["visit_date"], anyOf: [TEAM, VP.days] },
  // Xaritada zona tanlangan mijozlar chegarasidan avtomatik qo'yiladi.
  { fields: ["zone"], anyOf: ["clients.gr_territoriya.update", ...Object.values(VP)] },
  { fields: ["region", "district", "city", "neighborhood"], anyOf: ["clients.gr_territoriya.update"] },
  { fields: ["category"], anyOf: ["clients.gr_kategoriya.update"] },
  { fields: ["client_type_code", "client_format"], anyOf: ["clients.gr_tip_format.update"] },
  { fields: ["sales_channel"], anyOf: ["clients.gr_kanal.update"] },
  { fields: ["warehouse_id"], anyOf: ["clients.gr_sklad_kassa.update", VP.warehouse] },
  { fields: ["cash_desk_id"], anyOf: ["clients.gr_sklad_kassa.update", VP.cashDesk] },
  {
    fields: ["allow_order_with_debt", "allow_consignment", "allow_consignment_with_debt"],
    anyOf: ["clients.gr_dolg.update"]
  },
  { fields: ["product_category_ref"], anyOf: ["clients.gr_kategoriya_tovara.update"] },
  { fields: ["credit_limit"], anyOf: ["clients.gr_kredit_limit.update"] },
  { fields: ["price_type"], anyOf: ["clients.gr_tip_tseny.update"] }
];

const GROUP_BY_FIELD = new Map<string, FieldGroup>(
  FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [f, g] as const))
);

/** `agent_assignments` slot maydoni → xarita ruxsati. */
const SLOT_FIELD_PERMISSION: Record<string, string> = {
  agent_id: VP.agent,
  expeditor_user_id: VP.expeditor,
  expeditor_phone: VP.expeditor,
  visit_weekdays: VP.days,
  visit_date: VP.days
};
const SLOT_PERMISSIONS = [VP.agent, VP.days, VP.expeditor];

/** Route guard uchun: ommaviy tahrirga kirish uchun kamida bittasi kerak. */
export const CLIENT_BULK_PATCH_PERMISSIONS: readonly string[] = [
  ...new Set([
    ...FIELD_GROUPS.flatMap((g) => g.anyOf),
    TEAM,
    ...SLOT_PERMISSIONS,
    "clients.klient.activate",
    "clients.klient.deactivate",
    CLIENT_UPDATE
  ])
];

/**
 * `agent_assignments`: «Агент, дни визита и экспедитор» hammasini ochadi.
 * Merge rejimida faqat yuborilgan slot maydonlari o'zgaradi — har biri o'z kaliti bilan;
 * to'liq almashtirishda (merge'siz) agent, kunlar va ekspeditor uchala kaliti kerak.
 */
function slotPermissions(value: unknown, merge: boolean): string[] {
  if (!merge || !Array.isArray(value)) return SLOT_PERMISSIONS;
  const keys = new Set<string>();
  for (const slot of value) {
    if (!slot || typeof slot !== "object") continue;
    for (const [field, v] of Object.entries(slot as Record<string, unknown>)) {
      if (v === undefined || field === "slot") continue;
      keys.add(SLOT_FIELD_PERMISSION[field] ?? TEAM);
    }
  }
  return [...keys];
}

/** Patchlardagi maydonlar uchun yetishmayotgan ruxsatlar (har guruhdan birinchi kalit). */
export function missingClientBulkPermissions(
  patches: readonly Record<string, unknown>[],
  has: (key: string) => boolean
): string[] {
  const missing = new Set<string>();
  for (const patch of patches) {
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined || field === "agent_assignments_merge") continue;
      if (field === "agent_assignments") {
        if (has(TEAM)) continue;
        for (const key of slotPermissions(value, patch.agent_assignments_merge === true)) {
          if (!has(key)) missing.add(key);
        }
        continue;
      }
      let anyOf: readonly string[];
      if (field === "is_active") {
        anyOf = [value === false ? "clients.klient.deactivate" : "clients.klient.activate"];
      } else {
        anyOf = GROUP_BY_FIELD.get(field)?.anyOf ?? [CLIENT_UPDATE];
      }
      if (!anyOf.some(has)) missing.add(anyOf[0]);
    }
  }
  return [...missing];
}
