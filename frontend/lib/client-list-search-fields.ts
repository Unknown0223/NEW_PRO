import { CLIENT_TABLE_COLUMNS } from "@/lib/client-table-columns";

/** Jadval ustunlari bo‘yicha qidiruv — backend `buildClientListSearchOrClause` bilan mos */
export type ClientListSearchableField = {
  columnId: string;
  label: string;
};

const SEARCHABLE_COLUMN_IDS: string[] = [
  "name",
  "client_ref",
  "legal_name",
  "address",
  "phone",
  "agent_assignments_badge",
  "visit_weekdays_badge",
  "expeditor_assignments_badge",
  "contact_person",
  "landmark",
  "inn",
  "pinfl",
  "trade_channel_code",
  "client_category_code",
  "client_type_code",
  "format_code",
  "client_region",
  "client_district",
  "client_zone",
  "city_code"
];

const labelById = new Map(CLIENT_TABLE_COLUMNS.map((c) => [c.id, c.label]));

export const CLIENT_LIST_SEARCHABLE_FIELDS: ClientListSearchableField[] = SEARCHABLE_COLUMN_IDS.map(
  (columnId) => ({
    columnId,
    label: labelById.get(columnId) ?? columnId
  })
);

export function clientListSearchPlaceholder(): string {
  const sample = CLIENT_LIST_SEARCHABLE_FIELDS.slice(0, 4).map((f) => f.label);
  return `Поиск: ${sample.join(", ")}…`;
}
