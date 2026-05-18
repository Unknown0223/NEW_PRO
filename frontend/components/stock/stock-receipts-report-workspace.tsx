"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { DateRangePopover, formatDateRangeButton, localYmd } from "@/components/ui/date-range-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { Input } from "@/components/ui/input";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Download, LayoutGrid, ListFilter, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type WarehouseOpt = { id: number; name: string };
type CategoryOpt = { id: number; name: string };
type SupplierOpt = { id: number; name: string };
type ProductOpt = { id: number; name: string };

type MainRow = {
  product_id: number;
  category_name: string | null;
  sku: string;
  product_name: string;
  last_purchase_at: string | null;
  qty: string;
  price: string;
  total: string;
};
type MainPayload = {
  data: MainRow[];
  total: number;
  page: number;
  limit: number;
  totals: { qty: string; total: string };
};

type DailyRow = {
  product_id: number;
  category_name: string | null;
  product_name: string;
  sku: string;
  total_qty: string;
  values: Record<string, string>;
};
type DailyPayload = {
  columns: { key: string; label: string; at: string; receipt_id: number }[];
  data: DailyRow[];
  total: number;
  page: number;
  limit: number;
  totals: { total_qty: string; by_column: Record<string, string> };
};

const MAIN_COLS = [
  { id: "category", label: "Категория продукта" },
  { id: "sku", label: "Код" },
  { id: "name", label: "Наименование" },
  { id: "last", label: "Дата последнего закупа" },
  { id: "qty", label: "Кол-во" },
  { id: "price", label: "Цена" },
  { id: "total", label: "Сумма" }
] as const;
const DAILY_COLS = [
  { id: "category", label: "Категория" },
  { id: "name", label: "Названия" },
  { id: "sku", label: "Код" },
  { id: "total_qty", label: "Итого" }
] as const;

function monthStartYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

function fmtNum(v: string, digits = 2): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

type MainSortKey = "category" | "sku" | "name" | "last" | "qty" | "price" | "total";
type DailySortKey = "category" | "name" | "sku" | "total_qty";
type SortDir = "asc" | "desc";

