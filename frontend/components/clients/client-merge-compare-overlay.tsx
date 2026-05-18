"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClientMapPoint } from "@/components/clients/clients-leaflet-map";
import type { ClientRow } from "@/lib/client-types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, ChevronLeft, Loader2, Maximize2, Minimize2, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

/** Яндекс-карта; при ошибке ключа / сети внутри компонента показывается OSM-fallback */
const MergeCompareClientsMap = dynamic(
  () => import("@/components/clients/clients-leaflet-map").then((mod) => ({ default: mod.ClientsLeafletMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-border/50 bg-muted/20 text-sm text-muted-foreground">
        Карта…
      </div>
    )
  }
);

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

function formatRuShortDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

function formatPinflDisplay(v: string | null | undefined): string {
  if (v == null || v.trim() === "" || v === "0") return "—";
  const t = v.replace(/\D/g, "");
  if (t.length <= 6) return v;
  return `${t.slice(0, 6)}…${t.slice(-2)}`;
}

function dash(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t || "—";
}

function teamPart(lines: string[] | undefined, slot: number, part: 0 | 1 | 2): string {
  const raw = lines?.[slot - 1] ?? "";
  const chunks = raw.split("|");
  return chunks[part]?.trim() || "—";
}

function parseBalanceNumber(b: string | null | undefined): number {
  if (!b) return 0;
  const n = Number(String(b).replace(/[^\d.-]/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeCell(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

type ConflictLevel = "safe" | "warning" | "critical";

function conflictLevelForRow(values: string[], opts?: { pinfl?: boolean }): ConflictLevel {
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

/** Barcha ustunlarda sarlavha / qator balandligi bir xil bo‘lishi uchun */
const MERGE_CARD_HEADER_ROW = "flex h-10 min-h-10 shrink-0 items-center gap-1 border-b px-2";
const MERGE_SECTION_ROW_BASE = "flex min-h-8 shrink-0 items-center border-b py-1";
const MERGE_LABEL_FIELD_ROW = "flex h-[2.35rem] shrink-0 items-center border-b border-border/40 px-1 text-xs leading-tight";

function cellTone(level: ConflictLevel): string {
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

type RowGetter = (p: ClientDedupePreview) => string;

type FieldRow = { kind: "field"; key: string; label: string; get: RowGetter; pinfl?: boolean };
type SectionRow = { kind: "section"; id: string; title: string };
type FlatRow = SectionRow | FieldRow;

function buildFlatRows(): FlatRow[] {
  const gps: RowGetter = (p) => {
    if (p.latitude && p.longitude) return `${p.latitude}, ${p.longitude}`;
    return "—";
  };
  return [
    { kind: "section", id: "identity", title: "Идентификация" },
    { kind: "field", key: "id", label: "ID клиента", get: (p) => `#${p.id}` },
    { kind: "field", key: "name", label: "Название", get: (p) => p.name },
    { kind: "field", key: "legal", label: "Юридическое название", get: (p) => dash(p.legal_name) },
    { kind: "field", key: "phone", label: "Телефон", get: (p) => dash(p.phone) },
    {
      kind: "field",
      key: "status",
      label: "Статус",
      get: (p) => (p.is_active ? "Активный" : "Не активный")
    },
    { kind: "field", key: "code", label: "Код", get: (p) => dash(p.client_code) },
    { kind: "field", key: "cat", label: "Категория", get: (p) => dash(p.category) },

    { kind: "section", id: "financial", title: "Финансы" },
    { kind: "field", key: "bal", label: "Баланс", get: (p) => p.balance ?? "0 UZS" },
    { kind: "field", key: "credit", label: "Кредитный лимит", get: (p) => dash(p.credit_limit) },

    { kind: "section", id: "legal", title: "Налоговые данные" },
    { kind: "field", key: "inn", label: "ИНН", get: (p) => dash(p.inn) },
    { kind: "field", key: "pinfl", label: "ПИНФЛ", get: (p) => formatPinflDisplay(p.client_pinfl), pinfl: true },

    { kind: "section", id: "requisites", title: "Реквизиты и договор" },
    { kind: "field", key: "contract", label: "Номер договора", get: (p) => dash(p.contract_number) },
    { kind: "field", key: "pc", label: "Р/с", get: (p) => dash(p.bank_account) },
    { kind: "field", key: "bank", label: "Банк", get: (p) => dash(p.bank_name) },
    { kind: "field", key: "mfo", label: "МФО", get: (p) => dash(p.bank_mfo) },
    { kind: "field", key: "oked", label: "ОКЭД", get: (p) => dash(p.oked) },
    { kind: "field", key: "vat", label: "Рег. код плательщика НДС", get: (p) => dash(p.vat_reg_code) },

    { kind: "section", id: "sales", title: "Канал и формат" },
    { kind: "field", key: "channel", label: "Канал продаж", get: (p) => dash(p.sales_channel) },
    { kind: "field", key: "fmt", label: "Формат клиента", get: (p) => dash(p.client_format) },
    { kind: "field", key: "ctype", label: "Тип клиента", get: (p) => dash(p.client_type_code) },
    { kind: "field", key: "pcat", label: "Категория продукта", get: (p) => dash(p.product_category_ref) },

    { kind: "section", id: "stats", title: "Статистика" },
    { kind: "field", key: "ot", label: "Кол. заказов", get: (p) => String(p.orders_total ?? 0) },
    { kind: "field", key: "oo", label: "Незавершённые заказы", get: (p) => String(p.orders_open ?? 0) },
    { kind: "field", key: "oc", label: "Отказы (отменено)", get: (p) => String(p.orders_cancelled ?? 0) },
    { kind: "field", key: "bonus", label: "Бонусы в заказах", get: (p) => dash(p.orders_bonus_sum) },
    { kind: "field", key: "eq", label: "Оборудование (активно)", get: (p) => String(p.equipment_count ?? 0) },

    { kind: "section", id: "territory", title: "Территория и адрес" },
    { kind: "field", key: "reg", label: "Область", get: (p) => dash(p.region) },
    { kind: "field", key: "zn", label: "Зона", get: (p) => dash(p.zone) },
    { kind: "field", key: "ct", label: "Город", get: (p) => dash(p.city) },
    { kind: "field", key: "addr", label: "Адрес", get: (p) => dash(p.address) },
    { kind: "field", key: "lm", label: "Ориентир", get: (p) => dash(p.landmark) },

    { kind: "section", id: "contact", title: "Контакты" },
    { kind: "field", key: "resp", label: "Ответственное лицо", get: (p) => dash(p.responsible_person) },
    { kind: "field", key: "cps", label: "Контактные лица (JSON)", get: (p) => dash(p.contact_summary) },

    { kind: "section", id: "extra", title: "Дополнительно" },
    { kind: "field", key: "notes", label: "Доп. информация", get: (p) => dash(p.notes) },
    {
      kind: "field",
      key: "upd",
      label: "Дата последнего изменения",
      get: (p) => formatRuShortDateTime(p.updated_at)
    },
    { kind: "section", id: "commands", title: "Команды" },
    { kind: "field", key: "team_1", label: "Название команды", get: (p) => teamPart(p.team_lines, 1, 0) },
    { kind: "field", key: "agent_1", label: "Агент", get: (p) => teamPart(p.team_lines, 1, 1) },
    { kind: "field", key: "exp_1", label: "Экспедитор", get: (p) => teamPart(p.team_lines, 1, 2) },
    { kind: "field", key: "team_2", label: "Название команды", get: (p) => teamPart(p.team_lines, 2, 0) },
    { kind: "field", key: "agent_2", label: "Агент", get: (p) => teamPart(p.team_lines, 2, 1) },
    { kind: "field", key: "exp_2", label: "Экспедитор", get: (p) => teamPart(p.team_lines, 2, 2) },
    { kind: "field", key: "team_3", label: "Название команды", get: (p) => teamPart(p.team_lines, 3, 0) },
    { kind: "field", key: "agent_3", label: "Агент", get: (p) => teamPart(p.team_lines, 3, 1) },
    { kind: "field", key: "exp_3", label: "Экспедитор", get: (p) => teamPart(p.team_lines, 3, 2) },
    { kind: "field", key: "team_4", label: "Название команды", get: (p) => teamPart(p.team_lines, 4, 0) },
    { kind: "field", key: "agent_4", label: "Агент", get: (p) => teamPart(p.team_lines, 4, 1) },
    { kind: "field", key: "exp_4", label: "Экспедитор", get: (p) => teamPart(p.team_lines, 4, 2) },
    { kind: "field", key: "team_5", label: "Название команды", get: (p) => teamPart(p.team_lines, 5, 0) },
    { kind: "field", key: "agent_5", label: "Агент", get: (p) => teamPart(p.team_lines, 5, 1) },
    { kind: "field", key: "exp_5", label: "Экспедитор", get: (p) => teamPart(p.team_lines, 5, 2) },

    { kind: "section", id: "location", title: "Локация" },
    { kind: "field", key: "gps", label: "Координаты", get: gps }
  ];
}

function mergePreviewToMapPoint(p: ClientDedupePreview): ClientMapPoint | null {
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

function recommendedMasterId(previews: ClientDedupePreview[]): number | null {
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

export function CompareMergeOverlay(props: {
  group: MergeDuplicateGroup;
  masterId: number | null;
  setMasterId: (id: number) => void;
  onClose: () => void;
  onMerge: () => void;
  onSave: () => void;
  merging: boolean;
  saving: boolean;
  mergePreview: MergePreviewStats | null;
  mergePreviewLoading: boolean;
}) {
  const {
    group,
    masterId,
    setMasterId,
    onClose,
    onMerge,
    onSave,
    merging,
    saving,
    mergePreview,
    mergePreviewLoading
  } = props;
  const flatRows = useMemo(() => buildFlatRows(), []);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const sectionOfField = useMemo(() => {
    const m = new Map<string, string>();
    let current = "";
    for (const r of flatRows) {
      if (r.kind === "section") current = r.id;
      else m.set(r.key, current);
    }
    return m;
  }, [flatRows]);
  const masterPreview = useMemo(
    () => group.previews.find((p) => p.id === masterId) ?? null,
    [group.previews, masterId]
  );
  const suggestedId = useMemo(() => recommendedMasterId(group.previews), [group.previews]);
  const sidePreviews = useMemo(
    () => group.previews.filter((p) => p.id !== masterId),
    [group.previews, masterId]
  );
  const sectionIds = useMemo(
    () => flatRows.filter((r): r is SectionRow => r.kind === "section").map((r) => r.id),
    [flatRows]
  );
  const mapPoints = useMemo(
    () =>
      group.previews
        .map((p) => mergePreviewToMapPoint(p))
        .filter((x): x is ClientMapPoint => x != null),
    [group.previews]
  );

  const expandAllSections = () => setCollapsedSections({});
  const collapseAllSections = () => setCollapsedSections(Object.fromEntries(sectionIds.map((id) => [id, true])));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:left-[15.5rem]">
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">Объединение — расширенная панель</h2>
            <p className="truncate text-xs text-muted-foreground">
              Сравнение реквизитов, финансов и статистики перед слиянием
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onSave} disabled={saving || masterId == null}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить группу"}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={merging || masterId == null}
            onClick={onMerge}
          >
            {merging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Объединить
          </Button>
        </div>
      </header>

      {suggestedId != null && masterId !== suggestedId ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Рекомендуемый мастер по активности, заказам и дате обновления:{" "}
              <span className="font-mono font-semibold">#{suggestedId}</span>
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setMasterId(suggestedId)}>
            Выбрать #{suggestedId}
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <div className="flex min-h-min flex-col bg-background">
          <div className="flex min-h-min items-stretch">
            <div className="flex shrink-0 overflow-hidden rounded-xl border border-border bg-muted/10 shadow-sm">
              <div className="w-52 shrink-0 border-r border-border/70 bg-background p-2 text-xs leading-tight text-muted-foreground">
                <div
                  className={cn(
                    MERGE_CARD_HEADER_ROW,
                    "gap-1 border-b border-border/60 bg-muted/30 px-1 dark:bg-muted/20"
                  )}
                  role="toolbar"
                  aria-label="Секции: развернуть или свернуть все"
                >
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 min-h-0 flex-1 gap-1 rounded-md border border-teal-600/20 bg-teal-600/10 px-1.5 text-[11px] font-semibold leading-none text-teal-900 shadow-sm hover:bg-teal-600/15 dark:border-teal-400/25 dark:bg-teal-500/15 dark:text-teal-50 dark:hover:bg-teal-500/25"
                    onClick={expandAllSections}
                  >
                    <Maximize2 className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                    <span className="truncate">Развернуть</span>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 min-h-0 flex-1 gap-1 rounded-md border border-border/70 bg-background/90 px-1.5 text-[11px] font-semibold leading-none text-foreground shadow-sm hover:bg-muted dark:hover:bg-muted/80"
                    onClick={collapseAllSections}
                  >
                    <Minimize2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">Свернуть</span>
                  </Button>
                </div>
                {flatRows.map((row) =>
                  row.kind === "section" ? (
                    <button
                      key={`s-${row.id}`}
                      type="button"
                      className={cn(
                        MERGE_SECTION_ROW_BASE,
                        "w-full cursor-pointer border-border/50 bg-muted/50 pl-1 text-left font-semibold uppercase tracking-wide text-[10px] text-foreground/80 transition-colors duration-150 hover:bg-muted/70"
                      )}
                      aria-expanded={!collapsedSections[row.id]}
                      onClick={() => setCollapsedSections((s) => ({ ...s, [row.id]: !s[row.id] }))}
                    >
                      {collapsedSections[row.id] ? "▸ " : "▾ "}
                      {row.title}
                    </button>
                  ) : (
                    !collapsedSections[sectionOfField.get(row.key) ?? ""] && (
                      <div key={`f-${row.key}`} className={MERGE_LABEL_FIELD_ROW}>
                        {row.label}
                      </div>
                    )
                  )
                )}
              </div>
              <div className="w-[300px] shrink-0 bg-background p-2 text-center text-xs text-muted-foreground">
                <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                  <div className={cn(MERGE_CARD_HEADER_ROW, "justify-between text-left")}>
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                      {masterPreview ? <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : null}
                      Мастер
                    </span>
                    {masterPreview ? (
                      <span className="shrink-0 font-mono text-xs font-normal text-muted-foreground">
                        #{masterPreview.id}
                      </span>
                    ) : null}
                  </div>
                  {masterPreview ? (
                    <div className="space-y-0 px-2 pb-2 pt-0 text-sm">
                      {flatRows.map((row) =>
                        row.kind === "section" ? (
                          <div key={`ms-${row.id}`} className={cn(MERGE_SECTION_ROW_BASE, "border-transparent")} />
                        ) : (
                          !collapsedSections[sectionOfField.get(row.key) ?? ""] && (
                            <PreviewCell
                              key={`m-${row.key}`}
                              row={row}
                              preview={masterPreview}
                              allPreviews={group.previews}
                            />
                          )
                        )
                      )}
                    </div>
                  ) : (
                    <div className="flex h-[calc(100vh-20rem)] min-h-40 items-center justify-center border-t bg-muted/20 px-3 text-center text-sm text-muted-foreground">
                      Выберите один объект
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-visible overscroll-x-contain p-2">
              <div className="flex w-max gap-3">
                {sidePreviews.map((p) => {
                  return (
                    <div
                      key={p.id}
                      className={cn("w-[min(100%,300px)] shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm")}
                    >
                      <div className={cn(MERGE_CARD_HEADER_ROW, "justify-between text-left")}>
                        <span className="font-mono text-sm font-semibold">#{p.id}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 text-xs"
                          onClick={() => setMasterId(p.id)}
                        >
                          Сделать мастером
                        </Button>
                      </div>
                      <div className="space-y-0 px-2 pb-2 pt-0 text-sm">
                        {flatRows.map((row) =>
                          row.kind === "section" ? (
                            <div
                              key={`${p.id}-s-${row.id}`}
                              className={cn(MERGE_SECTION_ROW_BASE, "border-transparent")}
                            />
                          ) : (
                            !collapsedSections[sectionOfField.get(row.key) ?? ""] && (
                              <PreviewCell
                                key={`${p.id}-${row.key}`}
                                row={row}
                                preview={p}
                                allPreviews={group.previews}
                              />
                            )
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!collapsedSections["location"] ? (
            <div className="shrink-0 border-t border-border/80 bg-muted/10 p-2">
              {mapPoints.length > 0 ? (
                <MergeCompareClientsMap
                  clients={mapPoints}
                  selectedClientId={masterId}
                  heightPx={320}
                />
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 px-3 text-center text-sm text-muted-foreground">
                  Нет валидных координат у клиентов группы — строка «Координаты» в секции «Локация» будет пустой.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 space-y-1 border-t bg-destructive/5 px-3 py-2">
        <div className="rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
          {mergePreviewLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Расчёт preview…
            </span>
          ) : mergePreview ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Заказы: {mergePreview.orders_to_reassign}</span>
              <span>Платежи: {mergePreview.payments_to_reassign}</span>
              <span>QR: {mergePreview.qr_codes_to_reassign}</span>
              <span>Оборудование: {mergePreview.equipment_to_reassign}</span>
              <span>Баланс после merge: {mergePreview.expected_master_balance_after}</span>
              <span>
                Конфликты: {mergePreview.conflict_summary.critical} крит., {mergePreview.conflict_summary.warning} вним.
              </span>
            </div>
          ) : (
            <span>Preview недоступен.</span>
          )}
        </div>
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Проверьте баланс, договор, банковские реквизиты и расхождения (подсветка: зелёный — совпадение, жёлтый —
            частично заполнено, красный — конфликт). Операция переносит заказы, платежи, QR-коды и привязку
            оборудования на мастера. Отмена невозможна.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500/80" /> без конфликта
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500/80" /> внимание
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500/80" /> конфликт
          </span>
        </div>
      </div>
    </div>
  );
}

function PreviewCell(props: {
  row: FieldRow;
  preview: ClientDedupePreview;
  allPreviews: ClientDedupePreview[];
}) {
  const { row, preview, allPreviews } = props;
  const text = row.get(preview);
  const values = allPreviews.map((x) => row.get(x));
  const level = conflictLevelForRow(values, { pinfl: row.pinfl });
  const balNum = row.key === "bal" ? parseBalanceNumber(text) : 0;
  const balanceTextClass =
    row.key === "bal"
      ? balNum < 0
        ? "font-semibold tabular-nums text-red-700 dark:text-red-300"
        : balNum > 0
          ? "font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
          : "font-medium tabular-nums text-muted-foreground"
      : "";

  const inner =
    row.key === "status" ? (
      <Badge variant={preview.is_active ? "success" : "secondary"} className="max-w-full truncate">
        {preview.is_active ? "Активный" : "Не активный"}
      </Badge>
    ) : (
      <span
        className={cn(
          "block truncate whitespace-nowrap text-foreground",
          row.key === "id" && "font-mono text-[11px]",
          row.key === "name" && "text-[11px] font-semibold uppercase tracking-tight",
          (row.key === "inn" || row.key === "pinfl") && "font-mono text-[11px]",
          (row.key === "ot" || row.key === "oo" || row.key === "oc" || row.key === "eq") &&
            "text-sm font-semibold tabular-nums tracking-tight",
          balanceTextClass
        )}
      >
        {text}
      </span>
    );

  return (
    <div
      className={cn(
        "flex h-[2.35rem] items-center overflow-hidden rounded-md border px-1.5 py-0 text-xs leading-snug",
        cellTone(level),
        row.key === "status" && "justify-center"
      )}
    >
      {inner}
    </div>
  );
}
