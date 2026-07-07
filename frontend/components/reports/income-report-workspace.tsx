"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { formatNumberGrouped } from "@/lib/format-numbers";
import {
  activePaymentMethodEntries,
  paymentMethodDbValue,
  type ProfilePaymentMethodEntry
} from "@/lib/payment-method-options";
import { STALE } from "@/lib/query-stale";
import { quickRangeToDates } from "@/components/dashboard/shared/date-ranges";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronRight, Download, Filter, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Option = { id: number; name: string };
type FilterOptions = {
  agents: Option[];
  expeditors: Option[];
  cashDesks: Option[];
  categories: string[];
  paymentMethods?: Array<{ value: string; label: string }>;
  paymentTypes: string[];
  tradeDirections: string[];
  territories1: string[];
  territories2: string[];
  territories3: string[];
  territory2By1?: Record<string, string[]>;
  territory3By2?: Record<string, string[]>;
  citiesByZoneRegion?: Record<string, string[]>;
  territory3By12?: Record<string, string[]>;
};
type ReportData = {
  summary: {
    total: number;
    by_payment_method?: Array<{ key: string; label: string; amount: number }>;
    items: Array<{ key: string; amount: number }>;
  };
  paymentTypeLabels?: Record<string, string>;
  paymentTypeKeys?: string[];
  period: Array<{ payment_type: string; amount: number }>;
  territories: Array<{ territory: string; byType: Record<string, number>; total: number }>;
  clients: Array<{ client_id: number; client_name: string; agent_name: string; territory: string; byType: Record<string, number>; total: number }>;
  agents: Array<{ agent_id: number; agent_name: string; byType: Record<string, number>; total: number }>;
};

type ReportFilters = {
  from: string;
  to: string;
  requestType: "regular" | "consignment" | "all";
  expeditorId: string;
  agentId: string;
  cashDeskId: string;
  category: string;
  paymentType: string;
  tradeDirection: string;
  t1: string;
  t2: string;
  t3: string;
};