export function StockReceiptsReportWorkspace({
  tenantSlug,
  daily = false
}: {
  tenantSlug: string;
  daily?: boolean;
}) {
  const [draftFrom, setDraftFrom] = useState(monthStartYmd);
  const [draftTo, setDraftTo] = useState(localYmd(new Date()));
  const [draftWarehouse, setDraftWarehouse] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftSupplier, setDraftSupplier] = useState("");
  const [draftProduct, setDraftProduct] = useState("");
  const [draftQtyMode, setDraftQtyMode] = useState<"all" | "positive" | "zero">("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [applied, setApplied] = useState({
    dateFrom: monthStartYmd(),
    dateTo: localYmd(new Date()),
    warehouseId: "",
    categoryId: "",
    supplierId: "",
    productId: "",
    qtyMode: "all" as "all" | "positive" | "zero",
    q: ""
  });
  const [page, setPage] = useState(1);
  const [dateOpen, setDateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [mainSortBy, setMainSortBy] = useState<MainSortKey>("category");
  const [mainSortDir, setMainSortDir] = useState<SortDir>("asc");
  const [dailySortBy, setDailySortBy] = useState<DailySortKey>("category");
  const [dailySortDir, setDailySortDir] = useState<SortDir>("desc");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);
  const colDefs = daily ? DAILY_COLS : MAIN_COLS;
  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: daily ? "stock.receipts_report.daily.v1" : "stock.receipts_report.main.v1",
    defaultColumnOrder: colDefs.map((c) => c.id),
    defaultPageSize: 25,
    allowedPageSizes: [10, 25, 50, 100]
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "receipts-report"],
    queryFn: async () => {
      const { data } = await api.get<{ data: WarehouseOpt[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "receipts-report"],
    queryFn: async () => {
      const { data } = await api.get<{ data: CategoryOpt[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const suppliersQ = useQuery({
    queryKey: ["suppliers", tenantSlug, "receipts-report"],
    queryFn: async () => {
      const { data } = await api.get<{ data: SupplierOpt[] }>(`/api/${tenantSlug}/suppliers`);
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const productsQ = useQuery({
    queryKey: ["products", tenantSlug, "receipts-report-detailed"],
    queryFn: async () => {
      const out: ProductOpt[] = [];
      let p = 1;
      for (;;) {
        const { data } = await api.get<{ data: ProductOpt[]; total: number }>(
          `/api/${tenantSlug}/products?page=${p}&limit=200&is_active=true`
        );
        out.push(...data.data);
        if (out.length >= data.total || data.data.length < 200) break;
        p += 1;
      }
      return out;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });

  const listQ = useQuery({
    queryKey: ["stock-receipts-report", tenantSlug, daily, applied, page, pageSize],
    queryFn: async () => {
      const p = new URLSearchParams({
        date_from: applied.dateFrom,
        date_to: applied.dateTo,
        page: String(page),
        limit: String(pageSize)
      });
      if (applied.warehouseId) p.set("warehouse_id", applied.warehouseId);
      if (!daily && applied.categoryId) p.set("category_id", applied.categoryId);
      if (!daily && applied.supplierId) p.set("supplier_id", applied.supplierId);
      if (daily && applied.productId) p.set("product_id", applied.productId);
      if (daily) p.set("qty_mode", applied.qtyMode);
      if (applied.q.trim()) p.set("q", applied.q.trim());
      const endpoint = daily ? "timeline" : "";
      const url = endpoint
        ? `/api/${tenantSlug}/stock/receipts-report/${endpoint}?${p.toString()}`
        : `/api/${tenantSlug}/stock/receipts-report?${p.toString()}`;
      if (daily) {
        const { data } = await api.get<DailyPayload>(url);
        return data as MainPayload | DailyPayload;
      }
      const { data } = await api.get<MainPayload>(url);
      return data as MainPayload | DailyPayload;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list
  });

  function applyFilters() {
    setApplied({
      dateFrom: draftFrom,
      dateTo: draftTo,
      warehouseId: draftWarehouse,
      categoryId: draftCategory,
      supplierId: draftSupplier,
      productId: draftProduct,
      qtyMode: draftQtyMode,
      q: searchDraft.trim()
    });
    setPage(1);
  }

  function resetFilters() {
    const from = monthStartYmd();
    const to = localYmd(new Date());
    setDraftFrom(from);
    setDraftTo(to);
    setDraftWarehouse("");
    setDraftCategory("");
    setDraftSupplier("");
    setDraftProduct("");
    setDraftQtyMode("all");
    setSearchDraft("");
    setApplied({
      dateFrom: from,
      dateTo: to,
      warehouseId: "",
      categoryId: "",
      supplierId: "",
      productId: "",
      qtyMode: "all",
      q: ""
    });
    setPage(1);
  }

  async function downloadExcel() {
    if (daily) return;
    setExporting(true);
    try {
      const p = new URLSearchParams({
        date_from: applied.dateFrom,
        date_to: applied.dateTo
      });
      if (applied.warehouseId) p.set("warehouse_id", applied.warehouseId);
      if (applied.categoryId) p.set("category_id", applied.categoryId);
      if (applied.supplierId) p.set("supplier_id", applied.supplierId);
      if (applied.q.trim()) p.set("q", applied.q.trim());
      const res = await api.get(`/api/${tenantSlug}/stock/receipts-report/export?${p.toString()}`, {
        responseType: "arraybuffer"
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stock-receipts-report.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const isDaily = daily;
  const payload = listQ.data;
  const total = payload?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const totalsMain = !isDaily
    ? ((payload as MainPayload | undefined)?.totals ?? { qty: "0", total: "0.00" })
    : { qty: "0", total: "0.00" };
  const totalsDaily = isDaily
    ? ((payload as DailyPayload | undefined)?.totals ?? { total_qty: "0", by_column: {} as Record<string, string> })
    : { total_qty: "0", by_column: {} as Record<string, string> };
  const dailyColumns = isDaily ? ((payload as DailyPayload | undefined)?.columns ?? []) : [];

  const sortedMainRows = useMemo(() => {
    if (!payload || isDaily) return [];
    const rows = [...((payload as MainPayload).data ?? [])];
    const mul = mainSortDir === "desc" ? -1 : 1;
    const cmpText = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    const cmpNum = (a: string, b: string) => Number(a) - Number(b);
    rows.sort((a, b) => {
      let c = 0;
      switch (mainSortBy) {
        case "category":
          c = cmpText(a.category_name ?? "", b.category_name ?? "");
          break;
        case "sku":
          c = cmpText(a.sku, b.sku);
          break;
        case "name":
          c = cmpText(a.product_name, b.product_name);
          break;
        case "last":
          c = cmpText(a.last_purchase_at ?? "", b.last_purchase_at ?? "");
          break;
        case "qty":
          c = cmpNum(a.qty, b.qty);
          break;
        case "price":
          c = cmpNum(a.price, b.price);
          break;
        case "total":
          c = cmpNum(a.total, b.total);
          break;
      }
      return c * mul;
    });
    return rows;
  }, [payload, isDaily, mainSortBy, mainSortDir]);

  const sortedDailyRows = useMemo(() => {
    if (!payload || !isDaily) return [];
    const rows = [...((payload as DailyPayload).data ?? [])];
    const mul = dailySortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      let c = 0;
      switch (dailySortBy) {
        case "category":
          c = (a.category_name ?? "").localeCompare(b.category_name ?? "", undefined, {
            sensitivity: "base"
          });
          break;
        case "name":
          c = a.product_name.localeCompare(b.product_name, undefined, { sensitivity: "base" });
          break;
        case "sku":
          c = a.sku.localeCompare(b.sku, undefined, { sensitivity: "base", numeric: true });
          break;
        case "total_qty":
          c = Number(a.total_qty) - Number(b.total_qty);
          break;
      }
      return c * mul;
    });
    return rows;
  }, [payload, isDaily, dailySortBy, dailySortDir]);

  function toggleMainSort(key: MainSortKey) {
    if (mainSortBy === key) {
      setMainSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setMainSortBy(key);
    setMainSortDir("asc");
  }

  function toggleDailySort(key: DailySortKey) {
    if (dailySortBy === key) {
      setDailySortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setDailySortBy(key);
    setDailySortDir("asc");
  }

  function sortIcon(active: boolean, dir: SortDir) {
    if (!active) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    return dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  }

  return (
    <PageShell>
      <PageHeader
        title={isDaily ? "Отчет по поступлениям (детальный)" : "Отчет о поступлении товара на склад"}
        description={
          isDaily
            ? "Timeline matrix: продукты по строкам и документы прихода по датам в динамических столбцах."
            : "Аналитика прихода на склад: поставщики, последние закупки и сумма закупа по товарам."
        }
      />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-2 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isDaily ? (
                <Link href="/stock/receipts-report" className="text-xs text-muted-foreground underline underline-offset-4">
                  К сводному отчету
                </Link>
              ) : (
                <Link href="/stock/receipts-report/daily" className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
                  Детальный отчет по дням
                </Link>
              )}
              <button
                ref={dateAnchorRef}
                type="button"
                className="inline-flex h-9 min-w-[14rem] items-center justify-between rounded-md border border-input bg-background px-2.5 text-xs sm:min-w-[15rem]"
                onClick={() => setDateOpen((v) => !v)}
              >
                <span className="truncate">{formatDateRangeButton(draftFrom, draftTo)}</span>
                <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Склад"
                  value={draftWarehouse}
                  onValueChange={setDraftWarehouse}
                  options={(warehousesQ.data ?? []).map((w) => ({ value: String(w.id), label: w.name }))}
                  searchable
                  className="h-8 rounded-md px-2 text-xs"
                />
              </div>
              {isDaily ? (
                <>
                  <div className="w-[12rem] min-w-[12rem]">
                    <FilterSearchableSelect
                      emptyLabel="Продукт"
                      value={draftProduct}
                      onValueChange={setDraftProduct}
                      options={(productsQ.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
                      searchable
                      className="h-8 rounded-md px-2 text-xs"
                    />
                  </div>
                  <div className="w-[12rem] min-w-[12rem]">
                    <FilterSearchableSelect
                      emptyLabel="Количество"
                      value={draftQtyMode}
                      onValueChange={(v) =>
                        setDraftQtyMode((v || "all") as "all" | "positive" | "zero")
                      }
                      options={[
                        { value: "all", label: "Количество" },
                        { value: "positive", label: "С остатком" },
                        { value: "zero", label: "Нулевые" }
                      ]}
                      searchable={false}
                      className="h-8 rounded-md px-2 text-xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-[12rem] min-w-[12rem]">
                    <FilterSearchableSelect
                      emptyLabel="Категория продукта"
                      value={draftCategory}
                      onValueChange={setDraftCategory}
                      options={(categoriesQ.data ?? []).map((c) => ({
                        value: String(c.id),
                        label: c.name
                      }))}
                      searchable
                      className="h-8 rounded-md px-2 text-xs"
                    />
                  </div>
                  <div className="w-[12rem] min-w-[12rem]">
                    <FilterSearchableSelect
                      emptyLabel="Поставщики"
                      value={draftSupplier}
                      onValueChange={setDraftSupplier}
                      options={(suppliersQ.data ?? []).map((s) => ({
                        value: String(s.id),
                        label: s.name
                      }))}
                      searchable
                      className="h-8 rounded-md px-2 text-xs"
                    />
                  </div>
                </>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={resetFilters} title="Сбросить фильтры">
                  <ListFilter className="size-4" />
                </Button>
                <Button type="button" className="h-8 px-3 text-xs" onClick={applyFilters}>
                  Применить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="orders-hub-section orders-hub-section--table mt-4">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
            <div className="table-toolbar flex flex-wrap items-end justify-between gap-3 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative min-w-[180px] max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-9 bg-background pl-8"
                    placeholder="Поиск"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  />
                </div>
                {!isDaily ? (
                  <Button type="button" variant="outline" size="sm" className="h-9" disabled={exporting} onClick={() => void downloadExcel()}>
                    <Download className="mr-1 size-3.5" />
                    {exporting ? "…" : "Excel"}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => void listQ.refetch()}>
                  <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setColumnDialogOpen(true)}>
                  <LayoutGrid className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">На странице</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              {isDaily ? (
                <table className="w-full min-w-[1200px] border-collapse text-sm">
                  <thead className="app-table-thead">
                    <tr className="text-left">
                      {tablePrefs.visibleColumnOrder.map((colId) => (
                        <th
                          key={colId}
                          className={cn(
                            "px-3 py-2.5 font-semibold",
                            colId === "total_qty" && "text-right"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleDailySort(colId as DailySortKey)}
                            className={cn(
                              "inline-flex items-center gap-1 hover:text-foreground",
                              colId === "total_qty" && "ml-auto"
                            )}
                          >
                            <span>{DAILY_COLS.find((c) => c.id === colId)?.label ?? colId}</span>
                            {sortIcon(dailySortBy === (colId as DailySortKey), dailySortDir)}
                          </button>
                        </th>
                      ))}
                      {dailyColumns.map((c) => (
                        <th
                          key={c.key}
                          className="whitespace-nowrap px-3 py-2.5 text-right font-semibold"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listQ.isLoading ? (
                      <tr>
                        <td
                          colSpan={Math.max(1, tablePrefs.visibleColumnOrder.length + dailyColumns.length)}
                          className="px-3 py-10 text-center text-muted-foreground"
                        >
                          Загрузка…
                        </td>
                      </tr>
                    ) : (payload as DailyPayload | undefined)?.data?.length ? (
                      sortedDailyRows.map((r) => (
                        <tr key={r.product_id} className="border-b border-border/70 hover:bg-muted/20">
                          {tablePrefs.visibleColumnOrder.map((colId) => (
                            <td
                              key={colId}
                              className={cn(
                                "px-3 py-2",
                                colId === "total_qty" && "text-right tabular-nums"
                              )}
                            >
                              {colId === "category"
                                ? (r.category_name ?? "—")
                                : colId === "name"
                                  ? r.product_name
                                  : colId === "sku"
                                    ? r.sku
                                    : colId === "total_qty"
                                      ? fmtNum(r.total_qty, 0)
                                      : "—"}
                            </td>
                          ))}
                          {dailyColumns.map((c) => (
                            <td key={`${r.product_id}:${c.key}`} className="px-3 py-2 text-right tabular-nums">
                              {Number(r.values[c.key] ?? "0") > 0 ? fmtNum(r.values[c.key] ?? "0", 0) : ""}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={Math.max(1, tablePrefs.visibleColumnOrder.length + dailyColumns.length)}
                          className="px-3 py-10 text-center text-muted-foreground"
                        >
                          Пусто
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold">
                      {tablePrefs.visibleColumnOrder.map((colId, idx) => (
                        <td
                          key={colId}
                          className={cn("px-3 py-2", colId === "total_qty" && "text-right tabular-nums")}
                        >
                          {colId === "total_qty"
                            ? fmtNum(totalsDaily.total_qty, 0)
                              : idx === 0
                                ? "Итого"
                                : ""}
                        </td>
                      ))}
                      {dailyColumns.map((c) => (
                        <td key={`total:${c.key}`} className="px-3 py-2 text-right tabular-nums">
                          {fmtNum(totalsDaily.by_column[c.key] ?? "0", 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full min-w-[1120px] border-collapse text-sm">
                  <thead className="app-table-thead">
                    <tr className="text-left">
                      {tablePrefs.visibleColumnOrder.map((colId) => (
                        <th key={colId} className={cn("px-3 py-2.5 font-semibold", (colId === "qty" || colId === "price" || colId === "total") && "text-right")}>
                          <button
                            type="button"
                            onClick={() => toggleMainSort(colId as MainSortKey)}
                            className={cn("inline-flex items-center gap-1 hover:text-foreground", (colId === "qty" || colId === "price" || colId === "total") && "ml-auto")}
                          >
                            <span>{MAIN_COLS.find((c) => c.id === colId)?.label ?? colId}</span>
                            {sortIcon(mainSortBy === (colId as MainSortKey), mainSortDir)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listQ.isLoading ? (
                      <tr><td colSpan={Math.max(1, tablePrefs.visibleColumnOrder.length)} className="px-3 py-10 text-center text-muted-foreground">Загрузка…</td></tr>
                    ) : (payload as MainPayload | undefined)?.data?.length ? (
                      sortedMainRows.map((r) => (
                        <tr key={r.product_id} className="border-b border-border/70 hover:bg-muted/20">
                          {tablePrefs.visibleColumnOrder.map((colId) => (
                            <td key={colId} className={cn("px-3 py-2", (colId === "qty" || colId === "price" || colId === "total") && "text-right tabular-nums", colId === "last" && "text-muted-foreground")}>
                              {colId === "category"
                                ? (r.category_name ?? "—")
                                : colId === "sku"
                                  ? r.sku
                                  : colId === "name"
                                    ? r.product_name
                                    : colId === "last"
                                      ? fmtDate(r.last_purchase_at)
                                      : colId === "qty"
                                        ? fmtNum(r.qty, 3)
                                        : colId === "price"
                                          ? fmtNum(r.price, 2)
                                          : colId === "total"
                                            ? fmtNum(r.total, 2)
                                            : "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={Math.max(1, tablePrefs.visibleColumnOrder.length)} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/20 font-semibold">
                      {tablePrefs.visibleColumnOrder.map((colId, idx) => (
                        <td key={colId} className={cn("px-3 py-2", (colId === "qty" || colId === "price" || colId === "total") && "text-right tabular-nums")}>
                          {colId === "qty"
                            ? fmtNum(totalsMain.qty, 3)
                            : colId === "total"
                              ? fmtNum(totalsMain.total, 2)
                              : idx === 0
                                ? "Итого"
                                : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div className="table-content-footer flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/25 px-3 py-3 text-xs sm:px-4">
              <span className="text-foreground/80">Показано {from}–{to} / {total}</span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</Button>
                <span className="tabular-nums text-foreground">{page} / {totalPages}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>→</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...colDefs]}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draftFrom}
        dateTo={draftTo}
        onApply={({ dateFrom, dateTo }) => {
          setDraftFrom(dateFrom);
          setDraftTo(dateTo);
        }}
      />
    </PageShell>
  );
}

