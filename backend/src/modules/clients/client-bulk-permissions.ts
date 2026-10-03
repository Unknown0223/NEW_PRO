/**
 * Ommaviy tahrir (`PATCH /clients/bulk`, `/clients/bulk-items`) — har bir maydon guruhi alohida ruxsat bilan.
 * «Назначение визитов на карте» (`clients.vizity.update`) agent/kun/ekspeditor, zona, ombor va kassani o'zgartira oladi.
 * Ro'yxatda yo'q maydonlar oddiy tahrir (`clients.klient.update`) hisoblanadi.
 */

export const CLIENT_GROUP_TAGS_PERMISSION = "clients.gr_tegi.update";
const VISIT_PLANNER_UPDATE = "clients.vizity.update";
const CLIENT_UPDATE = "clients.klient.update";

type FieldGroup = { fields: readonly string[]; anyOf: readonly string[] };

const FIELD_GROUPS: readonly FieldGroup[] = [
  { fields: ["agent_id", "agent_assignments", "visit_date"], anyOf: ["clients.gr_komanda.update", VISIT_PLANNER_UPDATE] },
  { fields: ["zone"], anyOf: ["clients.gr_territoriya.update", VISIT_PLANNER_UPDATE] },
  { fields: ["region", "district", "city", "neighborhood"], anyOf: ["clients.gr_territoriya.update"] },
  { fields: ["category"], anyOf: ["clients.gr_kategoriya.update"] },
  { fields: ["client_type_code", "client_format"], anyOf: ["clients.gr_tip_format.update"] },
  { fields: ["sales_channel"], anyOf: ["clients.gr_kanal.update"] },
  { fields: ["warehouse_id", "cash_desk_id"], anyOf: ["clients.gr_sklad_kassa.update", VISIT_PLANNER_UPDATE] },
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

/** Route guard uchun: ommaviy tahrirga kirish uchun kamida bittasi kerak. */
export const CLIENT_BULK_PATCH_PERMISSIONS: readonly string[] = [
  ...new Set([...FIELD_GROUPS.flatMap((g) => g.anyOf), "clients.klient.activate", "clients.klient.deactivate", CLIENT_UPDATE])
];

/** Patchlardagi maydonlar uchun yetishmayotgan ruxsatlar (har guruhdan birinchi kalit). */
export function missingClientBulkPermissions(
  patches: readonly Record<string, unknown>[],
  has: (key: string) => boolean
): string[] {
  const missing = new Set<string>();
  for (const patch of patches) {
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined) continue;
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
