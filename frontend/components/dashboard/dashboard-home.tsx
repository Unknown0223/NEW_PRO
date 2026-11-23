"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { SupervisorProFiltersBar } from "@/components/dashboard/supervisor/pro/supervisor-pro-filters";
import { SupervisorProPage } from "@/components/dashboard/supervisor/pro/supervisor-pro-page";
import {
  buildSupervisorProUiModel,
  type SupervisorProSnapshotInput
} from "@/components/dashboard/supervisor/pro/supervisor-ui-model";
import { DatePickerPopover, formatRuDateButton, localYmd } from "@/components/ui/date-picker-popover";
import { api } from "@/lib/api";
import {
  buildSupervisorDashboardQueryString,
  type SupervisorDashboardQueryInput
} from "@/lib/dashboard-supervisor-query";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { STALE } from "@/lib/query-stale";
import { useDashboardMeta } from "@/lib/use-dashboard-meta";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };

type ProductSalesFilterOpts = {
  territory_1?: string[];
  territory_2?: string[];
  territory_3?: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  agents?: Array<{ id: number; name: string; code: string }>;
  supervisors?: Array<{ id: number; name: string; code: string }>;
  categories?: Array<{ id: number; name: string }>;
  trade_directions?: Array<{ id: number; name: string; code: string }>;
  payment_methods?: Array<{ id: string; label: string }>;
};

