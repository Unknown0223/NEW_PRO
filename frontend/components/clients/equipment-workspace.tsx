"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { CalendarDays, Download, Filter, History, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type EquipmentRow = {
  id: number;
  inventory_type: string;
  equipment_kind: string | null;
  serial_number: string | null;
  inventory_number: string | null;
  assigned_at: string;
  removed_at: string | null;
  note: string | null;
  client_id: number;
  client_name: string;
  client_phone: string | null;
  client_address: string | null;
  region: string | null;
  district: string | null;
  zone: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  agent_id: number | null;
  agent_name: string | null;
};

type EquipmentListResponse = {
  data: EquipmentRow[];
  total: number;
  page: number;
  limit: number;
};

type RefsResponse = {
  region_options?: { value: string; label: string }[];
  zones?: string[];
  city_options?: { value: string; label: string }[];
  equipment_filter_values?: string[];
};

type ProductOption = { id: number; name: string; sku: string; is_active: boolean };
type ClientOption = { id: number; name: string };

const EQUIPMENT_TABLE_ID = "clients-equipment-list";
const EQUIPMENT_COLUMNS = [
  { id: "inventory_type", label: "Тип инвентаря" },
  { id: "equipment_kind", label: "Код / SKU" },
  { id: "client_name", label: "Имя клиента" },
  { id: "agent_name", label: "Агент" },
  { id: "client_phone", label: "Телефон" },
  { id: "client_address", label: "Локация" },
  { id: "territory", label: "Территория" },
  { id: "assigned_at", label: "Дата прикрепления" },
  { id: "serial_number", label: "Серийный номер" },
  { id: "note", label: "Комментарий" }
] as const;

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU");
  } catch {
    return iso;
  }
}

