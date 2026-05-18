"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { downloadXlsxWorkbook } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  Filter,
  LayoutGrid,
  RefreshCw,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CashFlowMoney = { terminal: string; cash: string; total: string };

type CashFlowChild = {
  key: string;
  label: string;
  terminal: string;
  cash: string;
  total: string;
};

type CashFlowRow = {
  key: string;
  kind: "opening" | "income" | "expense" | "closing";
  label: string;
  terminal: string;
  cash: string;
  total: string;
  children: CashFlowChild[];
};

type CashFlowPayload = {
  date_from: string;
  date_to: string;
  cash_desk: { id: number; name: string; code?: string | null };
  summary: {
    opening: CashFlowMoney;
    income: CashFlowMoney;
    expense: CashFlowMoney;
    closing: CashFlowMoney;
  };
  payment_type_breakdown: {
    period_income: CashFlowMoney;
    terminal_share_pct: number | null;
    cash_share_pct: number | null;
  };
  opening_hint: {
    last_closed_shift: {
      closed_at: string;
      closing_float: string | null;
      opening_float: string | null;
    } | null;
  };
  data_model_mapping: Array<{ concept: string; source: string; comment?: string }>;
  ledger: { formula: string; closing_equals: string };
  table: { rows: CashFlowRow[] };
  notes: string[];
};

type CashDeskOpt = { id: number; name: string; code?: string | null; sort_order?: number | null };

function pickDefaultDeskId(desks: CashDeskOpt[]): string {
  if (!desks.length) return "";
  const normCode = (s: string) => s.trim().toLowerCase().replace(/-/g, "_");
  const byMainSlug = desks.find((d) => d.code && normCode(d.code) === "asosiy_kassa");
  if (byMainSlug) return String(byMainSlug.id);
  const lower = (s: string) => s.toLowerCase();
  const prefer = desks.find(
    (d) =>
      lower(d.name).includes("asosiy") ||
      lower(d.name).includes("асос") ||
      lower(d.name).includes("основ") ||
      (d.code != null &&
        d.code !== "" &&
        (lower(d.code).includes("asosiy") || normCode(d.code) === "asosiy_kassa"))
  );
  if (prefer) return String(prefer.id);
  const sorted = [...desks].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  return String(sorted[0].id);
}

