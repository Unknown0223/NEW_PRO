"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { DateTimePickerField, localValueToDatetimeInput } from "@/components/ui/datetime-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { Input } from "@/components/ui/input";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Download, LayoutGrid, ListFilter, RefreshCw, Search } from "lucide-react";
import { useState } from "react";

type WarehouseOpt = { id: number; name: string; stock_purpose: string };
type CategoryOpt = { id: number; name: string };
type ProductOpt = { id: number; name: string };
type PriceTypeOpt = string;
type Row = {
  idx: number;
  product_id: number;
  sku: string;
  category_name: string | null;
  product_name: string;
  block_name: string | null;
  qty: string;
  volume: string;
  amount: string;
};
type Payload = { data: Row[]; total: number; page: number; limit: number };

const TABLE_ID = "stock.by_date.v1";
const COLS = [
  { id: "idx", label: "№" },
  { id: "sku", label: "Код" },
  { id: "category", label: "Категория" },
  { id: "name", label: "Названия" },
  { id: "block", label: "Блок" },
  { id: "qty", label: "Кол-во" },
  { id: "volume", label: "Объем" },
  { id: "amount", label: "Сумма" }
] as const;
const ORDER = COLS.map((c) => c.id);
const NUMERIC = new Set(["idx", "qty", "volume", "amount"]);

function labelOf(id: string): string {
  return COLS.find((x) => x.id === id)?.label ?? id;
}

