"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { buttonVariants } from "@/components/ui/button-variants";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

type Row = {
  id: number;
  number: string;
  client_name: string;
  warehouse_name: string | null;
  warehouse_block_name?: string | null;
  expeditor_display: string | null;
  status: string;
  shipped_at?: string | null;
  created_at: string;
  qty: string;
};

export default function AssemblyInvoicesPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [warehouseDraft, setWarehouseDraft] = useState("all");
  const [statusDraft, setStatusDraft] = useState("picking");
  const [expeditorDraft, setExpeditorDraft] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [warehouse, setWarehouse] = useState("all");
  const [status, setStatus] = useState("picking");
  const [expeditor, setExpeditor] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "summary">("list");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement>(null);

  const warehousesQ = useQuery({
    queryKey: ["assembly-invoices-warehouses", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data ?? [];
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["assembly-invoices-expeditors", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; fio: string }[] }>(`/api/${tenantSlug}/expeditors`);
      return data.data ?? [];
    }
  });

  const listQ = useQuery({
    queryKey: ["assembly-invoices", tenantSlug, warehouse, status, expeditor, search, dateFrom, dateTo],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (status !== "all") params.set("status", status);
      if (warehouse !== "all") params.set("warehouse_id", warehouse);
      if (expeditor !== "all") params.set("expeditor_id", expeditor);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const { data } = await api.get<{ data: Row[] }>(`/api/${tenantSlug}/orders?${params.toString()}`);
      return data.data ?? [];
    }
  });
  const rows = listQ.data ?? [];
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((r) =>
      [r.number, r.client_name, r.warehouse_name ?? "", r.expeditor_display ?? "", r.warehouse_block_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, search]);

  const summaryRows = useMemo(() => {
    const m = new Map<string, { expeditor: string; docs: number; qty: number }>();
    for (const r of filteredRows) {
      const key = (r.expeditor_display ?? "—").trim() || "—";
      const cur = m.get(key) ?? { expeditor: key, docs: 0, qty: 0 };
      cur.docs += 1;
      cur.qty += Number.parseFloat(r.qty) || 0;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.docs - a.docs);
  }, [filteredRows]);

  const statusBadgeClass = (v: string) => {
    if (v === "delivered") return "bg-emerald-100 text-emerald-700";
    if (v === "picking") return "bg-sky-100 text-sky-700";
    if (v === "delivering") return "bg-blue-100 text-blue-700";
    if (v === "cancelled") return "bg-rose-100 text-rose-700";
    return "bg-muted text-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Сборочные накладные</h1>
      </div>
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
            <select
              value={warehouseDraft}
              onChange={(e) => setWarehouseDraft(e.target.value)}
              className="h-8 w-[190px] rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">Склад</option>
              {(warehousesQ.data ?? []).map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </select>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              className="h-8 w-[190px] rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">Статус</option>
              <option value="new">Новый</option>
              <option value="confirmed">Подтвержден</option>
              <option value="picking">В ожидании сборки</option>
              <option value="delivering">Отгружен</option>
              <option value="delivered">Доставлен</option>
              <option value="cancelled">Отменен</option>
            </select>
            <select
              value={expeditorDraft}
              onChange={(e) => setExpeditorDraft(e.target.value)}
              className="h-8 w-[190px] rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="all">Экспедиторы</option>
              {(expeditorsQ.data ?? []).map((ex) => (
                <option key={ex.id} value={String(ex.id)}>{ex.fio}</option>
              ))}
            </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-muted-foreground hover:border-border hover:bg-muted/50"
                  aria-label="Предыдущий период"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  ref={dateRangeAnchorRef}
                  type="button"
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-normal hover:bg-muted/60",
                    dateRangeOpen && "bg-primary/10 text-primary"
                  )}
                  aria-expanded={dateRangeOpen}
                  aria-haspopup="dialog"
                  onClick={() => setDateRangeOpen((o) => !o)}
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{formatDateRangeButton(dateFrom, dateTo)}</span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-muted-foreground hover:border-border hover:bg-muted/50"
                  aria-label="Следующий период"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button size="sm" variant="outline" className="h-8 w-8 px-0">
                <Filter className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-8 bg-teal-700 px-3 text-xs text-white hover:bg-teal-800"
                onClick={() => {
                  setWarehouse(warehouseDraft);
                  setStatus(statusDraft);
                  setExpeditor(expeditorDraft);
                  setSearch(searchDraft);
                }}
              >
                Применить
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 px-0"
                onClick={() => {
                  setWarehouseDraft("all");
                  setStatusDraft("picking");
                  setExpeditorDraft("all");
                  setSearchDraft("");
                  setWarehouse("all");
                  setStatus("picking");
                  setExpeditor("all");
                  setSearch("");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <DateRangePopover
        open={dateRangeOpen}
        onOpenChange={setDateRangeOpen}
        anchorRef={dateRangeAnchorRef}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApply={({ dateFrom: f, dateTo: t }) => {
          setDateFrom(f);
          setDateTo(t);
        }}
      />
      <div className="inline-flex rounded-md border border-border bg-background p-1">
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => setViewMode("list")}
        >
          Список
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs ${viewMode === "summary" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => setViewMode("summary")}
        >
          Суммарная по экспедиторам
        </button>
      </div>
      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
          ) : viewMode === "summary" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead className="app-table-thead text-left">
                  <tr>
                    <th className="px-3 py-2">Экспедитор</th>
                    <th className="px-3 py-2 text-right">№ накладных</th>
                    <th className="px-3 py-2 text-right">Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((r) => (
                    <tr key={r.expeditor} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{r.expeditor}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.docs}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.qty.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summaryRows.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Данные не найдены.</p>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <div className="flex items-center gap-2">
                  <select className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                  </select>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchDraft}
                      onChange={(e) => setSearchDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSearch(searchDraft);
                      }}
                      placeholder="Поиск"
                      className="h-8 w-[180px] pl-7 text-xs"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSearch(searchDraft)}>
                    Поиск
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Всего: {filteredRows.length}</div>
                  <Button size="sm" variant="outline" className="h-8">Excel</Button>
                  <Button size="sm" className="h-8 bg-rose-100 text-rose-700 hover:bg-rose-200">Отменить несколько накладных</Button>
                </div>
              </div>
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="app-table-thead text-left">
                  <tr>
                    <th className="px-3 py-2">Время накладной</th>
                    <th className="px-3 py-2">№ накладной</th>
                    <th className="px-3 py-2">Сборщик</th>
                    <th className="px-3 py-2">Склад</th>
                    <th className="px-3 py-2">Блок склада</th>
                    <th className="px-3 py-2">Экспедитор</th>
                    <th className="px-3 py-2">Дата отправки</th>
                    <th className="px-3 py-2">Дата сбора</th>
                    <th className="px-3 py-2 text-right">Кол-во</th>
                    <th className="px-3 py-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.number}</td>
                      <td className="px-3 py-2">{r.client_name}</td>
                      <td className="px-3 py-2">{r.warehouse_name ?? "—"}</td>
                      <td className="px-3 py-2">{r.warehouse_block_name ?? "—"}</td>
                      <td className="px-3 py-2">{r.expeditor_display ?? "—"}</td>
                      <td className="px-3 py-2">{r.shipped_at ? new Date(r.shipped_at).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.qty}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs ${statusBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Сборочные накладные не найдены.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