function calendarMonthRange(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay)}` };
}

function parseMoney(s: string): number {
  const n = Number.parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function cashFlowToCsv(payload: CashFlowPayload): string {
  const sep = ";";
  const lines: string[] = [
    ["Период", `${payload.date_from} — ${payload.date_to}`].join(sep),
    ["Касса", payload.cash_desk.name].join(sep),
    "",
    ["Приход Terminal", payload.payment_type_breakdown.period_income.terminal].join(sep),
    ["Приход Naqd", payload.payment_type_breakdown.period_income.cash].join(sep),
    ["Доля Terminal %", String(payload.payment_type_breakdown.terminal_share_pct ?? "")].join(sep),
    ["Доля Naqd %", String(payload.payment_type_breakdown.cash_share_pct ?? "")].join(sep),
    "",
    ["Статья", "Terminal", "Naqd", "Итого"].join(sep)
  ];
  for (const r of payload.table.rows) {
    lines.push([r.label, r.terminal, r.cash, r.total].join(sep));
    for (const c of r.children) {
      lines.push(["  " + c.label, c.terminal, c.cash, c.total].join(sep));
    }
  }
  return "\uFEFF" + lines.join("\n");
}

async function cashFlowToXlsx(payload: CashFlowPayload): Promise<void> {
  const deskLabel = payload.cash_desk.code
    ? `${payload.cash_desk.name} (${payload.cash_desk.code})`
    : payload.cash_desk.name;
  const summaryKv: (string | number)[][] = [
    ["Период", `${payload.date_from} — ${payload.date_to}`],
    ["Касса", deskLabel],
    ["", ""],
    ["Остаток на начало (итого)", payload.summary.opening.total],
    ["  Terminal", payload.summary.opening.terminal],
    ["  Naqd", payload.summary.opening.cash],
    ["", ""],
    ["Приход (итого)", payload.summary.income.total],
    ["  Terminal", payload.summary.income.terminal],
    ["  Naqd", payload.summary.income.cash],
    ["", ""],
    ["Расход (итого)", payload.summary.expense.total],
    ["  Terminal", payload.summary.expense.terminal],
    ["  Naqd", payload.summary.expense.cash],
    ["", ""],
    ["Остаток на конец (итого)", payload.summary.closing.total],
    ["  Terminal", payload.summary.closing.terminal],
    ["  Naqd", payload.summary.closing.cash],
    ["", ""],
    ["Доля Terminal в приходе, %", payload.payment_type_breakdown.terminal_share_pct ?? "—"],
    ["Доля Naqd в приходе, %", payload.payment_type_breakdown.cash_share_pct ?? "—"]
  ];
  const tableRows: (string | number)[][] = [];
  for (const r of payload.table.rows) {
    tableRows.push([r.label, r.terminal, r.cash, r.total]);
    for (const c of r.children) {
      tableRows.push([`  ${c.label}`, c.terminal, c.cash, c.total]);
    }
  }
  await downloadXlsxWorkbook(`cash-flow-${payload.date_from}_${payload.date_to}.xlsx`, [
    { name: "Сводка", headers: ["Показатель", "Значение"], rows: summaryKv, colWidths: [32, 22] },
    {
      name: "ДДС таблица",
      headers: ["Статья", "Terminal", "Naqd", "Итого"],
      rows: tableRows,
      colWidths: [36, 14, 14, 14]
    }
  ]);
}

const RELATED_LINKS: { href: string; label: string }[] = [
  { href: "/payments", label: "Оплаты клиентов" },
  { href: "/client-expenses", label: "Расходы клиента" },
  { href: "/expenses", label: "Расходы" },
  { href: "/initial-client-balances", label: "Начальные балансы" },
  { href: "/reports", label: "Отчёт по приходам" },
  { href: "/reports/order-debts", label: "Долги по заказам" },
  { href: "/settings/cash-desks", label: "Настройки касс" }
];

function childRowSourceLink(key: string): string | null {
  if (key === "in-client" || key === "in-other") return "/payments";
  if (key === "ex-client") return "/client-expenses";
  if (key.startsWith("exp-comp-")) return "/expenses";
  return null;
}

export function CashFlowWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlInitDone = useRef(false);
  const init = useMemo(() => calendarMonthRange(), []);
  const [deskDraft, setDeskDraft] = useState<string>("");
  const [dateFromDraft, setDateFromDraft] = useState(init.from);
  const [dateToDraft, setDateToDraft] = useState(init.to);
  const [desk, setDesk] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["income", "expense"]));
  const [exportBusy, setExportBusy] = useState(false);

  const desksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "cash-flow"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskOpt[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      let rows = data.data ?? [];
      if (rows.length === 0) {
        const { data: data2 } = await api.get<{ data: CashDeskOpt[] }>(
          `/api/${tenantSlug}/cash-desks?limit=200&page=1`
        );
        rows = data2.data ?? [];
      }
      return rows;
    }
  });

  const reportQ = useQuery({
    queryKey: ["cash-flow", tenantSlug, desk, dateFrom, dateTo],
    enabled: Boolean(tenantSlug) && hydrated && Boolean(desk) && Boolean(dateFrom) && Boolean(dateTo),
    staleTime: STALE.report,
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
        cash_desk_id: desk
      });
      const { data } = await api.get<CashFlowPayload>(`/api/${tenantSlug}/reports/cash-flow?${params.toString()}`);
      return data;
    }
  });

  const apply = useCallback(() => {
    if (!deskDraft) return;
    setDesk(deskDraft);
    setDateFrom(dateFromDraft);
    setDateTo(dateToDraft);
    const q = new URLSearchParams();
    q.set("cash_desk_id", deskDraft);
    q.set("from", dateFromDraft);
    q.set("to", dateToDraft);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }, [deskDraft, dateFromDraft, dateToDraft, pathname, router]);

  /** Bir marta: URL → draft (ulashish / bookmark) */
  useEffect(() => {
    if (urlInitDone.current) return;
    urlInitDone.current = true;
    const from = searchParams.get("from") ?? searchParams.get("date_from");
    const to = searchParams.get("to") ?? searchParams.get("date_to");
    const cd = searchParams.get("cash_desk_id");
    if (from?.trim()) setDateFromDraft(from.trim());
    if (to?.trim()) setDateToDraft(to.trim());
    if (cd?.trim()) setDeskDraft(cd.trim());
  }, [searchParams]);

  /** Kassalar kelgach: tanlov + dastlabki hisobot («Применить»siz) */
  useEffect(() => {
    const list = desksQ.data;
    if (!list?.length) return;

    const inList = (id: string) => list.some((d) => String(d.id) === id);
    const validDraft =
      deskDraft !== "" && inList(deskDraft) ? deskDraft : pickDefaultDeskId(list);

    if (deskDraft !== validDraft) {
      setDeskDraft(validDraft);
    }

    if (validDraft && desk === "") {
      setDesk(validDraft);
      setDateFrom(dateFromDraft);
      setDateTo(dateToDraft);
      const q = new URLSearchParams();
      q.set("cash_desk_id", validDraft);
      q.set("from", dateFromDraft);
      q.set("to", dateToDraft);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [desksQ.data, deskDraft, desk, dateFromDraft, dateToDraft, pathname, router]);

  const reset = useCallback(() => {
    const r = calendarMonthRange();
    setDateFromDraft(r.from);
    setDateToDraft(r.to);
    const idStr = desksQ.data?.length ? pickDefaultDeskId(desksQ.data) : "";
    setDeskDraft(idStr);
    setDesk(idStr);
    setDateFrom(r.from);
    setDateTo(r.to);
    if (idStr) {
      const q = new URLSearchParams();
      q.set("cash_desk_id", idStr);
      q.set("from", r.from);
      q.set("to", r.to);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    } else {
      router.replace(pathname, { scroll: false });
    }
  }, [desksQ.data, pathname, router]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportCsv = () => {
    const p = reportQ.data;
    if (!p) return;
    const blob = new Blob([cashFlowToCsv(p)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-flow-${p.date_from}_${p.date_to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const p = reportQ.data;
    if (!p) return;
    setExportBusy(true);
    try {
      await cashFlowToXlsx(p);
    } finally {
      setExportBusy(false);
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

  const desks = desksQ.data ?? [];
  const payload = reportQ.data;

  const panelClass =
    "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card dark:shadow-none";

  return (
    <PageShell className="space-y-4">
      <PageHeader
        className="border-b border-slate-200 pb-4 dark:border-border/70"
        title={<span className="text-slate-900 dark:text-foreground">Движение денежных средств</span>}
        description="Фильтр: from, to, cash_desk_id или cashbox_id (код кассы, напр. asosiy_kassa). Остаток на начало — сумма подтверждённых движений по кассе до периода; приход/расход — в периоде; закрытие = начало + приход − расход (по Terminal и Naqd отдельно)."
      />

      <div className={cn(panelClass, "p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-border/60 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Касса</Label>
            <select
              className={cn(
                filterPanelSelectClassName,
                "h-10 min-w-[min(100%,240px)] bg-white text-slate-900 shadow-sm dark:bg-background sm:min-w-[260px]",
                "border-slate-200 focus:border-teal-500 focus:ring-teal-500/20 dark:border-input"
              )}
              value={deskDraft}
              onChange={(e) => setDeskDraft(e.target.value)}
            >
              <option value="">—</option>
              {desks.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code ? `${d.name} (${d.code})` : d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Период</Label>
              <Button
                ref={dateAnchorRef}
                type="button"
                variant="outline"
                size="sm"
                className="h-10 min-w-[220px] justify-start gap-2 border-slate-200 bg-white font-normal text-slate-800 shadow-sm dark:border-input dark:bg-background dark:text-foreground"
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
            <details className="relative">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-input dark:bg-background [&::-webkit-details-marker]:hidden">
                <Filter className="size-4" aria-hidden />
                <span className="sr-only">Связанные разделы</span>
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-border dark:bg-popover">
                <p className="mb-2 font-medium text-slate-700 dark:text-foreground">Связанные разделы</p>
                <div className="flex flex-col gap-1">
                  {RELATED_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-foreground dark:hover:bg-muted"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </details>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 gap-1 border-slate-200 bg-white px-2 text-slate-600 shadow-sm dark:border-input dark:bg-background"
              onClick={reset}
              title="Сброс периода и кассы"
            >
              <RefreshCw className="size-4" />
              <span className="hidden sm:inline">Сброс</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-10 min-w-[7.5rem] bg-teal-600 font-medium text-white shadow-sm hover:bg-teal-700 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
              onClick={apply}
              disabled={!deskDraft}
            >
              Применить
            </Button>
          </div>
        </div>

      {desksQ.isError ? (
        <p className="py-6 text-sm text-destructive">
          Не удалось загрузить список касс. Проверьте права доступа или откройте{" "}
          <Link href="/settings/cash-desks" className="underline">
            Настройки → Кассы
          </Link>
          .
        </p>
      ) : null}

      {desksQ.isSuccess && desks.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Кассы не найдены. Создайте кассу в{" "}
          <Link href="/settings/cash-desks" className="font-medium text-primary underline">
            Настройки → Кассы
          </Link>
          , затем обновите страницу.
        </p>
      ) : null}

      {reportQ.isError ? (
        <p className="text-sm text-destructive">Не удалось загрузить отчёт. Проверьте кассу и даты.</p>
      ) : null}

      {payload ? (
        <div className="space-y-4 pt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
            Сводка за период
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-border dark:bg-muted/20">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-teal-500 text-white shadow-sm dark:bg-teal-600">
                  <Wallet className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Остаток на начало</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-foreground">
                    {formatNumberGrouped(payload.summary.opening.total, { minFractionDigits: 0, maxFractionDigits: 0 })}
                  </p>
                  <div className="mt-2 space-y-0.5 border-t border-slate-200/80 pt-2 text-[11px] dark:border-border/60">
                    <div className="flex justify-between gap-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="size-3 opacity-70" />
                        Terminal
                      </span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.opening.terminal, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-muted-foreground">
                      <span>Naqd</span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.opening.cash, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  {payload.opening_hint?.last_closed_shift?.closing_float != null ? (
                    <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-muted-foreground">
                      Последняя смена до периода: остаток в смене{" "}
                      {formatNumberGrouped(payload.opening_hint.last_closed_shift.closing_float, {
                        minFractionDigits: 0,
                        maxFractionDigits: 0
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200/80 dark:bg-background dark:text-emerald-400 dark:ring-emerald-800">
                  <ArrowDownLeft className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-emerald-900/80 dark:text-emerald-200/90">Приходы</p>
                  <p className="text-xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                    {formatNumberGrouped(payload.summary.income.total, { minFractionDigits: 0, maxFractionDigits: 0 })}
                  </p>
                  <div className="mt-2 space-y-0.5 border-t border-emerald-200/60 pt-2 text-[11px] dark:border-emerald-800/50">
                    <div className="flex justify-between gap-2 text-emerald-900/75 dark:text-emerald-200/80">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="size-3 opacity-70" />
                        Terminal
                      </span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.income.terminal, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-emerald-900/75 dark:text-emerald-200/80">
                      <span>Naqd</span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.income.cash, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-rose-200/80 bg-rose-50/90 p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-rose-600 shadow-sm ring-1 ring-rose-200/80 dark:bg-background dark:text-rose-400 dark:ring-rose-800">
                  <ArrowUpRight className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-rose-900/80 dark:text-rose-200/90">Расходы</p>
                  <p className="text-xl font-semibold tabular-nums text-rose-900 dark:text-rose-100">
                    {formatNumberGrouped(payload.summary.expense.total, { minFractionDigits: 0, maxFractionDigits: 0 })}
                  </p>
                  <div className="mt-2 space-y-0.5 border-t border-rose-200/60 pt-2 text-[11px] dark:border-rose-800/50">
                    <div className="flex justify-between gap-2 text-rose-900/75 dark:text-rose-200/80">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="size-3 opacity-70" />
                        Terminal
                      </span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.expense.terminal, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-rose-900/75 dark:text-rose-200/80">
                      <span>Naqd</span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.expense.cash, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-border dark:bg-muted/20">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-teal-500 text-white shadow-sm dark:bg-teal-600">
                  <Wallet className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Остаток на конец</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-foreground">
                    {formatNumberGrouped(payload.summary.closing.total, { minFractionDigits: 0, maxFractionDigits: 0 })}
                  </p>
                  <div className="mt-2 space-y-0.5 border-t border-slate-200/80 pt-2 text-[11px] dark:border-border/60">
                    <div className="flex justify-between gap-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="size-3 opacity-70" />
                        Terminal
                      </span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.closing.terminal, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-muted-foreground">
                      <span>Naqd</span>
                      <span className="tabular-nums">
                        {formatNumberGrouped(payload.summary.closing.cash, { minFractionDigits: 0, maxFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Приход за период: Terminal / Naqd
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-foreground">
                    <CreditCard className="size-4 text-blue-600 dark:text-blue-400" />
                    Terminal
                  </span>
                  {payload.payment_type_breakdown.terminal_share_pct != null ? (
                    <span className="text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {payload.payment_type_breakdown.terminal_share_pct}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-foreground">
                  {formatNumberGrouped(payload.payment_type_breakdown.period_income.terminal, {
                    minFractionDigits: 0,
                    maxFractionDigits: 0
                  })}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-border dark:bg-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-foreground">Naqd</span>
                  {payload.payment_type_breakdown.cash_share_pct != null ? (
                    <span className="text-xs font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                      {payload.payment_type_breakdown.cash_share_pct}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-foreground">
                  {formatNumberGrouped(payload.payment_type_breakdown.period_income.cash, {
                    minFractionDigits: 0,
                    maxFractionDigits: 0
                  })}
                </p>
              </div>
            </div>
            {(() => {
              const t = parseMoney(payload.payment_type_breakdown.period_income.terminal);
              const c = parseMoney(payload.payment_type_breakdown.period_income.cash);
              const tot = t + c;
              if (tot <= 0) return null;
              const wT = (t / tot) * 100;
              const wC = (c / tot) * 100;
              return (
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-muted">
                  <div
                    className="h-full bg-blue-600 transition-[width] dark:bg-blue-500"
                    style={{ width: `${wT}%` }}
                    title={`Terminal ${wT.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-teal-500 transition-[width] dark:bg-teal-600"
                    style={{ width: `${wC}%` }}
                    title={`Naqd ${wC.toFixed(1)}%`}
                  />
                </div>
              );
            })()}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-2 py-2 dark:border-border dark:bg-card">
              <div className="flex gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-slate-600 hover:bg-slate-100 dark:hover:bg-muted"
                  aria-label="Развернуть все группы"
                  onClick={() => setExpanded(new Set(["income", "expense"]))}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-slate-600 hover:bg-slate-100 dark:hover:bg-muted"
                  aria-label="Свернуть все группы"
                  onClick={() => setExpanded(new Set())}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-slate-600 hover:bg-slate-100 dark:hover:bg-muted"
                  aria-label="Обновить таблицу"
                  onClick={() => void reportQ.refetch()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={exportCsv}
                  title="Экспорт в CSV (UTF-8)"
                >
                  CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 bg-green-600 px-3 text-xs font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
                  disabled={exportBusy}
                  onClick={() => void exportExcel()}
                >
                  <Download className="size-3.5" />
                  {exportBusy ? "…" : "Excel"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-border dark:bg-muted/50 dark:text-muted-foreground">
                      <th className="px-3 py-2.5">Статья движения денежных средств</th>
                      <th className="px-3 py-2.5 text-right tabular-nums">Terminal</th>
                      <th className="px-3 py-2.5 text-right tabular-nums">Naqd</th>
                      <th className="px-3 py-2.5 text-right tabular-nums">Общий итог</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.table.rows.map((row) => {
                      const isIncome = row.kind === "income";
                      const isExpense = row.kind === "expense";
                      const rowBg =
                        isIncome ? "bg-emerald-50 dark:bg-emerald-950/30" : isExpense ? "bg-rose-50 dark:bg-rose-950/30" : "bg-white dark:bg-background";
                      const hasChildren = row.children.length > 0;
                      const open = expanded.has(row.key);
                      return (
                        <Fragment key={row.key}>
                          <tr className={cn("border-b border-border/40", rowBg)}>
                            <td className="px-3 py-2.5 font-medium">
                              <div className="flex items-center gap-1">
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted/80"
                                    aria-expanded={open}
                                    onClick={() => toggleExpand(row.key)}
                                  >
                                    {open ? (
                                      <ChevronDown className={cn("size-4", isIncome && "text-emerald-700", isExpense && "text-red-700")} />
                                    ) : (
                                      <ChevronRight className="size-4 opacity-60" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="inline-block w-7" />
                                )}
                                {row.label}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatNumberGrouped(row.terminal, { minFractionDigits: 0, maxFractionDigits: 0 })}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatNumberGrouped(row.cash, { minFractionDigits: 0, maxFractionDigits: 0 })}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                              {formatNumberGrouped(row.total, { minFractionDigits: 0, maxFractionDigits: 0 })}
                            </td>
                          </tr>
                          {hasChildren && open
                            ? row.children.map((c) => {
                                const src = childRowSourceLink(c.key);
                                return (
                                <tr key={`${row.key}-${c.key}`} className="border-b border-slate-100 bg-slate-50/80 dark:border-border dark:bg-muted/20">
                                  <td className="px-3 py-2 pl-12 text-muted-foreground">
                                    {src ? (
                                      <Link href={src} className="text-primary underline hover:text-primary/90">
                                        {c.label}
                                      </Link>
                                    ) : (
                                      c.label
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                    {formatNumberGrouped(c.terminal, { minFractionDigits: 0, maxFractionDigits: 0 })}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                    {formatNumberGrouped(c.cash, { minFractionDigits: 0, maxFractionDigits: 0 })}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                    {formatNumberGrouped(c.total, { minFractionDigits: 0, maxFractionDigits: 0 })}
                                  </td>
                                </tr>
                              );
                              })
                            : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          <details className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs dark:border-border dark:bg-muted/30">
            <summary className="cursor-pointer list-none font-medium text-slate-700 dark:text-foreground [&::-webkit-details-marker]:hidden">
              Дополнительно: ledger и источники данных
            </summary>
            <div className="mt-3 space-y-3 text-slate-600 dark:text-muted-foreground">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">Ledger</p>
                <p>{payload.ledger.formula}</p>
                <p className="mt-1">{payload.ledger.closing_equals}</p>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                  Спецификация ↔ модель
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {payload.data_model_mapping.map((m) => (
                    <li key={m.concept}>
                      <span className="font-medium text-slate-800 dark:text-foreground/90">{m.concept}</span> —{" "}
                      <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px] dark:bg-muted">{m.source}</code>
                      {m.comment ? <span> — {m.comment}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {payload.notes.map((n) => (
              <li key={n.slice(0, 48)}>{n}</li>
            ))}
          </ul>
        </div>
      ) : desksQ.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Загрузка касс…</p>
      ) : reportQ.isFetching ? (
        <p className="py-8 text-sm text-muted-foreground">Загрузка отчёта…</p>
      ) : desks.length === 0 ? null : (
        <p className="py-8 text-sm text-muted-foreground">Выберите кассу и нажмите «Применить».</p>
      )}
      </div>
    </PageShell>
  );
}
