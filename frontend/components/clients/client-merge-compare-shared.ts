import type { ClientMapPoint } from "@/components/clients/clients-leaflet-map";
import type { ClientRow } from "@/lib/client-types";

/** API `ClientDedupePreviewDto` — duplicate-candidates / merge overlay */
export type ClientDedupePreview = {
  id: number;
  name: string;
  legal_name: string | null;
  phone: string | null;
  inn: string | null;
  client_pinfl: string | null;
  contract_number: string | null;
  address: string | null;
  zone: string | null;
  region: string | null;
  city: string | null;
  category: string | null;
  landmark: string | null;
  client_code: string | null;
  is_active: boolean;
  latitude: string | null;
  longitude: string | null;
  updated_at: string;
  balance: string | null;
  sales_channel: string | null;
  client_format: string | null;
  client_type_code: string | null;
  responsible_person: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_mfo: string | null;
  oked: string | null;
  vat_reg_code: string | null;
  notes: string | null;
  credit_limit: string | null;
  product_category_ref: string | null;
  contact_summary: string | null;
  orders_total: number;
  orders_open: number;
  orders_cancelled: number;
  orders_bonus_sum: string | null;
  equipment_count: number;
  team_lines: string[];
};

export type MergeDuplicateGroup = {
  reason: "phone" | "name" | "geo";
  score: number;
  key: string;
  client_ids: number[];
  count: number;
  previews: ClientDedupePreview[];
};

export type MergePreviewStats = {
  orders_to_reassign: number;
  payments_to_reassign: number;
  sales_returns_to_reassign: number;
  equipment_to_reassign: number;
  photo_reports_to_reassign: number;
  qr_codes_to_reassign: number;
  visits_to_reassign: number;
  opening_balances_to_reassign: number;
  total_balance_before: string;
  expected_master_balance_after: string;
  conflict_summary: { safe: number; warning: number; critical: number };
};

