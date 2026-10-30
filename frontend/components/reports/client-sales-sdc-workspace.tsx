"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, MapPin, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { cn } from "@/lib/utils";

type Opt = { id: string; title: string };
type Filters = {
  date_types: Array<{ id: string; label: string }>;
  statuses: Array<{ id: string; label: string }>;
  agents: Array<{ id: number; name: string; code: string }>;
  categories: Array<{ id: number; name: string }>;
  products: Array<{ id: number; name: string; sku: string }>;
  groups: Array<{ id: number; name: string }>;
  segments: Array<{ id: number; name: string }>;
  day_visit_options: Array<{ id: number; label: string }>;
  price_type_options?: Array<{ id: string; label: string }>;
  price_types: string[];
  client_categories: string[];
  territory_3: string[];
  supervisors?: Array<{ id: number; name: string; code: string }>;
};
type ClientRow = {
  client_id: number;
  client_name: string;
  created_at: string;
  category: string;
  amount: string;
  qty: string;
  volume: string;
  agent_name: string;
  agent_code: string;
  territory: string;
  phone: string;
};
type AgentRow = {
  agent_name: string;
  agent_code: string;
  akb: number;
  okb: number;
  akb_percent: number;
  qty: string;
  volume: string;
  amount: string;
};
type Report = {
  clients: ClientRow[];
  agents_summary: AgentRow[];
  totals: { amount: string; quantity: string; volume: string };
  category_summary?: Array<{ category: string; okb: number; akb: number; amount?: string }>;
  page: number;
  limit: number;
  total: number;
};

function money(v: string | number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 });
}

function pct(akb: number, okb: number) {
  if (!okb) return "0 %";
  const n = (akb / okb) * 100;
  return `${Number.isFinite(n) ? n.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "0"} %`;
}

function categoryCards(rows: Array<{ category: string; okb: number; akb: number; amount?: string }>) {
  const buckets = new Map<string, { okb: number; akb: number; amount: number }>();
  for (const row of rows) {
    const key = (row.category || "").trim() || "—";
    const prev = buckets.get(key) ?? { okb: 0, akb: 0, amount: 0 };
    buckets.set(key, {
      okb: prev.okb + (Number(row.okb) || 0),
      akb: prev.akb + (Number(row.akb) || 0),
      amount: prev.amount + (Number.parseFloat(row.amount ?? "0") || 0)
    });
  }
  const items = [...buckets.entries()]
    .filter(([, b]) => b.okb > 0 || b.akb > 0)
    .sort((a, b) => b[1].okb - a[1].okb || a[0].localeCompare(b[0], "ru"));
  const total = items.reduce((acc, [, b]) => ({ okb: acc.okb + b.okb, akb: acc.akb + b.akb, amount: acc.amount + b.amount }), { okb: 0, akb: 0, amount: 0 });
  return [{ name: "Общая", ...total }, ...items.map(([name, b]) => ({ name, ...b }))];
}