export function StockByDateWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const [date, setDate] = useState(localValueToDatetimeInput(new Date()));
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [priceType, setPriceType] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  function resetFilters() {
    setCategoryId("");
    setProductId("");
    setPriceType("");
    setSearchDraft("");
    setQ("");
    setPage(1);
  }


  const prefs = useUserTablePrefs({
    tenantSlug,
    tableId: TABLE_ID,
    defaultColumnOrder: ORDER,
    defaultPageSize: 25,
    allowedPageSizes: [10, 25, 50, 100]
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "by-date"],
    queryFn: async () => {
      const { data } = await api.get<{ data: WarehouseOpt[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data.filter((w) => w.stock_purpose === "sales");
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "by-date"],
    queryFn: async () => {
      const { data } = await api.get<{ data: CategoryOpt[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });
  const productsQ = useQuery({
    queryKey: ["products", tenantSlug, "by-date"],
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
  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenantSlug, "by-date"],
    queryFn: async () => {
      const { data } = await api.get<{ data: PriceTypeOpt[] }>(`/api/${tenantSlug}/price-types?kind=sale`);
      return data.data;
    },
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference
  });

  const listQ = useQuery({
    queryKey: [
      "stock-by-date",
      tenantSlug,
      date,
      warehouseId,
      categoryId,
      productId,
      priceType,
      q,
      page,
      prefs.pageSize
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        date,
        warehouse_id: warehouseId,
        page: String(page),
        limit: String(prefs.pageSize)
      });
      if (categoryId) p.set("category_id", categoryId);
      if (productId) p.set("product_id", productId);
      if (priceType.trim()) p.set("price_type", priceType.trim());
      if (q.trim()) p.set("q", q.trim());
      const { data } = await api.get<Payload>(`/api/${tenantSlug}/stock/by-date?${p.toString()}`);
      return data;
    },
    enabled: Boolean(tenantSlug) && Boolean(warehouseId),
    staleTime: STALE.list
  });

  async function downloadExcel() {
    if (!warehouseId) return;
    setExporting(true);
    try {
      const p = new URLSearchParams({ date, warehouse_id: warehouseId });
      if (categoryId) p.set("category_id", categoryId);
      if (productId) p.set("product_id", productId);
      if (priceType.trim()) p.set("price_type", priceType.trim());
      if (q.trim()) p.set("q", q.trim());
      const res = await api.get(`/api/${tenantSlug}/stock/by-date/export?${p.toString()}`, {
        responseType: "arraybuffer"
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stock-by-date.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / prefs.pageSize));
  const from = total === 0 ? 0 : (page - 1) * prefs.pageSize + 1;
  const to = Math.min(page * prefs.pageSize, total);
  const cols = prefs.visibleColumnOrder;

  return (
    <PageShell>
      <PageHeader title="Остатки на определенную дату" description="Historical warehouse snapshot на выбранную дату." />

      <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
        <Card className="rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-2 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Фильтр</p>
              <div className="grid gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Дата</span>
                <div className="w-[18rem] min-w-[17rem]">
                  <DateTimePickerField
                    value={date}
                    onChange={(v) => {
                      setDate(v);
                      setPage(1);
                    }}
                    className="h-9"
                    timePlacement="side"
                    wheelTimeAdjust
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Склад"
                  value={warehouseId}
                  onValueChange={(v) => {
                    setWarehouseId(v);
                    setPage(1);
                  }}
                  options={(warehousesQ.data ?? []).map((w) => ({ value: String(w.id), label: w.name }))}
                  searchable
                  className="h-8 rounded-md px-2 text-xs"
                />
              </div>
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Категория"
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setPage(1);
                  }}
                  options={(categoriesQ.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                  searchable
                  className="h-8 rounded-md px-2 text-xs"
                />
              </div>
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Ассортимент"
                  value={productId}
                  onValueChange={(v) => {
                    setProductId(v);
                    setPage(1);
                  }}
                  options={(productsQ.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
                  searchable
                  className="h-8 rounded-md px-2 text-xs"
                />
              </div>
              <div className="w-[12rem] min-w-[12rem]">
                <FilterSearchableSelect
                  emptyLabel="Тип цены"
                  value={priceType}
                  onValueChange={(v) => {
                    setPriceType(v);
                    setPage(1);
                  }}
                  options={(priceTypesQ.data ?? []).map((pt) => ({ value: pt, label: pt }))}
                  searchable={false}
                  className="h-8 rounded-md px-2 text-xs"
                />
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="Сбросить фильтры"
                  onClick={resetFilters}
                >
                  <ListFilter className="size-4" />
                </Button>
                <Button
                  type="button"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setQ(searchDraft.trim());
                    setPage(1);
                  }}
                >
                  Применить
                </Button>
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setQ(searchDraft.trim());
                        setPage(1);
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9" disabled={exporting || !warehouseId} onClick={() => void downloadExcel()}>
                  <Download className="mr-1 size-3.5" />
                  {exporting ? "…" : "Excel"}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => void listQ.refetch()}>
                  <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                {cols.length === 0 ? (
                  <tbody><tr><td className="px-3 py-10 text-center text-muted-foreground">Нет видимых столбцов.</td></tr></tbody>
                ) : (
                  <>
                    <thead className="app-table-thead">
                      <tr className="text-left">
                        {cols.map((colId) => (
                          <th key={colId} className={cn("px-3 py-2.5 font-semibold", NUMERIC.has(colId) && "text-right")}>
                            {labelOf(colId)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!warehouseId ? (
                        <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-muted-foreground">Выберите склад.</td></tr>
                      ) : listQ.isLoading ? (
                        <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-muted-foreground">Загрузка…</td></tr>
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>
                      ) : (
                        rows.map((r) => (
                          <tr key={r.product_id} className="border-b border-border/70 hover:bg-muted/20">
                            {cols.map((colId) => {
                              const v =
                                colId === "idx" ? r.idx :
                                colId === "sku" ? r.sku :
                                colId === "category" ? (r.category_name ?? "—") :
                                colId === "name" ? r.product_name :
                                colId === "block" ? (r.block_name ?? "—") :
                                colId === "qty" ? r.qty :
                                colId === "volume" ? r.volume :
                                colId === "amount" ? r.amount : "—";
                              return (
                                <td key={colId} className={cn("px-3 py-2", NUMERIC.has(colId) && "text-right tabular-nums")}>
                                  {v}
                                </td>
                              );
                            })}
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
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1 || !warehouseId} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</Button>
                <span className="tabular-nums text-foreground">{page} / {totalPages}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" disabled={page >= totalPages || !warehouseId} onClick={() => setPage((p) => p + 1)}>→</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

