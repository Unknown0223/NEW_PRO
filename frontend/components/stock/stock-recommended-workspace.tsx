"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { DateRangePopover, formatDateRangeButton, localYmd } from "@/components/ui/date-range-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CalendarRange,
  Download,
  Hourglass,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  Search
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

type WarehouseOpt = { id: number; name: string; stock_purpose: string };
type CategoryOpt = { id: number; name: string };
type ProductOpt = { id: number; sku: string; name: string };

type RecommendedRow = {
  product_id: number;
  sku: string;
  category_name: string | null;
  product_name: string;
  stock_qty: string;
  avg_daily_sales: string;
  coverage_days: string;
  rec_stock_6: string;
  rec_stock_10: string;
  rec_stock_30: string;
  rec_stock_month_end: string;
  category_share_pct: string;
  sold_qty: string;
  risk_level: "low" | "medium" | "healthy" | "overstock";
};

type Payload = {
  data: RecommendedRow[];
  total: number;
  page: number;
  limit: number;
  kpi: { total_days: number; passed_days: number; remaining_days: number };
};

type QtyMode = "all" | "positive" | "zero";
type SortBy = "sku" | "category" | "name" | "stock" | "avg" | "coverage" | "r6" | "r10" | "r30" | "rme" | "share";
type SortDir = "asc" | "desc";

const TABLE_ID = "stock.recommended.v1";
const COLS = [
  { id: "sku", label: "Код" },
  { id: "category", label: "Категория" },
  { id: "name", label: "Ассортимент" },
  { id: "stock", label: "Товар на складе" },
  { id: "avg", label: "Сред. дневные продажи" },
  { id: "coverage", label: "Текущ. запас хватит на... дней" },
  { id: "r6", label: "Рек. запас на 6 дней" },
  { id: "r10", label: "Рек. запас на 10 дней" },
  { id: "r30", label: "Рек. запас на 30 дней" },
  { id: "rme", label: "Рек. запас до конца месяца" },
  { id: "share", label: "Доля в категории, %" }
] as const;
const DEFAULT_ORDER = COLS.map((c) => c.id);
const NUMERIC = new Set(["stock", "avg", "coverage", "r6", "r10", "r30", "rme", "share"]);

function monthStartYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function colLabel(id: string): string {
  return COLS.find((c) => c.id === id)?.label ?? id;
}

function fmtNum(v: string, digits = 2): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function rowRiskClass(r: RecommendedRow): string {
  if (r.risk_level === "low") return "bg-destructive/10 hover:bg-destructive/15";
  if (r.risk_level === "overstock") return "bg-amber-500/12 hover:bg-amber-500/18";
  if (r.risk_level === "medium") return "bg-yellow-500/10 hover:bg-yellow-500/15";
  return "hover:bg-muted/20";
}

function coverageClass(r: RecommendedRow): string {
  if (r.risk_level === "low") return "text-destructive font-semibold";
  if (r.risk_level === "overstock") return "text-amber-700 dark:text-amber-400 font-semibold";
  if (r.risk_level === "medium") return "text-yellow-700 dark:text-yellow-400 font-semibold";
  return "text-emerald-700 dark:text-emerald-400 font-semibold";
}