export function ClientSalesSdcWorkspace() {
  const canExport = usePermissions().has("reports.prodazhi_klientov_2.export");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [tab, setTab] = useState<"clients" | "territory" | "agents">("clients");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState({
    date_type: "order_date",
    from: from0,
    to: to0,
    statuses: [] as string[],
    category_ids: [] as string[],
    product_ids: [] as string[],
    product_group_ids: [] as string[],
    segment_ids: [] as string[],
    day_visit_iso: [] as string[],
    agent_ids: [] as string[],
    supervisor_ids: [] as string[],
    price_types: [] as string[],
    client_categories: [] as string[],
    territory_3_list: [] as string[],
    client_activity: "active",
    page: 1,
    limit: 20
  });
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-client-sales-sdc-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Filters }>(`/api/${tenantSlug}/reports/client-sales-2/filter-options`);
      return data.data;
    }
  });
  const reportQ = useQuery({
    queryKey: ["report-client-sales-sdc", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length) p.set(k, v.join(","));
          return;
        }
        if (v === "" || v === "all") return;
        p.set(k, String(v));
      });
      const { data } = await api.get<{ data: Report }>(`/api/${tenantSlug}/reports/client-sales-2?${p.toString()}`);
      return data.data;
    }
  });

  const opts = filtersQ.data;
  const asOpt = (rows: Array<{ id: string | number; title: string }>): Opt[] => rows.map((r) => ({ id: String(r.id), title: r.title }));
  const statusItems = (opts?.statuses ?? []).map((x) => ({ id: x.id, title: x.label }));
  const productItems = (opts?.products ?? []).map((x) => ({ id: String(x.id), title: x.sku ? `${x.name} (${x.sku})` : x.name }));
  const cards = useMemo(() => categoryCards(reportQ.data?.category_summary ?? []), [reportQ.data?.category_summary]);

  const q = search.trim().toLowerCase();
  const clients = (reportQ.data?.clients ?? []).filter((r) => {
    if (!q || tab !== "clients") return tab === "clients" ? true : false;
    return [r.client_name, r.category, r.agent_name, r.territory, String(r.client_id)].join(" ").toLowerCase().includes(q);
  });
  const territories = useMemo(() => {
    const map = new Map<string, { akb: number; qty: number; volume: number; amount: number }>();
    for (const r of reportQ.data?.clients ?? []) {
      const key = r.territory || "—";
      const cur = map.get(key) ?? { akb: 0, qty: 0, volume: 0, amount: 0 };
      cur.akb += 1;
      cur.qty += Number.parseFloat(r.qty) || 0;
      cur.volume += Number.parseFloat(r.volume) || 0;
      cur.amount += Number.parseFloat(r.amount) || 0;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([territory, v], i) => ({ n: i + 1, territory, okb: v.akb, ...v }))
      .filter((r) => !q || tab !== "territory" || r.territory.toLowerCase().includes(q));
  }, [reportQ.data?.clients, q, tab]);
  const agents = (reportQ.data?.agents_summary ?? []).filter((r) => !q || tab !== "agents" || `${r.agent_name} ${r.agent_code}`.toLowerCase().includes(q));

  if (!hydrated || !tenantSlug) return <p className="p-4 text-sm text-muted-foreground">Загрузка...</p>;

  async function exportCurrent() {
    setExporting(true);
    try {
      if (tab === "clients") {
        await downloadXlsxSheet(
          "prodazha-po-klientam.xlsx",
          "Клиенты",
          ["Ид клиента", "Название", "Дата добавления", "Категория", "Сумма", "Кол-во", "Объем", "Агент", "Код агента", "Территория"],
          clients.map((r) => [r.client_id, r.client_name, new Date(r.created_at).toLocaleDateString("ru-RU"), r.category, r.amount, r.qty, r.volume, r.agent_name, r.agent_code, r.territory])
        );
      } else if (tab === "territory") {
        await downloadXlsxSheet(
          "prodazha-po-territorii.xlsx",
          "Территории",
          ["№", "Территория", "АКБ", "ОКБ", "% от ОКБ", "Кол-во", "Объем", "Сумма"],
          territories.map((r) => [r.n, r.territory, r.akb, r.okb, pct(r.akb, r.okb), r.qty, r.volume, r.amount])
        );
      } else {
        await downloadXlsxSheet(
          "prodazha-po-agentam.xlsx",
          "Агенты",
          ["Агент", "АКБ", "ОКБ", "% от ОКБ", "Кол-во", "Объем", "Сумма продаж"],
          agents.map((r) => [r.agent_name, r.akb, r.okb, r.akb_percent, r.qty, r.volume, r.amount])
        );
      }
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((reportQ.data?.total ?? 0) / applied.limit));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Продажи по клиентам</h1>
      <div className="space-y-2 rounded border bg-card p-3">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Дата применяется по</span>
            {(opts?.date_types ?? [
              { id: "order_date", label: "Дата заказа" },
              { id: "shipped_date", label: "Дата отправки" },
              { id: "delivered_date", label: "Дата доставки" },
              { id: "created_date", label: "Дата создания" }
            ]).map((dt) => (
              <label key={dt.id} className="inline-flex items-center gap-1.5">
                <input type="radio" className="accent-primary" checked={draft.date_type === dt.id} onChange={() => setDraft({ ...draft, date_type: dt.id })} />
                {dt.label}
              </label>
            ))}
          </div>
          <button
            ref={dateAnchorRef}
            type="button"
            className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs", dateOpen && "border-primary/60 bg-primary/5")}
            onClick={() => setDateOpen((o) => !o)}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formatDateRangeButton(draft.from, draft.to)}</span>
          </button>
          <DateRangePopover open={dateOpen} onOpenChange={setDateOpen} anchorRef={dateAnchorRef} dateFrom={draft.from} dateTo={draft.to} onApply={({ dateFrom, dateTo }) => setDraft({ ...draft, from: dateFrom, to: dateTo })} />
        </div>
        <div className="grid items-center gap-2 md:grid-cols-4 xl:grid-cols-6">
          <Multi placeholder="Статус" searchPlaceholder="Поиск статуса" items={statusItems} values={draft.statuses} onChange={(statuses) => setDraft({ ...draft, statuses })} />
          <Multi placeholder="Категория продукта" searchPlaceholder="Поиск категории" items={asOpt((opts?.categories ?? []).map((x) => ({ id: x.id, title: x.name })))} values={draft.category_ids} onChange={(category_ids) => setDraft({ ...draft, category_ids })} />
          <Multi placeholder="Продукт" searchPlaceholder="Поиск продукта" items={productItems} values={draft.product_ids} onChange={(product_ids) => setDraft({ ...draft, product_ids })} />
          <Multi placeholder="Группа товаров" searchPlaceholder="Поиск группы" items={asOpt((opts?.groups ?? []).map((x) => ({ id: x.id, title: x.name })))} values={draft.product_group_ids} onChange={(product_group_ids) => setDraft({ ...draft, product_group_ids })} />
          <Multi placeholder="День визита" searchPlaceholder="Выберите дни" items={(opts?.day_visit_options ?? []).map((x) => ({ id: String(x.id), title: x.label }))} values={draft.day_visit_iso} onChange={(day_visit_iso) => setDraft({ ...draft, day_visit_iso })} />
          <Multi placeholder="Супервайзер" searchPlaceholder="Поиск супервайзера" items={(opts?.supervisors ?? []).map((x) => ({ id: String(x.id), title: x.code ? `${x.name} (${x.code})` : x.name }))} values={draft.supervisor_ids} onChange={(supervisor_ids) => setDraft({ ...draft, supervisor_ids })} />
          <Multi placeholder="Агент" searchPlaceholder="Поиск агента" items={(opts?.agents ?? []).map((x) => ({ id: String(x.id), title: x.code ? `${x.name} (${x.code})` : x.name }))} values={draft.agent_ids} onChange={(agent_ids) => setDraft({ ...draft, agent_ids })} />
          <Multi placeholder="Категория клиента" searchPlaceholder="Поиск категории клиента" items={(opts?.client_categories ?? []).map((x) => ({ id: x, title: x }))} values={draft.client_categories} onChange={(client_categories) => setDraft({ ...draft, client_categories })} />
          <Multi placeholder="Тип цен" searchPlaceholder="Поиск типа цен" items={(opts?.price_type_options ?? (opts?.price_types ?? []).map((x) => ({ id: x, label: x }))).map((x) => ({ id: x.id, title: x.label }))} values={draft.price_types} onChange={(price_types) => setDraft({ ...draft, price_types })} />
          <Multi placeholder="Сегменты" searchPlaceholder="Поиск сегмента" items={asOpt((opts?.segments ?? []).map((x) => ({ id: x.id, title: x.name })))} values={draft.segment_ids} onChange={(segment_ids) => setDraft({ ...draft, segment_ids })} />
          <Multi placeholder="Город" searchPlaceholder="Поиск города" items={(opts?.territory_3 ?? []).map((x) => ({ id: x, title: x }))} values={draft.territory_3_list} onChange={(territory_3_list) => setDraft({ ...draft, territory_3_list: territory_3_list.slice(0, 1) })} />
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" onClick={() => { const next = { ...draft, statuses: [], category_ids: [], product_ids: [], product_group_ids: [], segment_ids: [], day_visit_iso: [], agent_ids: [], supervisor_ids: [], price_types: [], client_categories: [], territory_3_list: [], from: from0, to: to0, page: 1 }; setDraft(next); setApplied(next); }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button className="h-9" onClick={() => { setApplied({ ...draft, page: 1 }); setDraft({ ...draft, page: 1 }); }}>Применить</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.name} className="rounded-lg border bg-card px-3 py-2 shadow-sm">
            <div className="truncate text-xs text-muted-foreground" title={c.name}>{c.name}</div>
            <div className="text-xl font-semibold tabular-nums">{pct(c.akb, c.okb).replace(" %", "%")}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
              <span>ОКБ {c.okb}</span>
              <span>АКБ {c.akb}</span>
            </div>
            <div className="text-[11px] tabular-nums text-foreground">{money(c.amount)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-2 py-1.5 text-sm">
          <button type="button" className={cn("rounded px-2 py-0.5", tab === "clients" && "bg-background shadow-sm")} onClick={() => setTab("clients")}>Список клиентов</button>
          <button type="button" className={cn("rounded px-2 py-0.5", tab === "territory" && "bg-background shadow-sm")} onClick={() => setTab("territory")}>По территории</button>
          <button type="button" className={cn("rounded px-2 py-0.5", tab === "agents" && "bg-background shadow-sm")} onClick={() => setTab("agents")}>По агентам</button>
          <span className="ml-auto flex items-center gap-2">
            <select className="rounded bg-white px-1 text-xs text-slate-800" value={applied.limit} onChange={(e) => { const limit = Number(e.target.value); const next = { ...applied, limit, page: 1 }; setApplied(next); setDraft({ ...draft, limit, page: 1 }); }}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>По {n}</option>)}
            </select>
            {canExport ? (
              <Button type="button" size="sm" variant="secondary" disabled={exporting} onClick={() => void exportCurrent()}>
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
              </Button>
            ) : null}
            <Link href="/clients/map" className="inline-flex h-8 items-center rounded-md bg-white px-2 text-xs text-slate-800">
              <MapPin className="mr-1 h-3.5 w-3.5" /> Показать на карте
            </Link>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск" className="h-8 w-40 bg-white text-slate-900" />
          </span>
        </div>
        {reportQ.isError ? <p className="p-4 text-sm text-red-600">Не удалось загрузить отчёт.</p> : null}
        {reportQ.isLoading ? <p className="p-4 text-sm text-muted-foreground">Загрузка данных...</p> : null}
        {!reportQ.isLoading && tab === "clients" && clients.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Нет клиентов по текущим условиям.</p> : null}
        <div className="overflow-x-auto">
          {tab === "clients" && clients.length > 0 ? (
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>{["Ид клиента", "Название", "Дата добавления", "Категория", "Сумма", "Кол-во", "Объем", "Агент", "Код агента", "Территория"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {clients.map((r) => (
                  <tr key={r.client_id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{r.client_id}</td>
                    <td className="px-2 py-1.5"><Link className="text-sky-700 hover:underline" href={`/clients/${r.client_id}`}>{r.client_name}</Link></td>
                    <td className="px-2 py-1.5">{r.created_at ? new Date(r.created_at).toLocaleDateString("ru-RU") : "—"}</td>
                    <td className="px-2 py-1.5">{r.category || "—"}</td>
                    <td className="px-2 py-1.5">{money(r.amount)}</td>
                    <td className="px-2 py-1.5">{money(r.qty)}</td>
                    <td className="px-2 py-1.5">{money(r.volume)}</td>
                    <td className="px-2 py-1.5">{r.agent_name || "—"}</td>
                    <td className="px-2 py-1.5">{r.agent_code || "—"}</td>
                    <td className="px-2 py-1.5">{r.territory || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === "territory" ? (
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-slate-50"><tr>{["№", "Территория", "АКБ", "ОКБ", "% от ОКБ", "Кол-во", "Объем", "Сумма"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {territories.length === 0 ? <tr><td className="p-4 text-muted-foreground" colSpan={8}>Нет строк.</td></tr> : territories.map((r) => (
                  <tr key={r.territory} className="border-t"><td className="px-2 py-1.5">{r.n}</td><td className="px-2 py-1.5">{r.territory}</td><td className="px-2 py-1.5">{r.akb}</td><td className="px-2 py-1.5">{r.okb}</td><td className="px-2 py-1.5">{pct(r.akb, r.okb)}</td><td className="px-2 py-1.5">{money(r.qty)}</td><td className="px-2 py-1.5">{money(r.volume)}</td><td className="px-2 py-1.5">{money(r.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === "agents" ? (
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-slate-50"><tr>{["Агент", "АКБ", "ОКБ", "% от ОКБ", "Кол-во", "Объем", "Сумма продаж"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {agents.length === 0 ? <tr><td className="p-4 text-muted-foreground" colSpan={7}>Нет строк.</td></tr> : agents.map((r) => (
                  <tr key={`${r.agent_code}-${r.agent_name}`} className="border-t"><td className="px-2 py-1.5">{r.agent_name || "—"}</td><td className="px-2 py-1.5">{r.akb}</td><td className="px-2 py-1.5">{r.okb}</td><td className="px-2 py-1.5">{Number.isFinite(r.akb_percent) ? r.akb_percent : 0}</td><td className="px-2 py-1.5">{money(r.qty)}</td><td className="px-2 py-1.5">{money(r.volume)}</td><td className="px-2 py-1.5">{money(r.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        {tab === "clients" ? (
          <div className="flex items-center justify-between border-t px-2 py-2 text-xs text-slate-600">
            <span>Итого: {money(reportQ.data?.totals.amount ?? 0)} · строк {reportQ.data?.total ?? 0}</span>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={applied.page <= 1} onClick={() => { const page = applied.page - 1; setApplied({ ...applied, page }); setDraft({ ...draft, page }); }}>Назад</Button>
              <span>{applied.page} / {totalPages}</span>
              <Button type="button" size="sm" variant="outline" disabled={applied.page >= totalPages} onClick={() => { const page = applied.page + 1; setApplied({ ...applied, page }); setDraft({ ...draft, page }); }}>Вперёд</Button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Multi({ placeholder, searchPlaceholder, items, values, onChange }: { placeholder: string; searchPlaceholder: string; items: Opt[]; values: string[]; onChange: (next: string[]) => void }) {
  return (
    <SearchableMultiSelectPanel
      label={placeholder}
      hideOuterLabel
      hidePopoverHeader
      triggerPlaceholder={placeholder}
      items={items}
      selected={new Set(values)}
      onSelectedChange={(next) => {
        const resolved = typeof next === "function" ? next(new Set(values)) : next;
        onChange(Array.from(resolved).map(String));
      }}
      searchable
      searchPlaceholder={searchPlaceholder}
      minPopoverWidth={260}
      maxListHeightClass="max-h-44"
    />
  );
}
