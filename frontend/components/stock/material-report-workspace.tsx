"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  RefreshCw
} from "lucide-react";

type WarehouseOpt = { id: number; name: string };
type CategoryOpt = { id: number; name: string };
type ProductOpt = { id: number; name: string; sku: string };
type Row = {
  product_id: number;
  category_name?: string | null;
  product_name: string;
  beginning_stock: string;
  incoming_receipt: string;
  correction_plus: string;
  return_from_shelf: string;
  inventory_plus: string;
  transfer_plus: string;
  partial_return: string;
  sale_out: string;
  supplier_return: string;
  correction_minus: string;
  bonus_out: string;
  writeoff_out: string;
  transfer_minus: string;
  inventory_minus: string;
  canceled_receipt: string;
  ending_stock: string;
  volume_m3: string;
};
type Payload = { data: Row[]; total: number; page: number; limit: number };
type SortKey =
  | "product_name"
  | "beginning_stock"
  | "incoming_receipt"
  | "sale_out"
  | "ending_stock"
  | "volume_m3";
type SortDir = "asc" | "desc";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}

export function MaterialReportWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const [dateFrom, setDateFrom] = useState(todayYmd());
  const [dateTo, setDateTo] = useState(todayYmd());
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [qtyMode, setQtyMode] = useState<"all" | "positive" | "zero">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [dateOpen, setDateOpen] = useState(false);
  const [excelMenuOpen, setExcelMenuOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("product_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);
  const excelMenuRef = useRef<HTMLDivElement | null>(null);

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "material-report"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: WarehouseOpt[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data;
    }
  });
  const categoriesQ = useQuery({
    queryKey: ["categories", tenantSlug, "material-report"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CategoryOpt[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data;
    }
  });
  const productsQ = useQuery({
    queryKey: ["products", tenantSlug, "material-report"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductOpt[] }>(
        `/api/${tenantSlug}/products?page=1&limit=300&is_active=true`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["material-report", tenantSlug, dateFrom, dateTo, warehouseId, categoryId, productId, qtyMode, q, page],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        qty_mode: qtyMode,
        page: String(page),
        limit: String(limit)
      });
      if (warehouseId) p.set("warehouse_id", warehouseId);
      if (categoryId) p.set("category_id", categoryId);
      if (productId) p.set("product_id", productId);
      if (q.trim()) p.set("q", q.trim());
      const { data } = await api.get<Payload>(`/api/${tenantSlug}/stock/material-report?${p.toString()}`);
      return data;
    }
  });

  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "product_name") {
        const cmp = a.product_name.localeCompare(b.product_name, undefined, { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      }
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortDir, sortKey]);
  const groupedRows = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of sortedRows) {
      const key = row.category_name?.trim() ? row.category_name : "Без категории";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }));
  }, [sortedRows]);
  const totals = useMemo(() => {
    const sum = (k: keyof Row) => sortedRows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return {
      beginning: sum("beginning_stock"),
      inRec: sum("incoming_receipt"),
      corrP: sum("correction_plus"),
      ret: sum("return_from_shelf"),
      invP: sum("inventory_plus"),
      trP: sum("transfer_plus"),
      part: sum("partial_return"),
      sale: sum("sale_out"),
      corrM: sum("correction_minus"),
      bonus: sum("bonus_out"),
      trM: sum("transfer_minus"),
      invM: sum("inventory_minus"),
      cancel: sum("canceled_receipt"),
      ending: sum("ending_stock"),
      volume: sum("volume_m3")
    };
  }, [sortedRows]);
  const categoryTotals = useMemo(() => {
    const byCat: Record<string, ReturnType<typeof categoryAggInit>> = {};
    for (const g of groupedRows) {
      byCat[g.category] = g.items.reduce((acc, r) => categoryAggAdd(acc, r), categoryAggInit());
    }
    return byCat;
  }, [groupedRows]);

  async function exportExcel(mode: "detailed" | "summary") {
    const p = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, qty_mode: qtyMode, mode });
    if (warehouseId) p.set("warehouse_id", warehouseId);
    if (categoryId) p.set("category_id", categoryId);
    if (productId) p.set("product_id", productId);
    if (q.trim()) p.set("q", q.trim());
    const res = await api.get<Blob>(`/api/${tenantSlug}/stock/material-report/export?${p.toString()}`, { responseType: "blob" });
    const u = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = u;
    a.download = `material-report-${mode}-${dateFrom}-${dateTo}.xlsx`;
    a.click();
    URL.revokeObjectURL(u);
  }

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "product_name" ? "asc" : "desc");
  }
  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ChevronDown className="ml-1 size-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="ml-1 size-3" /> : <ChevronDown className="ml-1 size-3" />;
  }
  function shiftDateRange(days: number) {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T00:00:00`);
    from.setDate(from.getDate() + days);
    to.setDate(to.getDate() + days);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(to.toISOString().slice(0, 10));
    setPage(1);
  }

  useEffect(() => {
    if (!excelMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (excelMenuRef.current?.contains(target)) return;
      setExcelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [excelMenuOpen]);

  return (
    <PageShell>
      <PageHeader title="Материальный отчёт" />
      <Card className="rounded-lg border bg-card shadow-sm">
        <CardContent className="space-y-0 p-3 sm:p-4">
          <div className="rounded-md border bg-muted/20 p-2.5 sm:p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Материальный отчет</h3>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDateRange(-1)}>
                    <ChevronLeft className="size-4" />
                  </Button>
                  <button
                    ref={dateAnchorRef}
                    type="button"
                    className="inline-flex h-8 min-w-[13rem] items-center justify-between rounded-md border border-input bg-background px-2 text-xs"
                    onClick={() => setDateOpen((v) => !v)}
                  >
                    <span className="truncate">{formatDateRangeButton(dateFrom, dateTo)}</span>
                    <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDateRange(1)}>
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
            <select
              className="h-8 min-w-[11rem] rounded-md border border-input bg-background px-2 text-xs"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Категория продукта</option>
              {(categoriesQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-xs"
              value={qtyMode}
              onChange={(e) => {
                setQtyMode(e.target.value as "all" | "positive" | "zero");
                setPage(1);
              }}
            >
              <option value="all">Кол-во / количество</option>
              <option value="positive">С остатком</option>
              <option value="zero">Нулевые</option>
            </select>
            <select
              className="h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-xs"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Склад</option>
              {(warehousesQ.data ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select
              className="h-8 min-w-[11rem] rounded-md border border-input bg-background px-2 text-xs"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Продукт</option>
              {(productsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
            </select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void listQ.refetch()}><RefreshCw className={listQ.isFetching ? "animate-spin" : ""} /></Button>
            <div className="relative ml-auto" ref={excelMenuRef}>
              <Button
                variant="outline"
                className="h-8 text-xs"
                onClick={() => setExcelMenuOpen((v) => !v)}
              >
                <Download className="mr-1.5 size-3.5" />
                Excel
                <ChevronDown className="ml-1.5 size-3.5" />
              </Button>
              {excelMenuOpen ? (
                <div className="absolute left-0 top-9 z-20 min-w-[10.5rem] rounded-md border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => {
                      setExcelMenuOpen(false);
                      void exportExcel("summary");
                    }}
                  >
                    Excel (Общий)
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                    onClick={() => {
                      setExcelMenuOpen(false);
                      void exportExcel("detailed");
                    }}
                  >
                    Excel (Детальный)
                  </button>
                </div>
              ) : null}
            </div>
            </div>
          </div>

          <div className="h-4" />

          <div className="rounded-md border bg-background p-1 shadow-sm sm:p-1.5">
            <div className="overflow-auto rounded-md border bg-background">
            <table className="min-w-[1800px] w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="border-b">
                  <th rowSpan={2} className="px-2 py-2 text-left">
                    <button type="button" className="inline-flex items-center" onClick={() => onSort("product_name")}>Категория товара {sortIcon("product_name")}</button>
                  </th>
                  <th rowSpan={2} className="px-2 py-2 text-right">
                    <button type="button" className="inline-flex items-center" onClick={() => onSort("beginning_stock")}>Остаток на начало {sortIcon("beginning_stock")}</button>
                  </th>
                  <th colSpan={6} className="bg-emerald-500/10 px-2 py-2 text-center text-emerald-700 dark:text-emerald-300">Приход</th>
                  <th colSpan={8} className="bg-rose-500/10 px-2 py-2 text-center text-rose-700 dark:text-rose-300">Расход</th>
                  <th rowSpan={2} className="px-2 py-2 text-right">
                    <button type="button" className="inline-flex items-center" onClick={() => onSort("ending_stock")}>Остаток на конец {sortIcon("ending_stock")}</button>
                  </th>
                  <th rowSpan={2} className="px-2 py-2 text-right">
                    <button type="button" className="inline-flex items-center" onClick={() => onSort("volume_m3")}>Объем {sortIcon("volume_m3")}</button>
                  </th>
                </tr>
                <tr className="border-b">
                  <th className="bg-emerald-500/5 px-2 py-2 text-right">Поступление</th>
                  <th className="bg-emerald-500/5 px-2 py-2 text-right">Корректировка+</th>
                  <th className="bg-emerald-500/5 px-2 py-2 text-right">Возврат с полки</th>
                  <th className="bg-emerald-500/5 px-2 py-2 text-right">Инвентаризация+</th>
                  <th className="bg-emerald-500/5 px-2 py-2 text-right">Перемещения+</th>
                  <th className="bg-emerald-500/5 px-2 py-2 text-right">Частичный возврат</th>
                  <th className="border-l-2 border-rose-300 bg-rose-500/5 px-2 py-2 text-right">
                    <button type="button" className="inline-flex items-center" onClick={() => onSort("sale_out")}>Продажа {sortIcon("sale_out")}</button>
                  </th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Возврат поставщика</th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Корректировка-</th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Бонус</th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Списание</th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Перемещения-</th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Инвентаризация-</th>
                  <th className="bg-rose-500/5 px-2 py-2 text-right">Отмена поступления</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.flatMap((g) => {
                  const isOpen = openCategory === g.category;
                  const agg = categoryTotals[g.category];
                  const rowsOut = [
                    <tr key={`cat-${g.category}`} className="border-b bg-muted/25">
                      <td colSpan={18} className="px-2 py-1.5">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left font-medium"
                          onClick={() => setOpenCategory((prev) => (prev === g.category ? null : g.category))}
                        >
                          <span>{g.category} ({g.items.length})</span>
                          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </td>
                    </tr>
                  ];
                  if (isOpen) {
                    rowsOut.push(
                      ...g.items.map((r) => (
                        <tr key={`product-${g.category}-${r.product_id}`} className="border-b">
                          <td className="px-2 py-1">{r.product_name}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.beginning_stock)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.incoming_receipt)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.correction_plus)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.return_from_shelf)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.inventory_plus)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.transfer_plus)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.partial_return)}</td>
                          <td className="border-l-2 border-rose-200 px-2 py-1 text-right">{fmt(r.sale_out)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.supplier_return)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.correction_minus)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.bonus_out)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.writeoff_out)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.transfer_minus)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.inventory_minus)}</td>
                          <td className="px-2 py-1 text-right">{fmt(r.canceled_receipt)}</td>
                          <td className="px-2 py-1 text-right font-medium">{fmt(r.ending_stock)}</td>
                          <td className="px-2 py-1 text-right">{Number(r.volume_m3).toLocaleString("ru-RU", { maximumFractionDigits: 6 })}</td>
                        </tr>
                      ))
                    );
                  }
                  return rowsOut;
                })}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-2 py-2">Общий</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.beginning))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.inRec))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.corrP))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.ret))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.invP))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.trP))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.part))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.sale))}</td>
                  <td className="px-2 py-2 text-right">0</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.corrM))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.bonus))}</td>
                  <td className="px-2 py-2 text-right">0</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.trM))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.invM))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.cancel))}</td>
                  <td className="px-2 py-2 text-right">{fmt(String(totals.ending))}</td>
                  <td className="px-2 py-2 text-right">{totals.volume.toLocaleString("ru-RU", { maximumFractionDigits: 6 })}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-md border bg-muted/10 px-2 py-1.5 text-xs text-muted-foreground">
            <span>Показано {rows.length} / {total}</span>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25 / стр</option>
                <option value={50}>50 / стр</option>
                <option value={100}>100 / стр</option>
              </select>
              <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</Button>
              <span className="px-2 py-1">{page}/{pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>→</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApply={({ dateFrom: from, dateTo: to }) => {
          setDateFrom(from);
          setDateTo(to);
          setDateOpen(false);
          setPage(1);
        }}
      />
    </PageShell>
  );
}

function categoryAggInit() {
  return {
    beginning: 0,
    inRec: 0,
    sale: 0,
    ending: 0
  };
}

function categoryAggAdd(acc: ReturnType<typeof categoryAggInit>, r: Row) {
  acc.beginning += Number(r.beginning_stock) || 0;
  acc.inRec += Number(r.incoming_receipt) || 0;
  acc.sale += Number(r.sale_out) || 0;
  acc.ending += Number(r.ending_stock) || 0;
  return acc;
}