export function StockRecommendedWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const today = localYmd(new Date());
  const [draftDateFrom, setDraftDateFrom] = useState(monthStartYmd);
  const [draftDateTo, setDraftDateTo] = useState(today);
  const [draftWarehouseId, setDraftWarehouseId] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftProductId, setDraftProductId] = useState("");
  const [draftQtyMode, setDraftQtyMode] = useState<QtyMode>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("category");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState({
    dateFrom: monthStartYmd(),
    dateTo: today,
    warehouseId: "",
    categoryId: "",
    productId: "",
    qtyMode: "all" as QtyMode,
    q: ""
  });
  const [page, setPage] = useState(1);
  const [dateOpen, setDateOpen] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);

  const prefs = useUserTablePrefs({
    tenantSlug,
    tableId: TABLE_ID,
    defaultColumnOrder: DEFAULT_ORDER,
    defaultPageSize: 25,
    allowedPageSizes: [10, 25, 50, 100]
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "recommended"],
    queryFn: async () => {
      const { data } = await api.get<{ data: WarehouseOpt[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data.filter((w) => w.stock_purpose === "sales");
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "recommended"],
    queryFn: async () => {
      const { data } = await api.get<{ data: CategoryOpt[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const productsQ = useQuery({
    queryKey: ["products-recommended", tenantSlug],
    queryFn: async () => {
      const out: ProductOpt[] = [];
      let cur = 1;
      const limit = 200;
      for (;;) {
        const { data } = await api.get<{ data: ProductOpt[]; total: number }>(
          `/api/${tenantSlug}/products?page=${cur}&limit=${limit}&is_active=true`
        );
        out.push(...data.data);
        if (out.length >= data.total || data.data.length < limit) break;
        cur += 1;
      }
      return out;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });

  const listQ = useQuery({
    queryKey: [
      "stock-recommended",
      tenantSlug,
      filters.dateFrom,
      filters.dateTo,
      filters.warehouseId,
      filters.categoryId,
      filters.productId,
      filters.qtyMode,
      filters.q,
      sortBy,
      sortDir,
      page,
      prefs.pageSize
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        qty_mode: filters.qtyMode,
        sort_by: sortBy,
        sort_dir: sortDir,
        page: String(page),
        limit: String(prefs.pageSize)
      });
      if (filters.warehouseId) p.set("warehouse_id", filters.warehouseId);
      if (filters.categoryId) p.set("category_id", filters.categoryId);
      if (filters.productId) p.set("product_id", filters.productId);
      if (filters.q.trim()) p.set("q", filters.q.trim());
      const { data } = await api.get<Payload>(`/api/${tenantSlug}/stock/recommended?${p.toString()}`);
      return data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list
  });

  const visibleCols = prefs.visibleColumnOrder;
  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / prefs.pageSize));
  const kpi = listQ.data?.kpi ?? { total_days: 0, passed_days: 0, remaining_days: 0 };

  function applyFilters() {
    setFilters({
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
      warehouseId: draftWarehouseId,
      categoryId: draftCategoryId,
      productId: draftProductId,
      qtyMode: draftQtyMode,
      q: searchDraft.trim()
    });
    setPage(1);
  }

  function resetFilters() {
    const from = monthStartYmd();
    const to = localYmd(new Date());
    setDraftDateFrom(from);
    setDraftDateTo(to);
    setDraftWarehouseId("");
    setDraftCategoryId("");
    setDraftProductId("");
    setDraftQtyMode("all");
    setSearchDraft("");
    setFilters({
      dateFrom: from,
      dateTo: to,
      warehouseId: "",
      categoryId: "",
      productId: "",
      qtyMode: "all",
      q: ""
    });
    setPage(1);
  }

  async function downloadExcel() {
    setExporting(true);
    try {
      const p = new URLSearchParams({
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        qty_mode: filters.qtyMode
      });
      if (filters.warehouseId) p.set("warehouse_id", filters.warehouseId);
      if (filters.categoryId) p.set("category_id", filters.categoryId);
      if (filters.productId) p.set("product_id", filters.productId);
      if (filters.q.trim()) p.set("q", filters.q.trim());
      p.set("sort_by", sortBy);
      p.set("sort_dir", sortDir);
      const res = await api.get(`/api/${tenantSlug}/stock/recommended/export?${p.toString()}`, {
        responseType: "arraybuffer"
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recommended-stock.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * prefs.pageSize + 1;
  const to = Math.min(page * prefs.pageSize, total);
  const SORT_BY_COL: Partial<Record<string, SortBy>> = {
    sku: "sku",
    category: "category",
    name: "name",
    stock: "stock",
    avg: "avg",
    coverage: "coverage",
    r6: "r6",
    r10: "r10",
    r30: "r30",
    rme: "rme",
    share: "share"
  };

  function toggleSort(colId: string) {
    const mapped = SORT_BY_COL[colId];
    if (!mapped) return;
    setPage(1);
    if (sortBy === mapped) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(mapped);
    setSortDir("asc");
  }

  const colRender = useMemo(
    () => ({
      sku: (r: RecommendedRow) => r.sku,
      category: (r: RecommendedRow) => r.category_name ?? "—",
      name: (r: RecommendedRow) => r.product_name,
      stock: (r: RecommendedRow) => fmtNum(r.stock_qty, 3),
      avg: (r: RecommendedRow) => fmtNum(r.avg_daily_sales, 3),
      coverage: (r: RecommendedRow) => <span className={coverageClass(r)}>{fmtNum(r.coverage_days, 2)}</span>,
      r6: (r: RecommendedRow) => fmtNum(r.rec_stock_6, 3),
      r10: (r: RecommendedRow) => fmtNum(r.rec_stock_10, 3),
      r30: (r: RecommendedRow) => fmtNum(r.rec_stock_30, 3),
      rme: (r: RecommendedRow) => fmtNum(r.rec_stock_month_end, 3),
      share: (r: RecommendedRow) => fmtNum(r.category_share_pct, 2)
    }),
    []
  );

  return (
    <PageShell>
      <PageHeader
        title="Остатки товара на складе (рекомендованный запас)"
        description="Forecast по складу: среднесуточные продажи, покрытие запаса и рекомендованный объём пополнения."
      />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-2 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Фильтр</p>
              <button
                ref={dateAnchorRef}
                type="button"
                className="inline-flex h-9 min-w-[14rem] items-center justify-between rounded-md border border-input bg-background px-2.5 text-xs sm:min-w-[15rem]"
                onClick={() => setDateOpen((v) => !v)}
              >
                <span className="truncate">{formatDateRangeButton(draftDateFrom, draftDateTo)}</span>
                <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Категория"
                  value={draftCategoryId}
                  onValueChange={setDraftCategoryId}
                  options={(categoriesQ.data ?? []).map((c) => ({
                    value: String(c.id),
                    label: c.name
                  }))}
                  searchPlaceholder="Поиск категории"
                  minPopoverWidth={280}
                  className="h-8 rounded-md px-2 text-xs"
                  emptyMessage="Категория не найдена"
                  searchable
                />
              </div>
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Склад"
                  value={draftWarehouseId}
                  onValueChange={setDraftWarehouseId}
                  options={(warehousesQ.data ?? []).map((w) => ({
                    value: String(w.id),
                    label: w.name
                  }))}
                  searchPlaceholder="Поиск склада"
                  minPopoverWidth={300}
                  className="h-8 rounded-md px-2 text-xs"
                  emptyMessage="Склад не найден"
                  searchable
                />
              </div>
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Ассортимент"
                  value={draftProductId}
                  onValueChange={setDraftProductId}
                  options={(productsQ.data ?? []).map((p) => ({
                    value: String(p.id),
                    label: p.name
                  }))}
                  searchPlaceholder="Поиск ассортимента"
                  minPopoverWidth={320}
                  className="h-8 rounded-md px-2 text-xs"
                  emptyMessage="Ассортимент не найден"
                  searchable
                />
              </div>
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Количество"
                  value={draftQtyMode}
                  onValueChange={(v) => setDraftQtyMode((v || "all") as QtyMode)}
                  options={[
                    { value: "all", label: "Количество" },
                    { value: "positive", label: "С остатком" },
                    { value: "zero", label: "Нулевые" }
                  ]}
                  searchable={false}
                  minPopoverWidth={220}
                  className="h-8 rounded-md px-2 text-xs"
                />
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={resetFilters}
                    title="Сбросить фильтры"
                  >
                    <ListFilter className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    className="h-8 min-w-[6.75rem] bg-teal-600 px-3 text-xs text-white hover:bg-teal-700"
                    onClick={applyFilters}
                  >
                    Применить
                  </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-500 text-white">
              <CalendarRange className="size-4" />
            </span>
            <div>
              <p className="text-xl font-semibold leading-none">{kpi.total_days}</p>
              <p className="mt-1 text-xs text-muted-foreground">Всего дней</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-lime-500 text-white">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <p className="text-xl font-semibold leading-none">{kpi.passed_days}</p>
              <p className="mt-1 text-xs text-muted-foreground">Пройдено дней</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center gap-3 p-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-fuchsia-500 text-white">
              <Hourglass className="size-4" />
            </span>
            <div>
              <p className="text-xl font-semibold leading-none">{kpi.remaining_days}</p>
              <p className="mt-1 text-xs text-muted-foreground">Осталось дней</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок сохраняются для вашей учётной записи."
        columns={[...COLS]}
        columnOrder={prefs.columnOrder}
        hiddenColumnIds={prefs.hiddenColumnIds}
        saving={prefs.saving}
        onSave={(next) => prefs.saveColumnLayout(next)}
        onReset={() => prefs.resetColumnLayout()}
      />

      <div className="orders-hub-section orders-hub-section--table mt-4">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
            <div className="table-toolbar flex flex-wrap items-end justify-between gap-3 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
              <div className="flex flex-wrap items-end gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={String(prefs.pageSize)}
                  onChange={(e) => {
                    prefs.setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setColumnDialogOpen(true)}>
                  <LayoutGrid className="size-4" />
                </Button>
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
                <Button type="button" variant="outline" size="sm" className="h-9" disabled={exporting} onClick={() => void downloadExcel()}>
                  <Download className="mr-1 size-3.5" />
                  {exporting ? "…" : "Excel"}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => void listQ.refetch()}>
                  <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-sm">
                {visibleCols.length === 0 ? (
                  <tbody>
                    <tr>
                      <td className="px-3 py-10 text-center text-muted-foreground">Нет видимых столбцов.</td>
                    </tr>
                  </tbody>
                ) : (
                  <>
                    <thead className="app-table-thead">
                      <tr className="text-left">
                        {visibleCols.map((colId) => {
                          const mapped = SORT_BY_COL[colId];
                          const active = mapped != null && sortBy === mapped;
                          return (
                            <th key={colId} className={cn("px-3 py-2.5 font-semibold", NUMERIC.has(colId) && "text-right")}>
                              {mapped ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSort(colId)}
                                  className={cn(
                                    "inline-flex items-center gap-1 hover:text-foreground",
                                    NUMERIC.has(colId) && "ml-auto"
                                  )}
                                  title="Сортировка по столбцу"
                                >
                                  <span>{colLabel(colId)}</span>
                                  {active ? (
                                    sortDir === "asc" ? (
                                      <ArrowUp className="size-3.5" />
                                    ) : (
                                      <ArrowDown className="size-3.5" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="size-3.5 text-muted-foreground" />
                                  )}
                                </button>
                              ) : (
                                colLabel(colId)
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {listQ.isLoading ? (
                        <tr><td colSpan={visibleCols.length} className="px-3 py-10 text-center text-muted-foreground">Загрузка…</td></tr>
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={visibleCols.length} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.product_id} className={cn("border-b border-border/70", rowRiskClass(row))}>
                            {visibleCols.map((colId) => (
                              <td key={colId} className={cn("px-3 py-2", NUMERIC.has(colId) && "text-right tabular-nums")}>
                                {colRender[colId as keyof typeof colRender](row)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                )}
              </table>
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

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draftDateFrom}
        dateTo={draftDateTo}
        onApply={({ dateFrom, dateTo }) => {
          setDraftDateFrom(dateFrom);
          setDraftDateTo(dateTo);
        }}
      />
    </PageShell>
  );
}