function exportEquipmentCsv(rows: EquipmentRow[], fileBase: string): void {
  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const head = [
    "Тип инвентаря",
    "Код / SKU",
    "Имя клиента",
    "Агент",
    "Телефон",
    "Локация",
    "Территория",
    "Дата прикрепления",
    "Серийный номер",
    "Комментарий"
  ];
  const body = rows.map((r) => [
    r.inventory_type ?? "",
    r.equipment_kind ?? "",
    r.client_name ?? "",
    r.agent_name ?? "",
    r.client_phone ?? "",
    r.client_address ?? "",
    [r.region, r.zone, r.city].filter(Boolean).join(" / "),
    fmtDate(r.assigned_at),
    r.serial_number ?? "",
    r.note ?? ""
  ]);
  const csv = [head, ...body].map((row) => row.map((x) => esc(String(x))).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EquipmentWorkspace({ view = "equipment" }: { view?: "equipment" | "history" }) {
  const isHistory = view === "history";
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [inventoryType, setInventoryType] = useState("");
  const [agentId, setAgentId] = useState("");
  const [territory1, setTerritory1] = useState("");
  const [territory2, setTerritory2] = useState("");
  const [territory3, setTerritory3] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);

  const [regionOptions, setRegionOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [zoneOptions, setZoneOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addClientId, setAddClientId] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addSerial, setAddSerial] = useState("");
  const [addInventoryNo, setAddInventoryNo] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: EQUIPMENT_TABLE_ID,
    defaultColumnOrder: EQUIPMENT_COLUMNS.map((c) => c.id),
    defaultPageSize: 30,
    allowedPageSizes: [10, 20, 30, 50, 100]
  });
  const limit = tablePrefs.pageSize;

  const agentOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) {
      if (r.agent_id && r.agent_id > 0) m.set(r.agent_id, r.agent_name?.trim() || `Agent #${r.agent_id}`);
    }
    return Array.from(m.entries())
      .map(([id, label]) => ({ id: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [rows]);
  const effectiveTypeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const t of typeOptions) {
      const v = t.trim();
      if (v) s.add(v);
    }
    for (const r of rows) {
      const a = (r.inventory_type ?? "").trim();
      if (a) s.add(a);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows, typeOptions]);

  async function load(pageArg = page) {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(pageArg));
      p.set("limit", String(limit));
      p.set("status", isHistory ? "all" : "active");
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      if (search.trim()) p.set("search", search.trim());
      if (inventoryType.trim()) p.set("inventory_type", inventoryType.trim());
      if (agentId) p.set("agent_id", agentId);
      if (territory1) p.set("territory_1", territory1);
      if (territory2) p.set("territory_2", territory2);
      if (territory3) p.set("territory_3", territory3);
      const [{ data }, { data: refs }] = await Promise.all([
        api.get<EquipmentListResponse>(`/api/${tenantSlug}/equipment?${p.toString()}`),
        api.get<RefsResponse>(`/api/${tenantSlug}/clients/references`)
      ]);
      setRows(data.data ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setPage(data.page ?? pageArg);
      setRegionOptions(refs.region_options ?? []);
      setZoneOptions(refs.zones ?? []);
      setCityOptions(refs.city_options ?? []);
      setTypeOptions(refs.equipment_filter_values ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tenantSlug) void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, limit, isHistory]);

  useEffect(() => {
    if (!tenantSlug || isHistory) return;
    void (async () => {
      try {
        const [{ data: p }, { data: c }] = await Promise.all([
          api.get<{ data: ProductOption[] }>(`/api/${tenantSlug}/products?page=1&limit=500&is_equipment=true`),
          api.get<{ data: ClientOption[] }>(`/api/${tenantSlug}/clients?page=1&limit=500&sort=name&order=asc`)
        ]);
        setProductOptions((p.data ?? []).map((x) => ({ id: x.id, name: x.name, sku: x.sku, is_active: x.is_active })));
        setClientOptions((c.data ?? []).map((x) => ({ id: x.id, name: x.name })));
      } catch {
        setProductOptions([]);
        setClientOptions([]);
      }
    })();
  }, [tenantSlug, isHistory]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const columnLabelById = useMemo(
    () => Object.fromEntries(EQUIPMENT_COLUMNS.map((c) => [c.id, c.label])),
    []
  );
  function cellByColumnId(r: EquipmentRow, colId: string): string {
    switch (colId) {
      case "inventory_type":
        return r.inventory_type ?? "";
      case "equipment_kind":
        return r.equipment_kind ?? "—";
      case "client_name":
        return r.client_name ?? "";
      case "agent_name":
        return r.agent_name ?? "—";
      case "client_phone":
        return r.client_phone ?? "—";
      case "client_address":
        return r.client_address ?? "—";
      case "territory":
        return [r.region, r.zone, r.city].filter(Boolean).join(" / ") || "—";
      case "assigned_at":
        return fmtDate(r.assigned_at);
      case "serial_number":
        return r.serial_number ?? "—";
      case "note":
        return r.note ?? "—";
      default:
        return "—";
    }
  }
  function exportEquipmentExcel(rowsForExport: EquipmentRow[], fileBase: string): void {
    const visible = tablePrefs.visibleColumnOrder;
    const headers = visible.map((id) => columnLabelById[id] ?? id);
    const dataRows = rowsForExport.map((r) => visible.map((id) => cellByColumnId(r, id)));
    downloadXlsxSheet(`${fileBase}_${new Date().toISOString().slice(0, 10)}.xlsx`, "Оборудование", headers, dataRows);
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setInventoryType("");
    setAgentId("");
    setTerritory1("");
    setTerritory2("");
    setTerritory3("");
    void load(1);
  }

  async function createManualEquipment(): Promise<void> {
    if (!tenantSlug) return;
    setAddError(null);
    const clientId = Number(addClientId);
    const productId = Number(addProductId);
    if (!Number.isFinite(clientId) || clientId <= 0) return setAddError("Клиентni tanlang.");
    if (!Number.isFinite(productId) || productId <= 0) return setAddError("Mahsulotni tanlang.");
    const p = productOptions.find((x) => x.id === productId);
    if (!p) return setAddError("Tanlangan mahsulot topilmadi.");
    setAddSaving(true);
    try {
      await api.post(`/api/${tenantSlug}/clients/${clientId}/equipment`, {
        inventory_type: p.name,
        equipment_kind: p.sku || null,
        serial_number: addSerial.trim() || null,
        inventory_number: addInventoryNo.trim() || null,
        note: addNote.trim() || null
      });
      setAddOpen(false);
      setAddClientId("");
      setAddProductId("");
      setAddSerial("");
      setAddInventoryNo("");
      setAddNote("");
      await load(1);
    } catch {
      setAddError("Saqlashda xatolik bo‘ldi.");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={isHistory ? "История перемещения оборудования" : "Оборудование"}
        description={isHistory ? "Inventory movement log, territory and serial tracking" : "Client equipment control and attachment"}
      />
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {isHistory ? "История перемещения оборудования" : "Оборудование"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={dateAnchorRef}
                type="button"
                className="inline-flex h-8 min-w-[13.5rem] items-center justify-between rounded-md border border-input bg-background px-2.5 text-xs"
                onClick={() => setDateOpen((v) => !v)}
              >
                <span className="truncate">{formatDateRangeButton(dateFrom, dateTo)}</span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              <Button
                className="h-8 bg-teal-600 px-3 text-xs text-white hover:bg-teal-700"
                onClick={() => void load(1)}
                disabled={loading}
              >
                Применить
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Агент</option>
              {agentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {effectiveTypeOptions.length > 0 ? (
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={inventoryType}
                onChange={(e) => setInventoryType(e.target.value)}
              >
                <option value="">Тип оборудования</option>
                {effectiveTypeOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="h-8 rounded-md border bg-muted/30 px-2 text-xs text-muted-foreground"
                value=""
                disabled
              >
                <option value="">Тип оборудования (нет данных)</option>
              </select>
            )}
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={territory1} onChange={(e) => setTerritory1(e.target.value)}>
              <option value="">Область</option>
              {regionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={territory2} onChange={(e) => setTerritory2(e.target.value)}>
              <option value="">Зона</option>
              {zoneOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={territory3} onChange={(e) => setTerritory3(e.target.value)}>
              <option value="">Город</option>
              {cityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {effectiveTypeOptions.length === 0 ? (
            <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/20 dark:text-amber-200">
              Типы оборудования не найдены. Сначала добавьте хотя бы одну запись оборудования с заполненным типом
              (или настройте справочник), после чего фильтр выбора станет доступен.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Таблица</h3>
            <div className="flex flex-wrap gap-2">
              {!isHistory ? (
                <Link href="/clients/equipment/history" className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs">
                  <History className="mr-1.5 h-3.5 w-3.5" />
                  История инвентаризации
                </Link>
              ) : null}
              {!isHistory ? (
                <Button className="h-8 bg-teal-600 px-3 text-xs text-white hover:bg-teal-700" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Добавить
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/70 bg-background p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setColumnDialogOpen(true)}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={String(limit)}
                onChange={(e) => tablePrefs.setPageSize(Number(e.target.value))}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <div className="relative w-full min-w-[160px] max-w-[280px]">
                <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 w-full pl-7 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск"
                />
              </div>
              <Button
                variant="outline"
                className="h-8 text-xs"
                onClick={() => exportEquipmentExcel(rows, isHistory ? "equipment_history" : "equipment_list")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Excel
              </Button>
              <Button variant="ghost" className="h-8 text-xs" onClick={resetFilters}>
                <Filter className="mr-1 h-3.5 w-3.5" />
                Сброс
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1300px] text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-[11px] text-muted-foreground">
                    {tablePrefs.visibleColumnOrder.map((colId) => (
                      <th key={colId} className="px-3 py-2">
                        {columnLabelById[colId] ?? colId}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={tablePrefs.visibleColumnOrder.length}>
                        Загрузка…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground" colSpan={tablePrefs.visibleColumnOrder.length}>
                        Пусто
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        {tablePrefs.visibleColumnOrder.map((colId) => {
                          if (colId === "client_name") {
                            return (
                              <td key={colId} className="px-3 py-2">
                                <Link href={`/clients/${r.client_id}`} className="text-primary hover:underline">
                                  {r.client_name}
                                </Link>
                              </td>
                            );
                          }
                          return (
                            <td key={colId} className="px-3 py-2 text-xs">
                              {cellByColumnId(r, colId)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Всего: {total} • Стр. {page}/{totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>
                Назад
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => void load(page + 1)}>
                Вперёд
              </Button>
            </div>
          </div>

          <DateRangePopover
            open={dateOpen}
            onOpenChange={setDateOpen}
            anchorRef={dateAnchorRef}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onApply={({ dateFrom: df, dateTo: dt }) => {
              setDateFrom(df);
              setDateTo(dt);
            }}
          />
          <TableColumnSettingsDialog
            open={columnDialogOpen}
            onOpenChange={setColumnDialogOpen}
            title="Ustunlarni boshqarish"
            description="Ko‘rinadigan ustunlar va tartib. Sizning akkauntingiz uchun saqlanadi."
            columns={[...EQUIPMENT_COLUMNS]}
            columnOrder={tablePrefs.columnOrder}
            hiddenColumnIds={tablePrefs.hiddenColumnIds}
            saving={tablePrefs.saving}
            onSave={(next) => tablePrefs.saveColumnLayout(next)}
            onReset={() => tablePrefs.resetColumnLayout()}
          />
        </CardContent>
      </Card>

      {!isHistory ? (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Оборудованиеga qo‘shish</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Клиент *</p>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={addClientId} onChange={(e) => setAddClientId(e.target.value)}>
                  <option value="">Клиентni tanlang</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Маҳсулот (Продукт) *</p>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={addProductId} onChange={(e) => setAddProductId(e.target.value)}>
                  <option value="">Маҳсулотни tanlang</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name} {p.sku ? `(${p.sku})` : ""} {!p.is_active ? "• неактив" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={addSerial} onChange={(e) => setAddSerial(e.target.value)} placeholder="Серийный номер" />
                <Input value={addInventoryNo} onChange={(e) => setAddInventoryNo(e.target.value)} placeholder="Инв. номер" />
              </div>
              <Input value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Комментарий" />
              {addError ? <p className="text-xs text-destructive">{addError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Отмена
                </Button>
                <Button className="bg-teal-600 text-white hover:bg-teal-700" disabled={addSaving} onClick={() => void createManualEquipment()}>
                  {addSaving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </PageShell>
  );
}