export function formatRuShortDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${mi}`;
}

export function formatPinflDisplay(v: string | null | undefined): string {
  if (v == null || v.trim() === "" || v === "0") return "—";
  const t = v.replace(/\D/g, "");
  if (t.length <= 6) return v;
  return `${t.slice(0, 6)}…${t.slice(-2)}`;
}

export function dash(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t || "—";
}

export function teamPart(lines: string[] | undefined, slot: number, part: 0 | 1 | 2): string {
  const raw = lines?.[slot - 1] ?? "";
  const chunks = raw.split("|");
  return chunks[part]?.trim() || "—";
}

export function parseBalanceNumber(b: string | null | undefined): number {
  if (!b) return 0;
  const n = Number(String(b).replace(/[^\d.-]/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeCell(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export type ConflictLevel = "safe" | "warning" | "critical";

export function conflictLevelForRow(values: string[], opts?: { pinfl?: boolean }): ConflictLevel {
  if (opts?.pinfl) {
    const bad = values.some((v) => {
      const raw = v.replace(/\D/g, "");
      return raw === "0" || raw === "";
    });
    if (bad && values.length > 1) return "warning";
  }
  const meaningful = values.map(normalizeCell).filter((v) => v !== "" && v !== "—");
  if (meaningful.length <= 1) return "safe";
  const uniq = new Set(meaningful);
  if (uniq.size === 1) return "safe";
  const anyEmpty = values.some((v) => {
    const n = normalizeCell(v);
    return n === "" || n === "—";
  });
  if (anyEmpty) return "warning";
  return "critical";
}

export function cellTone(level: ConflictLevel): string {
  switch (level) {
    case "safe":
      return "border-emerald-500/25 bg-emerald-500/[0.06]";
    case "warning":
      return "border-amber-500/35 bg-amber-500/[0.08]";
    case "critical":
      return "border-red-500/40 bg-red-500/[0.08]";
    default:
      return "";
  }
}

export function territoryLabel(p: ClientDedupePreview): string {
  const parts = [p.region, p.zone, p.city].map((x) => (x ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

export function mergePreviewToMapPoint(p: ClientDedupePreview): ClientMapPoint | null {
  const lat = Number(String(p.latitude ?? "").replace(/,/g, ".").replace(/\s/g, ""));
  const lon = Number(String(p.longitude ?? "").replace(/,/g, ".").replace(/\s/g, ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const row: ClientRow = {
    id: p.id,
    name: p.name,
    legal_name: p.legal_name,
    phone: p.phone,
    address: p.address,
    category: p.category,
    client_type_code: p.client_type_code,
    credit_limit: p.credit_limit ?? "0",
    is_active: p.is_active,
    account_balance: p.balance ?? "0",
    responsible_person: p.responsible_person,
    landmark: p.landmark,
    inn: p.inn,
    pdl: null,
    logistics_service: null,
    license_until: null,
    working_hours: null,
    region: p.region,
    district: null,
    city: p.city,
    neighborhood: null,
    street: null,
    house_number: null,
    apartment: null,
    gps_text: null,
    visit_date: null,
    notes: p.notes,
    client_format: p.client_format,
    client_code: p.client_code,
    sales_channel: p.sales_channel,
    product_category_ref: p.product_category_ref,
    bank_name: p.bank_name,
    bank_account: p.bank_account,
    bank_mfo: p.bank_mfo,
    client_pinfl: p.client_pinfl,
    oked: p.oked,
    contract_number: p.contract_number,
    vat_reg_code: p.vat_reg_code,
    latitude: p.latitude,
    longitude: p.longitude,
    zone: p.zone,
    agent_id: null,
    agent_name: null,
    agent_assignments: [],
    contact_persons: [],
    created_at: p.updated_at
  };
  return { ...row, lat, lon };
}

export function recommendedMasterId(previews: ClientDedupePreview[]): number | null {
  if (!previews.length) return null;
  const scored = previews.map((p) => {
    let s = 0;
    if (p.is_active) s += 1000;
    s += (p.orders_total ?? 0) * 3;
    s += Math.min((p.orders_open ?? 0) * 2, 80);
    const bal = parseBalanceNumber(p.balance);
    if (bal < 0) s += 40;
    s += new Date(p.updated_at).getTime() / 1e11;
    return { id: p.id, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0]?.id ?? null;
}

export type RowGetter = (p: ClientDedupePreview) => string;

export type MergeFieldDef = {
  key: string;
  label: string;
  get: RowGetter;
  pinfl?: boolean;
  variant?: "plain" | "input" | "dropdown" | "currency" | "stat";
  statIcon?: "orders" | "unfinished" | "cancel" | "bonus" | "equipment" | "code" | "date";
  indent?: boolean;
  dot?: boolean;
  copy?: boolean;
};

export type MergeSectionDef = {
  id: string;
  label: string;
  expandable: boolean;
  isBalance?: boolean;
  fields: MergeFieldDef[];
};

export function buildMergeSections(): MergeSectionDef[] {
  return [
    {
      id: "identity",
      label: "ID клиента",
      expandable: false,
      fields: [{ key: "id", label: "ID клиента", get: (p) => `#${p.id}`, dot: true }]
    },
    {
      id: "balance",
      label: "Баланс",
      expandable: true,
      isBalance: true,
      fields: [
        {
          key: "naqd",
          label: "Наличные",
          get: () => "0 UZS",
          variant: "currency",
          indent: true
        },
        {
          key: "eski",
          label: "Доход от старых долгов",
          get: () => "0 UZS",
          variant: "currency",
          indent: true
        },
        {
          key: "pereches",
          label: "Банковский перевод",
          get: () => "0 UZS",
          variant: "currency",
          indent: true
        },
        {
          key: "terminal",
          label: "Терминал",
          get: (p) => p.balance ?? "0 UZS",
          variant: "currency",
          indent: true
        }
      ]
    },
    {
      id: "main",
      label: "Основные",
      expandable: false,
      fields: [
        { key: "name", label: "Названия", get: (p) => p.name, variant: "input", dot: true },
        { key: "legal", label: "Юридическое название", get: (p) => dash(p.legal_name), variant: "input", dot: true },
        { key: "phone", label: "Телефон", get: (p) => dash(p.phone), variant: "input", dot: true, copy: true },
        {
          key: "status",
          label: "Статус",
          get: (p) => (p.is_active ? "Активный" : "Не активный"),
          variant: "dropdown",
          dot: true
        },
        { key: "inn", label: "ИНН", get: (p) => dash(p.inn), variant: "input", dot: true, copy: true },
        {
          key: "pinfl",
          label: "ПИНФЛ",
          get: (p) => formatPinflDisplay(p.client_pinfl),
          variant: "input",
          pinfl: true,
          dot: true
        },
        { key: "cat", label: "Категория", get: (p) => dash(p.category), variant: "dropdown", dot: true },
        { key: "addr", label: "Адрес", get: (p) => dash(p.address), variant: "input", dot: true },
        { key: "terr", label: "Территория", get: territoryLabel, variant: "dropdown", dot: true },
        { key: "lm", label: "Ориентир", get: (p) => dash(p.landmark), variant: "input", dot: true }
      ]
    },
    {
      id: "requisites",
      label: "Реквизиты",
      expandable: true,
      fields: [
        { key: "contract", label: "Номер договора", get: (p) => dash(p.contract_number), variant: "input", indent: true },
        { key: "pc", label: "P/C", get: (p) => dash(p.bank_account), variant: "input", indent: true },
        { key: "bank", label: "Банк", get: (p) => dash(p.bank_name), variant: "input", indent: true },
        { key: "mfo", label: "МФО", get: (p) => dash(p.bank_mfo), variant: "input", indent: true },
        { key: "oked", label: "ОКЭД", get: (p) => dash(p.oked), variant: "input", indent: true },
        { key: "vat", label: "Регистрационный ко...", get: (p) => dash(p.vat_reg_code), variant: "input", indent: true }
      ]
    },
    {
      id: "extra",
      label: "Доп. информация",
      expandable: true,
      fields: [
        { key: "ctype", label: "Тип", get: (p) => dash(p.client_type_code), variant: "dropdown", indent: true },
        { key: "channel", label: "Канал продаж", get: (p) => dash(p.sales_channel), variant: "dropdown", indent: true },
        { key: "fmt", label: "Формат клиента", get: (p) => dash(p.client_format), variant: "dropdown", indent: true },
        { key: "resp", label: "Контактное лицо", get: (p) => dash(p.responsible_person), variant: "input", indent: true },
        { key: "notes", label: "Доп. информация", get: (p) => dash(p.notes), variant: "input", indent: true }
      ]
    },
    {
      id: "stats",
      label: "Статистика",
      expandable: true,
      fields: [
        {
          key: "ot",
          label: "Кол. заказов",
          get: (p) => String(p.orders_total ?? 0),
          variant: "stat",
          statIcon: "orders",
          indent: true
        },
        {
          key: "oo",
          label: "Кол. незавершенных ...",
          get: (p) => String(p.orders_open ?? 0),
          variant: "stat",
          statIcon: "unfinished",
          indent: true
        },
        {
          key: "oc",
          label: "Кол. отказов",
          get: (p) => String(p.orders_cancelled ?? 0),
          variant: "stat",
          statIcon: "cancel",
          indent: true
        },
        {
          key: "bonus",
          label: "Бонус",
          get: (p) => dash(p.orders_bonus_sum),
          variant: "stat",
          statIcon: "bonus",
          indent: true
        },
        {
          key: "eq",
          label: "Оборудование",
          get: (p) => String(p.equipment_count ?? 0),
          variant: "stat",
          statIcon: "equipment",
          indent: true
        },
        { key: "code", label: "Код", get: (p) => dash(p.client_code), variant: "stat", statIcon: "code" },
        {
          key: "upd",
          label: "Дата последнего измене...",
          get: (p) => formatRuShortDateTime(p.updated_at),
          variant: "stat",
          statIcon: "date"
        }
      ]
    }
  ];
}
