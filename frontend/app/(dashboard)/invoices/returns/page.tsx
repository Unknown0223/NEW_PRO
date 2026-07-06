"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RotateCcw,
  Search,
  Smartphone,
  Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { api } from "@/lib/api";
import {
  DailyReturnWaybillModal,
  type DailyWaybillRef
} from "@/components/orders/daily-return-waybill-modal";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

type Row = {
  id: string;
  courier_id: number;
  courier_name: string | null;
  creation_channel: "web" | "mobile";
  date: string;
  created_at: string;
  warehouse_name: string;
  warehouse_count: number;
  return_count: number;
  item_count: number;
  total_qty: number;
  refund_total: string;
  status: "pending" | "posted" | "cancelled";
  pending_count: number;
  accepted_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает приёмки",
  posted: "Принят",
  cancelled: "Отклонён"
};

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

export default function ReturnInvoicesPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const canAccept = isAdminOrOperatorLikeRole(role);
  const hydrated = useAuthStoreHydrated();

  const [openWaybill, setOpenWaybill] = useState<{ ref: DailyWaybillRef; confirm: boolean } | null>(
    null
  );

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
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/warehouses`
      );
      return data.data ?? [];
    }
  });
  const expeditorsQ = useQuery({
    queryKey: ["return-invoices-expeditors", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; fio: string }[] }>(
        `/api/${tenantSlug}/expeditors`
      );
      return data.data ?? [];
    }
  });

  const listQ = useQuery({
    queryKey: ["return-invoices", tenantSlug, warehouse, status, dateFrom, dateTo],
    enabled: Boolean(tenantSlug) && hydrated,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (warehouse !== "all") params.set("warehouse_id", warehouse);
      if (status !== "all") params.set("status", status);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const { data } = await api.get<{ data: Row[] }>(
        `/api/${tenantSlug}/returns/daily-waybills?${params.toString()}`
      );
      return data.data ?? [];
    }
  });

  const selectedExpeditorFio = useMemo(() => {
    if (expeditor === "all") return null;
    return (expeditorsQ.data ?? []).find((e) => String(e.id) === expeditor)?.fio ?? null;
  }, [expeditor, expeditorsQ.data]);

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);
  const filteredRows = useMemo(() => {
    let out = rows;
    if (selectedExpeditorFio) {
      const fio = selectedExpeditorFio.toLowerCase();
      out = out.filter((r) => (r.courier_name ?? "").toLowerCase().includes(fio));
    }
    if (search.trim()) {
      const needle = search.toLowerCase();
      out = out.filter((r) =>
        [r.courier_name ?? "", r.warehouse_name, r.date, STATUS_LABELS[r.status] ?? r.status]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
    return out;
  }, [rows, search, selectedExpeditorFio]);

  const statusBadgeClass = (v: string) => {
    if (v === "posted") return "bg-emerald-100 text-emerald-700";
    if (v === "pending") return "bg-amber-100 text-amber-700";
    if (v === "cancelled") return "bg-rose-100 text-rose-700";
    return "bg-muted text-foreground";
  };

  const applyFilters = () => {
    setWarehouse(warehouseDraft);
    setExpeditor(expeditorDraft);
    setStatus(statusDraft);
    setSearch(searchDraft);
  };
  const resetFilters = () => {
    setWarehouseDraft("all");
    setExpeditorDraft("all");
    setStatusDraft("all");
    setSearchDraft("");
    setWarehouse("all");
    setExpeditor("all");
    setStatus("all");
    setSearch("");
  };

  return (
    <div className="space-y-4">
      {openWaybill && tenantSlug && (
        <DailyReturnWaybillModal
          slug={tenantSlug}
          waybill={openWaybill.ref}
          canAccept={canAccept}
          startInConfirm={openWaybill.confirm}
          onClose={() => setOpenWaybill(null)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Возвратные накладные</h1>
          <p className="text-xs text-muted-foreground">
            Сводные накладные — по каждому экспедитору за день
          </p>
        </div>
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
                <option value="pending">Ожидает приёмки</option>
                <option value="posted">Принят</option>
                <option value="cancelled">Отклонён</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8 w-8 px-0">
                <Filter className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-8 bg-teal-700 px-3 text-xs text-white hover:bg-teal-800"
                onClick={applyFilters}
              >
                Применить
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 px-0" onClick={resetFilters}>
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
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchDraft}
                      onChange={(e) => setSearchDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSearch(searchDraft);
                      }}
                      placeholder="Поиск (экспедитор, склад, дата)"
                      className="h-8 w-[240px] pl-7 text-xs"
                    />
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSearch(searchDraft)}>
                    Поиск
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">Всего: {filteredRows.length}</div>
              </div>
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="app-table-thead text-left">
                  <tr>
                    <th className="px-3 py-2">Дата</th>
                    <th className="px-3 py-2">Экспедитор</th>
                    <th className="px-3 py-2">Источник</th>
                    <th className="px-3 py-2">Склад</th>
                    <th className="px-3 py-2 text-right">Возвратов</th>
                    <th className="px-3 py-2 text-right">Позиций</th>
                    <th className="px-3 py-2 text-right">Кол-во</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Принял зав.склад</th>
                    <th className="px-3 py-2 text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(`${r.date}T00:00:00`).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-3 py-2">{r.courier_name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                          {r.creation_channel === "mobile" ? (
                            <Smartphone className="h-3 w-3" />
                          ) : (
                            <Monitor className="h-3 w-3" />
                          )}
                          {r.creation_channel === "mobile" ? "Моб." : "Веб"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.warehouse_name || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.return_count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.item_count}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtQty(r.total_qty)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs ${statusBadgeClass(r.status)}`}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.status === "posted" ? (
                          <span className="text-emerald-700">
                            Да{r.accepted_at ? ` · ${new Date(r.accepted_at).toLocaleString("ru-RU")}` : ""}
                          </span>
                        ) : r.status === "pending" ? (
                          <span className="text-amber-700">Ожидает</span>
                        ) : (
                          <span className="text-rose-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Просмотр / Печать"
                            aria-label="Просмотр"
                            className="inline-flex h-7 items-center gap-1 rounded border border-input px-2 text-xs hover:bg-muted/60"
                            onClick={() =>
                              setOpenWaybill({
                                ref: {
                                  courier_id: r.courier_id,
                                  courier_name: r.courier_name,
                                  date: r.date,
                                  status: r.status
                                },
                                confirm: false
                              })
                            }
                          >
                            <Eye className="h-3.5 w-3.5" /> Просмотр
                          </button>
                          {canAccept && r.status === "pending" && (
                            <button
                              type="button"
                              title="Подтвердить приёмку"
                              aria-label="Подтвердить"
                              className="inline-flex h-7 items-center gap-1 rounded border border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                              onClick={() =>
                                setOpenWaybill({
                                  ref: {
                                    courier_id: r.courier_id,
                                    courier_name: r.courier_name,
                                    date: r.date,
                                    status: r.status
                                  },
                                  confirm: true
                                })
                              }
                            >
                              <Check className="h-3.5 w-3.5" /> Подтвердить
                            </button>
                          )}
                        </div>
                      </td>
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