function decodeAccessTokenSub(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    const id = Number.parseInt(String(json.sub ?? ""), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function emptyFilters(supervisorId = ""): SupervisorDashboardQueryInput {
  return {
    date: localYmd(new Date()),
    payment_types: [],
    agent_ids: [],
    supervisor_ids: supervisorId ? [supervisorId] : [],
    trade_directions: [],
    client_categories: [],
    territory_1_list: [],
    territory_2_list: [],
    territory_3_list: []
  };
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
}

export type DashboardHomeProps = {
  headerTitle?: string;
  headerDescription?: string;
};

export function DashboardHome({
  headerTitle = "Дашборд - Супервайзер",
  headerDescription = "Мониторинг в реальном времени, контроль план/факт и KPI."
}: DashboardHomeProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const hydrated = useAuthStoreHydrated();
  const selfSupervisorIdStr = useMemo(() => {
    const id = role === "supervisor" ? decodeAccessTokenSub(accessToken) : null;
    return id != null ? String(id) : "";
  }, [role, accessToken]);

  const [draft, setDraft] = useState<SupervisorDashboardQueryInput>(() => emptyFilters());
  const [applied, setApplied] = useState<SupervisorDashboardQueryInput>(() => emptyFilters());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!selfSupervisorIdStr) return;
    const patch = (prev: SupervisorDashboardQueryInput) =>
      prev.supervisor_ids.length === 1 && prev.supervisor_ids[0] === selfSupervisorIdStr
        ? prev
        : { ...prev, supervisor_ids: [selfSupervisorIdStr] };
    setDraft(patch);
    setApplied(patch);
  }, [selfSupervisorIdStr]);

  const { agents, supervisors, clientRefs, profileRefs, reportFilters: reportFiltersRaw } =
    useDashboardMeta(tenantSlug, hydrated);
  const reportFilters = reportFiltersRaw as ProductSalesFilterOpts | undefined;

  const qs = useMemo(() => buildSupervisorDashboardQueryString(applied), [applied]);

  const snapshotQ = useQuery({
    queryKey: ["dashboard-supervisor", "snapshot", tenantSlug, qs],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    queryFn: async () => {
      const { data } = await api.get(`/api/${tenantSlug}/dashboard/supervisor?${qs}`);
      return data as SupervisorProSnapshotInput;
    }
  });

  const model = useMemo(
    () => buildSupervisorProUiModel(snapshotQ.data ?? null),
    [snapshotQ.data]
  );

  const paymentOptions = useMemo(() => {
    const fromReport = reportFilters?.payment_methods ?? [];
    if (fromReport.length) {
      return fromReport.map((p) => ({
        id: p.id,
        title: p.label,
        searchText: `${p.label} ${p.id}`
      }));
    }
    const fromEntries = (profileRefs?.payment_method_entries ?? [])
      .filter((p) => p?.active !== false)
      .map((p) => {
        const id = String(p.id ?? "").trim();
        const title = String(p.name ?? "").trim() || id;
        return { id, title, searchText: [title, p.code, id].filter(Boolean).join(" ") };
      })
      .filter((p) => p.id);
    if (fromEntries.length) return fromEntries;
    return (profileRefs?.payment_types ?? []).map((x) => {
      const id = String(x).trim();
      return { id, title: id, searchText: id };
    });
  }, [reportFilters?.payment_methods, profileRefs]);

  const agentOptions = useMemo(() => {
    const list: StaffPick[] = reportFilters?.agents?.length
      ? reportFilters.agents.map((x) => ({ id: x.id, fio: x.name, code: x.code }))
      : (agents ?? []);
    return list.map((a) => staffDashboardMultiItem(a));
  }, [reportFilters?.agents, agents]);

  const supervisorOptions = useMemo(() => {
    const list: StaffPick[] = reportFilters?.supervisors?.length
      ? reportFilters.supervisors.map((x) => ({ id: x.id, fio: x.name, code: x.code }))
      : (supervisors ?? []);
    return list.map((s) => staffDashboardMultiItem(s));
  }, [reportFilters?.supervisors, supervisors]);

  const directionOptions = useMemo(() => {
    if (reportFilters?.trade_directions?.length) {
      return reportFilters.trade_directions.map((t) => ({
        id: t.name,
        title: t.name,
        searchText: [t.name, t.code].filter(Boolean).join(" ")
      }));
    }
    return (profileRefs?.trade_directions ?? []).map((t) => ({ id: t, title: t, searchText: t }));
  }, [reportFilters?.trade_directions, profileRefs?.trade_directions]);

  const categoryOptions = useMemo(() => {
    if (reportFilters?.categories?.length) {
      return reportFilters.categories.map((c) => ({ id: c.name, title: c.name, searchText: c.name }));
    }
    const fromOpts = (clientRefs?.category_options ?? [])
      .map((o) => (typeof o === "string" ? o : (o?.label ?? o?.value ?? "")))
      .map((x) => String(x).trim())
      .filter(Boolean);
    return uniqSorted([...fromOpts, ...(clientRefs?.categories ?? [])]).map((c) => ({
      id: c,
      title: c,
      searchText: c
    }));
  }, [reportFilters?.categories, clientRefs]);

  const zoneOptions = useMemo(() => {
    const rows = uniqSorted(reportFilters?.territory_1 ?? clientRefs?.zones ?? []);
    return rows.map((z) => ({ id: z, title: z, searchText: z }));
  }, [reportFilters?.territory_1, clientRefs?.zones]);

  const regionOptions = useMemo(() => {
    if (draft.territory_1_list.length && reportFilters?.territory_2_by_1) {
      const set = new Set<string>();
      for (const z of draft.territory_1_list) {
        for (const r of reportFilters.territory_2_by_1[z] ?? []) set.add(r);
      }
      return uniqSorted([...set]).map((r) => ({ id: r, title: r, searchText: r }));
    }
    return uniqSorted(reportFilters?.territory_2 ?? clientRefs?.regions ?? []).map((r) => ({
      id: r,
      title: r,
      searchText: r
    }));
  }, [draft.territory_1_list, reportFilters, clientRefs?.regions]);

  const cityOptions = useMemo(() => {
    if (draft.territory_2_list.length && reportFilters?.territory_3_by_2) {
      const set = new Set<string>();
      for (const r of draft.territory_2_list) {
        for (const c of reportFilters.territory_3_by_2[r] ?? []) set.add(c);
      }
      return uniqSorted([...set]).map((c) => ({ id: c, title: c, searchText: c }));
    }
    return uniqSorted(reportFilters?.territory_3 ?? clientRefs?.cities ?? []).map((c) => ({
      id: c,
      title: c,
      searchText: c
    }));
  }, [draft.territory_2_list, reportFilters, clientRefs?.cities]);

  const dateSlot = (
    <>
      <button
        ref={datePickerAnchorRef}
        type="button"
        className="sv-date"
        onClick={() => setDatePickerOpen(true)}
      >
        <CalendarDays size={14} />
        <span>{formatRuDateButton(draft.date)}</span>
      </button>
      <DatePickerPopover
        open={datePickerOpen}
        onOpenChange={setDatePickerOpen}
        value={draft.date}
        onChange={(ymd) => setDraft((prev) => ({ ...prev, date: ymd }))}
        anchorRef={datePickerAnchorRef}
      />
    </>
  );

  const openPhotos = (agentId?: string) => {
    // Shablon: alohida «Фото отчёты» sahifasi
    const q = new URLSearchParams({ date: applied.date });
    if (agentId) q.set("agent", agentId);
    router.push(`/dashboard/photos?${q.toString()}`);
  };

  return (
    <PageShell>
      <PageHeader title={headerTitle} description={headerDescription} />
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">Сессия не найдена.</p>
      ) : (
        <>
          {snapshotQ.isError ? (
            <p className="text-sm text-destructive">Не удалось загрузить дашборд супервайзера.</p>
          ) : null}
          <SupervisorProPage
            model={model}
            loading={snapshotQ.isFetching}
            onOpenPhotos={openPhotos}
            filtersSlot={
              <SupervisorProFiltersBar
                draft={draft}
                applied={applied}
                dateSlot={dateSlot}
                paymentOptions={paymentOptions}
                agentOptions={agentOptions}
                supervisorOptions={supervisorOptions}
                directionOptions={directionOptions}
                categoryOptions={categoryOptions}
                zoneOptions={zoneOptions}
                regionOptions={regionOptions}
                cityOptions={cityOptions}
                onDraftChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                onApply={() => setApplied({ ...draft })}
                onReset={() => {
                  const fresh = emptyFilters(selfSupervisorIdStr);
                  setDraft(fresh);
                  setApplied(fresh);
                }}
              />
            }
          />
        </>
      )}
    </PageShell>
  );
}
