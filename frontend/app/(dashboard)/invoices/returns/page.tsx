"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

type Row = {
  id: number;
  number: string;
  client_name: string | null;
  order_number?: string | null;
  warehouse_name: string;
  expeditor_display?: string | null;
  status: string;
  refund_amount: string | null;
  created_at: string;
};

export default function ReturnInvoicesPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [warehouseDraft, setWarehouseDraft] = useState("all");
  const [expeditorDraft, setExpeditorDraft] = useState("all");
  const [statusDraft, setStatusDraft] = useState<"all" | "pending" | "posted" | "cancelled">("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [warehouse, setWarehouse] = useState("all");
  const [expeditor, setExpeditor] = useState("all");
  const [status, setStatus] = useState<"all" | "pending" | "posted" | "cancelled">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeAnchorRef = useRef<HTMLButtonElement>(null);

  const warehousesQ = useQuery({
    queryKey: ["return-invoices-warehouses", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data ?? [];
    }
  });
  const expeditorsQ = useQuery({
    queryKey: ["return-invoices-expeditors", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; fio: string }[] }>(`/api/${tenantSlug}/expeditors`);
      return data.data ?? [];
    }
  });

  const listQ = useQuery({
    queryKey: ["return-invoices", tenantSlug, warehouse, expeditor, status, search, dateFrom, dateTo],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (warehouse !== "all") params.set("warehouse_id", warehouse);
      if (expeditor !== "all") params.set("expeditor_id", expeditor);
      if (status !== "all") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const { data } = await api.get<{ data: Row[] }>(`/api/${tenantSlug}/returns?${params.toString()}`);
      return data.data ?? [];
    }
  });
  const rows = listQ.data ?? [];
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.toLowerCase();
    return rows.filter((r) =>
      [r.number, r.client_name ?? "", r.warehouse_name, r.status, r.expeditor_display ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, search]);

  const statusBadgeClass = (v: string) => {
    if (v === "posted") return "bg-emerald-100 text-emerald-700";
    if (v === "pending") return "bg-amber-100 text-amber-700";
    if (v === "cancelled") return "bg-rose-100 text-rose-700";
    return "bg-muted text-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Возвратные накладные</h1>
        <div className="flex items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1">
          <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/50">
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            ref={dateRangeAnchorRef}
            type="button"
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] hover:bg-muted/60",
              dateRangeOpen && "bg-primary/10 text-primary"
            )}
            onClick={() => setDateRangeOpen((o) => !o)}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateRangeButton(dateFrom, dateTo)}
          </button>
          <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/50">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
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
                value={expeditorDraft}
                onChange={(e) => setExpeditorDraft(e.target.value)}
                className="h-8 w-[190px] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">Экспедитор</option>
                {(expeditorsQ.data ?? []).map((ex) => (
                  <option key={ex.id} value={String(ex.id)}>{ex.fio}</option>
                ))}
              </select>
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as "all" | "pending" | "posted" | "cancelled")}
                className="h-8 w-[190px] rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">Статус</option>
                <option value="pending">Ожидает</option>
                <option value="posted">Подтвержден</option>
                <option value="cancelled">Отменен</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8 w-8 px-0">
                <Filter className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-8 bg-teal-700 px-3 text-xs text-white hover:bg-teal-800"
                onClick={() => {
                  setWarehouse(warehouseDraft);
                  setExpeditor(expeditorDraft);
                  setStatus(statusDraft);
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
                  setExpeditorDraft("all");
                  setStatusDraft("all");
                  setSearchDraft("");
                  setWarehouse("all");
                  setExpeditor("all");
                  setStatus("all");
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

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
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
                  <Button size="sm" variant="outline" className="h-8">Excel</Button>
                  <div className="text-xs text-muted-foreground">Всего: {filteredRows.length}</div>
                </div>
              </div>
              <table className="w-full min-w-[1200px] border-collapse text-sm">
                <thead className="app-table-thead text-left">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Дата создания</th>
                    <th className="px-3 py-2">Склад</th>
                    <th className="px-3 py-2">Дата отгрузки</th>
                    <th className="px-3 py-2">Экспедитор</th>
                    <th className="px-3 py-2">Дата подтверждения</th>
                    <th className="px-3 py-2">Подтвержденная дата отправки</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Подтверждение экспедитора</th>
                    <th className="px-3 py-2">Подтверждение складчика</th>
                    <th className="px-3 py-2">Подтверждение оператора</th>
                    <th className="px-3 py-2 text-right">Сумма возврата</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{r.number}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{r.warehouse_name}</td>
                      <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{r.expeditor_display ?? "—"}</td>
                      <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs ${statusBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="px-3 py-2">Нет</td>
                      <td className="px-3 py-2">Да</td>
                      <td className="px-3 py-2">Нет</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.refund_amount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRows.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Возвратные накладные не найдены.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