const fmt = (n: number | string) => formatNumberGrouped(n, { minFractionDigits: 0, maxFractionDigits: 0 });
const SUMMARY_CARD_TONES = [
  "border-rose-300 bg-rose-50/40",
  "border-emerald-300 bg-emerald-50/40",
  "border-amber-300 bg-amber-50/40",
  "border-border bg-muted/40",
  "border-indigo-300 bg-indigo-50/40",
  "border-cyan-300 bg-cyan-50/40",
  "border-violet-300 bg-violet-50/40",
  "border-zinc-300 bg-zinc-50/40"
] as const;

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function IncomeReportWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const enabled = Boolean(tenantSlug && hydrated);
  const defaultFilters: ReportFilters = useMemo(() => {
    const range = quickRangeToDates("last30") ?? {
      from: new Date().toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10)
    };
    return {
      from: range.from,
      to: range.to,
      requestType: "all",
      expeditorId: "",
      agentId: "",
      cashDeskId: "",
      category: "",
      paymentType: "",
      tradeDirection: "",
      t1: "",
      t2: "",
      t3: ""
    };
  }, []);
  const [draft, setDraft] = useState<ReportFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(defaultFilters);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [openSection, setOpenSection] = useState<"period" | "territory" | "clients" | "agents" | null>("period");
  const [tableSearch, setTableSearch] = useState<Record<"period" | "territory" | "clients" | "agents", string>>({
    period: "",
    territory: "",
    clients: "",
    agents: ""
  });
  const [tablePageSize, setTablePageSize] = useState<Record<"period" | "territory" | "clients" | "agents", number>>({
    period: 10,
    territory: 10,
    clients: 10,
    agents: 10
  });
  const [tablePage, setTablePage] = useState<Record<"period" | "territory" | "clients" | "agents", number>>({
    period: 1,
    territory: 1,
    clients: 1,
    agents: 1
  });

  const optionsQ = useQuery({
    queryKey: ["income-report-options", tenantSlug],
    enabled,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptions }>(`/api/${tenantSlug}/reports/income-report/filter-options`);
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "income-report-methods"],
    enabled,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { payment_method_entries?: ProfilePaymentMethodEntry[]; payment_types?: string[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const query = useMemo(() => {
    const p = new URLSearchParams({
      from: appliedFilters.from,
      to: appliedFilters.to,
      request_type: appliedFilters.requestType
    });
    if (appliedFilters.expeditorId) p.set("expeditor_id", appliedFilters.expeditorId);
    if (appliedFilters.agentId) p.set("agent_id", appliedFilters.agentId);
    if (appliedFilters.cashDeskId) p.set("cash_desk_id", appliedFilters.cashDeskId);
    if (appliedFilters.category) p.set("client_category", appliedFilters.category);
    if (appliedFilters.paymentType) p.set("payment_type", appliedFilters.paymentType);
    if (appliedFilters.tradeDirection) p.set("trade_direction", appliedFilters.tradeDirection);
    if (appliedFilters.t1) p.set("territory_1", appliedFilters.t1);
    if (appliedFilters.t2) p.set("territory_2", appliedFilters.t2);
    if (appliedFilters.t3) p.set("territory_3", appliedFilters.t3);
    return p.toString();
  }, [appliedFilters]);

  const territory2Options = useMemo(() => {
    const by1 = optionsQ.data?.territory2By1 ?? {};
    if (draft.t1 && by1[draft.t1]) return by1[draft.t1];
    return optionsQ.data?.territories2 ?? [];
  }, [optionsQ.data, draft.t1]);

  const territory3Options = useMemo(() => {
    const byZoneRegion = optionsQ.data?.citiesByZoneRegion ?? optionsQ.data?.territory3By12 ?? {};
    const byRegion = optionsQ.data?.territory3By2 ?? {};
    if (draft.t1 && draft.t2 && byZoneRegion[`${draft.t1}|||${draft.t2}`]) return byZoneRegion[`${draft.t1}|||${draft.t2}`];
    if (draft.t1 && draft.t2 && byZoneRegion[`${draft.t1}||${draft.t2}`]) return byZoneRegion[`${draft.t1}||${draft.t2}`];
    if (draft.t2 && byRegion[draft.t2]) return byRegion[draft.t2];
    if (draft.t1 && !draft.t2) {
      const keys = Object.keys(byZoneRegion).filter((k) => k.startsWith(`${draft.t1}|||`) || k.startsWith(`${draft.t1}||`));
      return Array.from(new Set(keys.flatMap((k) => byZoneRegion[k] ?? []))).sort();
    }
    return optionsQ.data?.territories3 ?? [];
  }, [optionsQ.data, draft.t1, draft.t2]);

  const reportQ = useQuery({
    queryKey: ["income-report-data", tenantSlug, query],
    enabled,
    staleTime: STALE.report,
    queryFn: async () => {
      const { data } = await api.get<{ data: ReportData }>(`/api/${tenantSlug}/reports/income-report?${query}`);
      return data.data;
    }
  });

  const exportSheet = async (kind: "period" | "territory" | "clients" | "agents") => {
    if (!tenantSlug) return;
    const res = await api.get<Blob>(`/api/${tenantSlug}/reports/income-report/export/${kind}?${query}`, { responseType: "blob" });
    const names: Record<typeof kind, string> = {
      period: "Отчёт по поступлениям (Поступления за период).xlsx",
      territory: "Отчёт по поступлениям (По территории).xlsx",
      clients: "Отчёт по поступлениям (Поступления по клиентам).xlsx",
      agents: "Отчёт по поступлениям (По агентам).xlsx"
    };
    downloadBlob(res.data as Blob, names[kind]);
  };

  const data = reportQ.data;
  const paymentTypeLabels = useMemo(() => data?.paymentTypeLabels ?? {}, [data?.paymentTypeLabels]);

  const tenantPaymentCatalog = useMemo(() => {
    const fromProfile = activePaymentMethodEntries(profileQ.data).map((e) => ({
      key: paymentMethodDbValue(e),
      label: e.name.trim()
    }));
    if (fromProfile.length > 0) return fromProfile;
    const fromFilter = optionsQ.data?.paymentMethods ?? [];
    if (fromFilter.length > 0) {
      return fromFilter.map((m) => ({ key: m.value, label: m.label }));
    }
    return [];
  }, [profileQ.data, optionsQ.data?.paymentMethods]);

  const paymentMethodOptions = useMemo(() => {
    if (tenantPaymentCatalog.length > 0) {
      return tenantPaymentCatalog.map((c) => ({ value: c.key, label: c.label }));
    }
    return (optionsQ.data?.paymentTypes ?? []).map((value) => ({
      value,
      label: paymentTypeLabels[value] ?? value
    }));
  }, [tenantPaymentCatalog, optionsQ.data?.paymentTypes, paymentTypeLabels]);

  const summaryPaymentMethods = useMemo(() => {
    if (!data) return [];
    if (data.summary.by_payment_method?.length) {
      return data.summary.by_payment_method;
    }
    const amountByKey = new Map<string, number>();
    for (const row of data.period ?? []) {
      amountByKey.set(row.payment_type, row.amount);
    }
    if (tenantPaymentCatalog.length > 0) {
      return tenantPaymentCatalog.map(({ key, label }) => ({
        key,
        label,
        amount: amountByKey.get(key) ?? 0
      }));
    }
    return (data.period ?? [])
      .filter((r) => r.amount > 0)
      .map((r) => ({
        key: r.payment_type,
        label: paymentTypeLabels[r.payment_type] ?? r.payment_type,
        amount: r.amount
      }));
  }, [data, tenantPaymentCatalog, paymentTypeLabels]);

  const paymentColumns = useMemo(() => {
    if (!data) return [];
    const catalogKeys = tenantPaymentCatalog.map((c) => c.key);
    if (catalogKeys.length > 0) return catalogKeys;
    if (data.paymentTypeKeys?.length) return data.paymentTypeKeys;
    return Array.from(new Set((data.period ?? []).map((r) => r.payment_type)));
  }, [data, tenantPaymentCatalog]);

  const periodDisplayRows = useMemo(() => {
    if (!data) return [];
    const catalogKeys = new Set(tenantPaymentCatalog.map((c) => c.key));
    return (data.period ?? [])
      .filter((r) => r.amount > 0 && (catalogKeys.size === 0 || catalogKeys.has(r.payment_type)))
      .map((r) => ({
        ...r,
        label:
          paymentTypeLabels[r.payment_type] ??
          tenantPaymentCatalog.find((c) => c.key === r.payment_type)?.label ??
          r.payment_type
      }));
  }, [data, tenantPaymentCatalog, paymentTypeLabels]);

  const filteredData = useMemo(() => {
    if (!data) {
      return { period: [], territory: [], clients: [], agents: [] };
    }
    const s = {
      period: tableSearch.period.trim().toLowerCase(),
      territory: tableSearch.territory.trim().toLowerCase(),
      clients: tableSearch.clients.trim().toLowerCase(),
      agents: tableSearch.agents.trim().toLowerCase()
    };
    return {
      period: periodDisplayRows.filter((r) => !s.period || r.label.toLowerCase().includes(s.period)),
      territory: data.territories.filter((r) => !s.territory || r.territory.toLowerCase().includes(s.territory)),
      clients: data.clients.filter((r) => {
        if (!s.clients) return true;
        return (
          String(r.client_id).includes(s.clients) ||
          r.client_name.toLowerCase().includes(s.clients) ||
          r.agent_name.toLowerCase().includes(s.clients) ||
          r.territory.toLowerCase().includes(s.clients)
        );
      }),
      agents: data.agents.filter((r) => {
        if (!s.agents) return true;
        return String(r.agent_id).includes(s.agents) || r.agent_name.toLowerCase().includes(s.agents);
      })
    };
  }, [data, tableSearch, periodDisplayRows]);

  const paginate = <T,>(rows: T[], key: "period" | "territory" | "clients" | "agents") => {
    const pageSize = tablePageSize[key];
    const page = tablePage[key];
    const total = rows.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, maxPage);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return { rows: rows.slice(start, end), total, page: safePage, maxPage };
  };

  return (
    <PageShell>
      <PageHeader title="Отчёт по приходам" description="Касса bo‘yicha kirimlar hisobotlari" />
      <Card className="shadow-panel">
        <CardContent className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="w-[11rem] min-w-[11rem]">
              <FilterSearchableSelect
                emptyLabel="Обе"
                value={draft.requestType}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    requestType: (value || "all") as ReportFilters["requestType"]
                  }))
                }
                options={[
                  { value: "all", label: "Обе" },
                  { value: "regular", label: "Обычная" },
                  { value: "consignment", label: "Для консигнации" }
                ]}
                searchable={false}
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <button
              ref={dateAnchorRef}
              type="button"
              className="inline-flex h-9 min-w-[16rem] items-center justify-between rounded-md border bg-background px-2.5 text-sm"
              onClick={() => setDateRangeOpen((v) => !v)}
            >
              <span className="truncate">{formatDateRangeButton(draft.from, draft.to)}</span>
              <CalendarDays className="size-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-6">
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Экспедитор"
                value={draft.expeditorId}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, expeditorId: value }))}
                options={(optionsQ.data?.expeditors ?? []).map((x) => ({ value: String(x.id), label: x.name }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Агент"
                value={draft.agentId}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, agentId: value }))}
                options={(optionsQ.data?.agents ?? []).map((x) => ({ value: String(x.id), label: x.name }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                placeholderLabel="Касса"
                emptyLabel="Все"
                value={draft.cashDeskId}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, cashDeskId: value }))}
                options={(optionsQ.data?.cashDesks ?? []).map((x) => ({ value: String(x.id), label: x.name }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Категория клиента"
                value={draft.category}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value }))}
                options={(optionsQ.data?.categories ?? []).map((x) => ({ value: x, label: x }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Способ оплаты"
                value={draft.paymentType}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, paymentType: value }))}
                options={paymentMethodOptions.map((x) => ({ value: x.value, label: x.label }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Направление торговли"
                value={draft.tradeDirection}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, tradeDirection: value }))}
                options={(optionsQ.data?.tradeDirections ?? []).map((x) => ({ value: x, label: x }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Зона"
                value={draft.t1}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, t1: value, t2: "", t3: "" }))}
                options={(optionsQ.data?.territories1 ?? []).map((x) => ({ value: x, label: x }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Область"
                value={draft.t2}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, t2: value, t3: "" }))}
                options={territory2Options.map((x) => ({ value: x, label: x }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="w-full min-w-0">
              <FilterSearchableSelect
                emptyLabel="Город"
                value={draft.t3}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, t3: value }))}
                options={territory3Options.map((x) => ({ value: x, label: x }))}
                searchable
                className="h-9 rounded-md px-2 text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2 md:col-span-2 md:col-start-5">
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
                title="Сбросить фильтры"
                aria-label="Сбросить фильтры"
                onClick={() => {
                  setDraft(defaultFilters);
                  setAppliedFilters(defaultFilters);
                  setDateRangeOpen(false);
                }}
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                onClick={() => setAppliedFilters({ ...draft })}
              >
                Применить
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
      <DateRangePopover
        open={dateRangeOpen}
        onOpenChange={setDateRangeOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.from}
        dateTo={draft.to}
        onApply={({ dateFrom, dateTo }) => {
          setDraft((prev) => ({ ...prev, from: dateFrom, to: dateTo }));
        }}
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className={SUMMARY_CARD_TONES[0]}>
          <CardHeader className="pb-2">
            <CardDescription>Общий</CardDescription>
            <CardTitle>{fmt(data?.summary.total ?? 0)} UZS</CardTitle>
          </CardHeader>
        </Card>
        {summaryPaymentMethods.map((row, i) => (
          <Card key={`${row.key}-${i}`} className={SUMMARY_CARD_TONES[(i + 1) % SUMMARY_CARD_TONES.length]}>
            <CardHeader className="pb-2">
              <CardDescription>{row.label}</CardDescription>
              <CardTitle>{fmt(row.amount)} UZS</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {reportQ.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {!reportQ.isLoading && !data && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Никакой информации не найдено!!!</CardContent></Card>
      )}

      {data && (
        <div className="space-y-2">
          {[
            { key: "period", title: "Поступления за период" },
            { key: "territory", title: "По территории" },
            { key: "clients", title: "Поступления по клиентам" },
            { key: "agents", title: "По агентам" }
          ].map((section, idx) => {
            const isOpen = openSection === section.key;
            const sectionTone = [
              "border-border bg-muted/40",
              "border-cyan-300 bg-cyan-50/30",
              "border-violet-300 bg-violet-50/30",
              "border-emerald-300 bg-emerald-50/30"
            ][idx] ?? "border-muted";
            return (
              <Card key={section.key} className="overflow-hidden border">
                <button
                  type="button"
                  onClick={() =>
                    setOpenSection((prev) => (prev === section.key ? null : (section.key as "period" | "territory" | "clients" | "agents")))
                  }
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium ${sectionTone}`}
                >
                  <span className="inline-flex size-5 items-center justify-center rounded border bg-background/80">
                    {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </span>
                  <span className="ml-2 flex-1 text-sm">{section.title}</span>
                </button>
                {isOpen && (
                  <CardContent className="space-y-3 border-t p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs">
                        <Filter className="size-3.5" />
                      </button>
                      <select
                        className="h-8 rounded-md border px-2 text-xs"
                        value={String(tablePageSize[section.key as "period" | "territory" | "clients" | "agents"])}
                        onChange={(e) => {
                          const k = section.key as "period" | "territory" | "clients" | "agents";
                          const n = Number.parseInt(e.target.value, 10) || 10;
                          setTablePageSize((prev) => ({ ...prev, [k]: n }));
                          setTablePage((prev) => ({ ...prev, [k]: 1 }));
                        }}
                      >
                        {[10, 25, 50].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <input
                        className="h-8 rounded-md border px-2 text-xs"
                        placeholder="Поиск"
                        value={tableSearch[section.key as "period" | "territory" | "clients" | "agents"]}
                        onChange={(e) => {
                          const k = section.key as "period" | "territory" | "clients" | "agents";
                          setTableSearch((prev) => ({ ...prev, [k]: e.target.value }));
                          setTablePage((prev) => ({ ...prev, [k]: 1 }));
                        }}
                      />
                      <button
                        className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs"
                        onClick={() => {
                          const k = section.key as "period" | "territory" | "clients" | "agents";
                          setTableSearch((prev) => ({ ...prev, [k]: "" }));
                          setTablePage((prev) => ({ ...prev, [k]: 1 }));
                        }}
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                      <button
                        className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs"
                        onClick={() => void exportSheet(section.key as "period" | "territory" | "clients" | "agents")}
                      >
                        <Download className="size-3.5" />
                        Excel
                      </button>
                    </div>

                    {section.key === "period" && (() => {
                      const p = paginate(filteredData.period, "period");
                      return (
                      <>
                      <table className="w-full text-sm">
                        <thead className="app-table-thead text-xs">
                          <tr><th className="px-3 py-2 text-left">Способ оплаты</th><th className="px-3 py-2 text-right">Сумма</th></tr>
                        </thead>
                        <tbody>
                          {p.rows.map((r) => (
                            <tr key={r.payment_type} className="border-b">
                              <td className="px-3 py-2">{r.label}</td>
                              <td className="px-3 py-2 text-right">{fmt(r.amount)} UZS</td>
                            </tr>
                          ))}
                          {p.total === 0 && <tr><td colSpan={2} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
                        <span>Показано: {p.total === 0 ? 0 : (p.page - 1) * tablePageSize.period + 1}-{Math.min(p.page * tablePageSize.period, p.total)} / {p.total}</span>
                        <div className="flex gap-1">
                          <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page <= 1} onClick={() => setTablePage((prev) => ({ ...prev, period: Math.max(1, prev.period - 1) }))}>‹</button>
                          <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page >= p.maxPage} onClick={() => setTablePage((prev) => ({ ...prev, period: Math.min(p.maxPage, prev.period + 1) }))}>›</button>
                        </div>
                      </div>
                      </>
                      );
                    })()}

                    {section.key === "territory" && (() => {
                      const p = paginate(filteredData.territory, "territory");
                      return (
                      <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full text-sm">
                          <thead className="app-table-thead text-xs">
                            <tr>
                              <th className="px-3 py-2 text-left">Территория</th>
                              {paymentColumns.map((c) => <th key={c} className="px-3 py-2 text-right">{paymentTypeLabels[c] ?? c}(UZS)</th>)}
                              <th className="px-3 py-2 text-right">Итого</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.rows.map((r) => (
                              <tr key={r.territory} className="border-b">
                                <td className="px-3 py-2">{r.territory}</td>
                                {paymentColumns.map((c) => <td key={c} className="px-3 py-2 text-right">{fmt(r.byType[c] ?? 0)}</td>)}
                                <td className="px-3 py-2 text-right">{fmt(r.total)}</td>
                              </tr>
                            ))}
                            {p.total === 0 && <tr><td colSpan={paymentColumns.length + 2} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>}
                          </tbody>
                        </table>
                        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
                          <span>Показано: {p.total === 0 ? 0 : (p.page - 1) * tablePageSize.territory + 1}-{Math.min(p.page * tablePageSize.territory, p.total)} / {p.total}</span>
                          <div className="flex gap-1">
                            <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page <= 1} onClick={() => setTablePage((prev) => ({ ...prev, territory: Math.max(1, prev.territory - 1) }))}>‹</button>
                            <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page >= p.maxPage} onClick={() => setTablePage((prev) => ({ ...prev, territory: Math.min(p.maxPage, prev.territory + 1) }))}>›</button>
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {section.key === "clients" && (() => {
                      const p = paginate(filteredData.clients, "clients");
                      return (
                      <div className="overflow-x-auto">
                        <table className="min-w-[1200px] w-full text-sm">
                          <thead className="app-table-thead text-xs">
                            <tr>
                              <th className="px-3 py-2 text-left">Ид клиента</th>
                              <th className="px-3 py-2 text-left">Названия</th>
                              {paymentColumns.map((c) => <th key={c} className="px-3 py-2 text-right">{paymentTypeLabels[c] ?? c}(UZS)</th>)}
                              <th className="px-3 py-2 text-left">Агент</th>
                              <th className="px-3 py-2 text-left">Территория</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.rows.map((r) => (
                              <tr key={r.client_id} className="border-b">
                                <td className="px-3 py-2">{r.client_id}</td>
                                <td className="px-3 py-2">{r.client_name}</td>
                                {paymentColumns.map((c) => <td key={c} className="px-3 py-2 text-right">{fmt(r.byType[c] ?? 0)}</td>)}
                                <td className="px-3 py-2">{r.agent_name}</td>
                                <td className="px-3 py-2">{r.territory}</td>
                              </tr>
                            ))}
                            {p.total === 0 && <tr><td colSpan={paymentColumns.length + 5} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>}
                          </tbody>
                        </table>
                        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
                          <span>Показано: {p.total === 0 ? 0 : (p.page - 1) * tablePageSize.clients + 1}-{Math.min(p.page * tablePageSize.clients, p.total)} / {p.total}</span>
                          <div className="flex gap-1">
                            <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page <= 1} onClick={() => setTablePage((prev) => ({ ...prev, clients: Math.max(1, prev.clients - 1) }))}>‹</button>
                            <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page >= p.maxPage} onClick={() => setTablePage((prev) => ({ ...prev, clients: Math.min(p.maxPage, prev.clients + 1) }))}>›</button>
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {section.key === "agents" && (() => {
                      const p = paginate(filteredData.agents, "agents");
                      return (
                      <div className="overflow-x-auto">
                        <table className="min-w-[1000px] w-full text-sm">
                          <thead className="app-table-thead text-xs">
                            <tr>
                              <th className="px-3 py-2 text-left">Код агента</th>
                              <th className="px-3 py-2 text-left">Названия</th>
                              {paymentColumns.map((c) => <th key={c} className="px-3 py-2 text-right">{paymentTypeLabels[c] ?? c}(UZS)</th>)}
                              <th className="px-3 py-2 text-right">Итого</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.rows.map((r) => (
                              <tr key={r.agent_id} className="border-b">
                                <td className="px-3 py-2">{r.agent_id}</td>
                                <td className="px-3 py-2">{r.agent_name}</td>
                                {paymentColumns.map((c) => <td key={c} className="px-3 py-2 text-right">{fmt(r.byType[c] ?? 0)}</td>)}
                                <td className="px-3 py-2 text-right">{fmt(r.total)}</td>
                              </tr>
                            ))}
                            {p.total === 0 && <tr><td colSpan={paymentColumns.length + 4} className="px-3 py-10 text-center text-muted-foreground">Пусто</td></tr>}
                          </tbody>
                        </table>
                        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
                          <span>Показано: {p.total === 0 ? 0 : (p.page - 1) * tablePageSize.agents + 1}-{Math.min(p.page * tablePageSize.agents, p.total)} / {p.total}</span>
                          <div className="flex gap-1">
                            <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page <= 1} onClick={() => setTablePage((prev) => ({ ...prev, agents: Math.max(1, prev.agents - 1) }))}>‹</button>
                            <button className="h-7 rounded border px-2 disabled:opacity-40" disabled={p.page >= p.maxPage} onClick={() => setTablePage((prev) => ({ ...prev, agents: Math.min(p.maxPage, prev.agents + 1) }))}>›</button>
                          </div>
                        </div>
                      </div>
                      );
                    })()}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
