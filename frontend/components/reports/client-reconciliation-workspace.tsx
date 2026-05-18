"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect, type FilterSearchableOption } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReconciliationJson = {
  date_from: string;
  date_to: string;
  generated_at: string;
  tenant: { name: string };
  client: {
    id: number;
    name: string;
    legal_name: string | null;
    client_code: string | null;
    credit_limit: string;
  };
  summary: {
    account_balance_current: string;
    outstanding_orders_total: string;
    opening_balance_movements: string;
    period_movements_net: string;
    closing_balance_movements_at_period_end: string;
    sum_orders_in_period: string;
    sum_payments_in_period: string;
  };
  orders: Array<{
    number: string;
    created_at: string;
    total_sum: string;
    status: string;
    order_type: string;
  }>;
  payments: Array<{
    id: number;
    created_at: string;
    amount: string;
    payment_type: string;
    note: string | null;
    order_number: string | null;
  }>;
  balance_movements: Array<{ created_at: string; delta: string; note: string | null }>;
  chronological: Array<{
    line_type: "order" | "payment" | "balance_movement";
    at: string;
    ref: string;
    debit: string;
    credit: string;
    description: string;
  }>;
  notes: string[];
};

function calendarMonthRange(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` };
}

function parseFilenameFromDisposition(cd: string | undefined): string | null {
  if (!cd) return null;
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
  return m?.[1] ? decodeURIComponent(m[1].trim()) : null;
}

function fmtMoney(s: string): string {
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return formatNumberGrouped(n, { minFractionDigits: 0, maxFractionDigits: 2 });
}

function fmtDt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

function chronoLabel(t: ReconciliationJson["chronological"][number]["line_type"]): string {
  if (t === "order") return "Заказ";
  if (t === "payment") return "Оплата";
  return "Движение л/с";
}

export function ClientReconciliationWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlInit = useRef(false);
  const init = useMemo(() => calendarMonthRange(), []);
  const [clientDraft, setClientDraft] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFromDraft, setDateFromDraft] = useState(init.from);
  const [dateToDraft, setDateToDraft] = useState(init.to);
  const [clientId, setClientId] = useState("");
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [blobErr, setBlobErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("chrono");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(clientSearch.trim()), 300);
    return () => window.clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    if (urlInit.current) return;
    urlInit.current = true;
    const from = searchParams.get("from") ?? searchParams.get("date_from");
    const to = searchParams.get("to") ?? searchParams.get("date_to");
    const cid = searchParams.get("client_id");
    if (from?.trim()) setDateFromDraft(from.trim());
    if (to?.trim()) setDateToDraft(to.trim());
    if (cid?.trim()) {
      setClientDraft(cid.trim());
      setClientId(cid.trim());
    }
  }, [searchParams]);

  const clientsQ = useQuery({
    queryKey: ["reports-reconciliation-clients", tenantSlug, debouncedSearch],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const q = new URLSearchParams({
        page: "1",
        limit: "80",
        sort: "name",
        order: "asc",
        is_active: "true"
      });
      if (debouncedSearch) q.set("search", debouncedSearch);
      const { data } = await api.get<{
        data: Array<{ id: number; name: string; client_code?: string | null }>;
      }>(`/api/${tenantSlug}/clients?${q}`);
      return data.data ?? [];
    }
  });

  const reportQ = useQuery({
    queryKey: ["client-reconciliation", tenantSlug, clientId, dateFrom, dateTo],
    enabled: Boolean(tenantSlug) && hydrated && Boolean(clientId),
    staleTime: STALE.report,
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo
      });
      const { data } = await api.get<ReconciliationJson>(
        `/api/${tenantSlug}/clients/${clientId}/reconciliation?${params}`
      );
      return data;
    }
  });

  const clientOptions: FilterSearchableOption[] = useMemo(() => {
    const rows = (clientsQ.data ?? []).map((c) => ({
      value: String(c.id),
      label: c.client_code ? `${c.name} (${c.client_code})` : c.name
    }));
    const draft = clientDraft.trim();
    if (reportQ.data && draft === String(reportQ.data.client.id)) {
      const p = reportQ.data.client;
      const label = p.client_code ? `${p.name} (${p.client_code})` : p.name;
      if (!rows.some((r) => r.value === draft)) {
        return [{ value: draft, label }, ...rows];
      }
    }
    return rows;
  }, [clientsQ.data, clientDraft, reportQ.data]);

  const apply = useCallback(() => {
    if (!clientDraft) return;
    setClientId(clientDraft);
    setDateFrom(dateFromDraft);
    setDateTo(dateToDraft);
    const q = new URLSearchParams();
    q.set("client_id", clientDraft);
    q.set("from", dateFromDraft);
    q.set("to", dateToDraft);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [clientDraft, dateFromDraft, dateToDraft, pathname, router]);

  const downloadPdf = async () => {
    if (!clientId || !tenantSlug) return;
    setBlobErr(null);
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const res = await api.get<Blob>(
        `/api/${tenantSlug}/clients/${clientId}/reconciliation-pdf?${params}`,
        { responseType: "blob" }
      );
      const ct = String(res.headers["content-type"] ?? "").toLowerCase();
      if (!ct.includes("pdf")) throw new Error("Не удалось сформировать PDF");
      const blob = res.data as Blob;
      const filename =
        parseFilenameFromDisposition(
          typeof res.headers["content-disposition"] === "string"
            ? res.headers["content-disposition"]
            : Array.isArray(res.headers["content-disposition"])
              ? res.headers["content-disposition"][0]
              : undefined
        ) ?? `akt-sverka-client-${clientId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBlobErr(getUserFacingError(e, "Ошибка PDF"));
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadXlsx = async () => {
    if (!clientId || !tenantSlug) return;
    setBlobErr(null);
    setXlsxLoading(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      const res = await api.get<Blob>(
        `/api/${tenantSlug}/clients/${clientId}/reconciliation-xlsx?${params}`,
        { responseType: "blob" }
      );
      const ct = String(res.headers["content-type"] ?? "").toLowerCase();
      if (!ct.includes("spreadsheet") && !ct.includes("octet-stream")) {
        throw new Error("Не удалось сформировать Excel");
      }
      const blob = res.data as Blob;
      const filename =
        parseFilenameFromDisposition(
          typeof res.headers["content-disposition"] === "string"
            ? res.headers["content-disposition"]
            : Array.isArray(res.headers["content-disposition"])
              ? res.headers["content-disposition"][0]
              : undefined
        ) ?? `akt-sverka-client-${clientId}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBlobErr(getUserFacingError(e, "Ошибка Excel"));
    } finally {
      setXlsxLoading(false);
    }
  };

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }
  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    );
  }

  const panelClass =
    "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card dark:shadow-none";
  const payload = reportQ.data;

  return (
    <PageShell className="space-y-4">
      <PageHeader
        className="border-b border-slate-200 pb-4 dark:border-border/70"
        title={<span className="text-slate-900 dark:text-foreground">Акт сверки взаимных расчётов</span>}
        description="По клиенту за период: заказы, оплаты, движения лицевого счёта; PDF и Excel для передачи контрагенту."
      />

      <div className={cn(panelClass, "p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-border/60 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Клиент</Label>
              <FilterSearchableSelect
                emptyLabel="Выберите клиента"
                value={clientDraft}
                onValueChange={setClientDraft}
                options={clientOptions}
                onSearchTextChange={setClientSearch}
                searchPlaceholder="Поиск по имени или коду"
                className={cn(
                  filterPanelSelectClassName,
                  "h-10 border-slate-200 bg-white dark:border-input dark:bg-background"
                )}
                minPopoverWidth={320}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Период</Label>
              <Button
                ref={dateAnchorRef}
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-full min-w-[200px] justify-start gap-2 border-slate-200 bg-white font-normal text-slate-800 shadow-sm dark:border-input dark:bg-background sm:w-auto"
                onClick={() => setDateRangeOpen((o) => !o)}
              >
                <CalendarDays className="size-4 text-slate-500" />
                {formatDateRangeButton(dateFromDraft, dateToDraft)}
              </Button>
              <DateRangePopover
                open={dateRangeOpen}
                onOpenChange={setDateRangeOpen}
                anchorRef={dateAnchorRef}
                dateFrom={dateFromDraft}
                dateTo={dateToDraft}
                onApply={({ dateFrom: f, dateTo: t }) => {
                  setDateFromDraft(f);
                  setDateToDraft(t);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 border-slate-200 bg-white dark:border-input dark:bg-background"
              onClick={() => {
                const r = calendarMonthRange();
                setDateFromDraft(r.from);
                setDateToDraft(r.to);
              }}
            >
              Текущий месяц
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-10 min-w-[7.5rem] bg-teal-600 font-medium text-white shadow-sm hover:bg-teal-700"
              onClick={apply}
              disabled={!clientDraft}
            >
              Применить
            </Button>
          </div>
        </div>

        {clientsQ.isError ? (
          <p className="py-4 text-sm text-destructive">Не удалось загрузить список клиентов.</p>
        ) : null}
        {blobErr ? <p className="py-2 text-sm text-destructive">{blobErr}</p> : null}
        {reportQ.isError ? (
          <p className="py-4 text-sm text-destructive">Не удалось загрузить акт сверки. Проверьте клиента и даты.</p>
        ) : null}

        {!clientId ? (
          <p className="py-8 text-sm text-muted-foreground">Выберите клиента и нажмите «Применить».</p>
        ) : reportQ.isFetching && !payload ? (
          <p className="py-8 text-sm text-muted-foreground">Загрузка…</p>
        ) : payload ? (
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-600 dark:text-muted-foreground">
                <span className="font-medium text-slate-900 dark:text-foreground">{payload.tenant.name}</span>
                {" · "}
                <Link
                  href={`/clients/${payload.client.id}/details`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {payload.client.name}
                </Link>
                {payload.client.client_code ? (
                  <span className="text-muted-foreground"> ({payload.client.client_code})</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={pdfLoading}
                  onClick={() => void downloadPdf()}
                >
                  <FileText className="size-4" />
                  PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 bg-green-600 text-white hover:bg-green-700"
                  disabled={xlsxLoading}
                  onClick={() => void downloadXlsx()}
                >
                  <FileSpreadsheet className="size-4" />
                  Excel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="Обновить"
                  onClick={() => void reportQ.refetch()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Л/с (текущий)", payload.summary.account_balance_current],
                ["Открытые заказы", payload.summary.outstanding_orders_total],
                ["Остаток л/с на начало", payload.summary.opening_balance_movements],
                ["Остаток л/с на конец периода", payload.summary.closing_balance_movements_at_period_end],
                ["Заказы за период", payload.summary.sum_orders_in_period],
                ["Оплаты за период", payload.summary.sum_payments_in_period],
                ["Движения л/с (нетто)", payload.summary.period_movements_net],
                ["Кредитный лимит", payload.client.credit_limit]
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-border dark:bg-muted/25"
                >
                  <p className="text-[11px] font-medium text-slate-500 dark:text-muted-foreground">{label}</p>
                  <p className="text-base font-semibold tabular-nums text-slate-900 dark:text-foreground">
                    {fmtMoney(String(val))}
                  </p>
                </div>
              ))}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="h-9 flex-wrap">
                <TabsTrigger value="chrono">Хронология</TabsTrigger>
                <TabsTrigger value="orders">Заказы ({payload.orders.length})</TabsTrigger>
                <TabsTrigger value="payments">Оплаты ({payload.payments.length})</TabsTrigger>
                <TabsTrigger value="mov">Движения л/с ({payload.balance_movements.length})</TabsTrigger>
                <TabsTrigger value="notes">Примечания</TabsTrigger>
              </TabsList>
              <TabsContent value="chrono" className="mt-3">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-border">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs font-semibold uppercase text-slate-600 dark:border-border dark:bg-muted/50">
                        <th className="px-3 py-2">Тип</th>
                        <th className="px-3 py-2">Дата</th>
                        <th className="px-3 py-2">Документ</th>
                        <th className="px-3 py-2 text-right">Дебет</th>
                        <th className="px-3 py-2 text-right">Кредит</th>
                        <th className="px-3 py-2">Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.chronological.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                            Нет данных за период
                          </td>
                        </tr>
                      ) : (
                        payload.chronological.map((r, i) => (
                          <tr key={`${r.at}-${i}`} className="border-b border-slate-100 dark:border-border">
                            <td className="px-3 py-2">{chronoLabel(r.line_type)}</td>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{fmtDt(r.at)}</td>
                            <td className="px-3 py-2">{r.ref || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.debit)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.credit)}</td>
                            <td className="max-w-[280px] truncate px-3 py-2 text-muted-foreground" title={r.description}>
                              {r.description}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="orders" className="mt-3">
                <SimpleTable
                  headers={["№", "Дата", "Статус", "Тип", "Сумма"]}
                  rows={payload.orders.map((o) => [
                    o.number,
                    fmtDt(o.created_at),
                    o.status,
                    o.order_type,
                    fmtMoney(o.total_sum)
                  ])}
                />
              </TabsContent>
              <TabsContent value="payments" className="mt-3">
                <SimpleTable
                  headers={["ID", "Дата", "Тип", "Заказ", "Сумма", "Примечание"]}
                  rows={payload.payments.map((p) => [
                    String(p.id),
                    fmtDt(p.created_at),
                    p.payment_type,
                    p.order_number ?? "—",
                    fmtMoney(p.amount),
                    p.note ?? "—"
                  ])}
                />
              </TabsContent>
              <TabsContent value="mov" className="mt-3">
                <SimpleTable
                  headers={["Дата", "Delta", "Примечание"]}
                  rows={payload.balance_movements.map((m) => [fmtDt(m.created_at), m.delta, m.note ?? "—"])}
                />
              </TabsContent>
              <TabsContent value="notes" className="mt-3">
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {payload.notes.map((n) => (
                    <li key={n.slice(0, 80)}>{n}</li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs font-semibold uppercase text-slate-600 dark:border-border dark:bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-center text-muted-foreground">
                Нет строк
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-border">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={cn("px-3 py-2", j === r.length - 1 ? "max-w-xs truncate" : "")}
                    title={c.length > 40 ? c : undefined}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
