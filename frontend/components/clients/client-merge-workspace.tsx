"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { pickCityTerritoryHint } from "@/lib/city-territory-hint";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Store,
  Trash2
} from "lucide-react";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CompareMergeOverlay, type MergeDuplicateGroup } from "./client-merge-compare-overlay";

type DuplicateGroup = MergeDuplicateGroup;

type DuplicateCandidatesResponse = {
  tab: "fields" | "geo";
  groups: DuplicateGroup[];
  total: number;
  page: number;
  limit: number;
  truncated: boolean;
};

type MergeSessionRow = {
  master_client_id: number;
  master_name: string;
  merged_by_user_id: number | null;
  merged_by_name: string | null;
  merged_at: string;
  merged_clients_count: number;
};

type MergeSessionsResponse = {
  data: MergeSessionRow[];
  total: number;
  page: number;
  limit: number;
};

type SavedDupRow = {
  id: number;
  created_at: string;
  master_client_id: number;
  master_name: string;
  note: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  similar_count: number;
  not_merged_count: number;
};

type CityTerritoryHintRow = {
  region_stored: string | null;
  region_label: string | null;
  zone_stored: string | null;
  zone_label: string | null;
  district_stored: string | null;
  district_label: string | null;
};

type ClientRefs = {
  zones?: string[];
  regions?: string[];
  cities?: string[];
  region_options?: { value: string; label: string }[];
  city_options?: { value: string; label: string }[];
  city_territory_hints?: Record<string, CityTerritoryHintRow>;
  client_formats?: string[];
  categories?: string[];
  category_options?: { value: string; label: string }[];
  client_type_options?: { value: string; label: string }[];
};

type FilterPopoverKind = null | "clientTypes" | "searchFields";

/** API label bo‘sh yoki kod bilan bir xil bo‘lsa — AD_ASAKA → «Asaka» kabi */
function cityDisplayLabel(value: string, apiLabel?: string | null): string {
  const api = (apiLabel ?? "").trim();
  const raw = value.trim();
  if (!raw) return "—";
  if (api && api !== raw) return api;
  const parts = raw.split("_").filter(Boolean);
  if (parts.length >= 2 && /^[A-Z0-9]{2,}$/i.test(parts[0]!)) {
    const tail = parts.slice(1).join(" ");
    if (!tail) return raw;
    return tail
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return raw;
}

type StaffPick = { id: number; fio: string };

type MainTab = "fields" | "geo" | "saved" | "merged";

/** `globals.css` — zakazlar / ro‘yxatlar bilan bir xil filtr va jadval fonlari */
const MERGE_FILTER_PANEL_CLASS = "orders-hub-section--toolbar px-3 py-3 sm:px-4";
const MERGE_TABLE_SHELL_CLASS = "orders-hub-section--table";
const MERGE_TOOLBAR_STRIP_CLASS =
  "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 shadow-sm";

const SEARCH_FIELD_OPTS = [
  { id: "name", label: "Название" },
  { id: "legal_name", label: "Название компании" },
  { id: "phone", label: "Номер телефона" },
  { id: "inn", label: "ИНН" },
  { id: "pinfl", label: "Пинфл" },
  { id: "contract", label: "Номер договора" },
  { id: "address", label: "Адрес" }
] as const;

function formatRuShortDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${mi}`;
}

function formatPinflDisplay(v: string | null | undefined): string {
  if (v == null || v.trim() === "" || v === "0") return "—";
  const t = v.replace(/\D/g, "");
  if (t.length <= 6) return v;
  return `${t.slice(0, 6)}…${t.slice(-2)}`;
}

type AppliedDupFilters = {
  agent_id: string;
  region: string;
  zone: string;
  city: string;
  client_format: string;
  category: string;
  client_type_codes: string[];
  is_active: "all" | "yes" | "no";
  search: string;
  search_fields: string[];
};

function defaultApplied(): AppliedDupFilters {
  return {
    agent_id: "",
    region: "",
    zone: "",
    city: "",
    client_format: "",
    category: "",
    client_type_codes: [],
    is_active: "all",
    search: "",
    search_fields: ["name", "legal_name"]
  };
}

function buildDupQueryString(
  tab: "fields" | "geo",
  page: number,
  limit: number,
  applied: AppliedDupFilters
): string {
  const p = new URLSearchParams();
  p.set("tab", tab);
  p.set("page", String(page));
  p.set("limit", String(limit));
  if (applied.search.trim()) p.set("search", applied.search.trim());
  if (applied.search_fields.length > 0) p.set("search_fields", applied.search_fields.join(","));
  if (applied.agent_id) p.set("agent_id", applied.agent_id);
  if (applied.region) p.set("region", applied.region);
  if (applied.zone) p.set("zone", applied.zone);
  if (applied.city) p.set("city", applied.city);
  if (applied.client_format) p.set("client_format", applied.client_format);
  if (applied.category) p.set("category", applied.category);
  if (applied.client_type_codes.length > 0) p.set("client_type_codes", applied.client_type_codes.join(","));
  if (applied.is_active !== "all") p.set("is_active", applied.is_active);
  return p.toString();
}

type MergeResult = {
  kept: number;
  merged: number[];
  orders_reassigned: number;
  payments_reassigned: number;
};

type MergePreviewResult = {
  keep_client_id: number;
  merge_client_ids: number[];
  orders_to_reassign: number;
  payments_to_reassign: number;
  sales_returns_to_reassign: number;
  equipment_to_reassign: number;
  photo_reports_to_reassign: number;
  qr_codes_to_reassign: number;
  visits_to_reassign: number;
  opening_balances_to_reassign: number;
  total_balance_before: string;
  master_balance_before: string;
  expected_master_balance_after: string;
  conflict_summary: { safe: number; warning: number; critical: number };
};

export function ClientMergeWorkspace() {
  const hydrated = useAuthStoreHydrated();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();

  const [mainTab, setMainTab] = useState<MainTab>("fields");
  const [dupPage, setDupPage] = useState(1);
  const [dupLimit, setDupLimit] = useState(10);
  const [mergedPage, setMergedPage] = useState(1);
  const [mergedLimit] = useState(10);
  const [mergedTableSearch, setMergedTableSearch] = useState("");
  const [tableRowFilter, setTableRowFilter] = useState("");

  const [draft, setDraft] = useState<AppliedDupFilters>(() => defaultApplied());
  const [applied, setApplied] = useState<AppliedDupFilters>(() => defaultApplied());

  const [filterPopover, setFilterPopover] = useState<FilterPopoverKind>(null);

  const [compareOpen, setCompareOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<DuplicateGroup | null>(null);
  const [masterId, setMasterId] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 6000);
    return () => window.clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    setDupPage(1);
  }, [mainTab]);

  useEffect(() => {
    setDupPage(1);
  }, [dupLimit]);

  const refsQ = useQuery({
    queryKey: ["client-merge", "refs", tenantSlug],
    enabled: Boolean(hydrated && tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefs>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["client-merge", "agents", tenantSlug],
    enabled: Boolean(hydrated && tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/agents?is_active=true`);
      return data.data ?? [];
    }
  });

  const dupQs = useMemo(
    () =>
      buildDupQueryString(mainTab === "geo" ? "geo" : "fields", dupPage, dupLimit, applied),
    [mainTab, dupPage, dupLimit, applied]
  );

  const dupQuery = useQuery({
    queryKey: ["client-duplicate-candidates", tenantSlug, dupQs],
    enabled: Boolean(hydrated && tenantSlug && (mainTab === "fields" || mainTab === "geo")),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<DuplicateCandidatesResponse>(
        `/api/${tenantSlug}/clients/duplicate-candidates?${dupQs}`
      );
      return data;
    }
  });

  const mergeSessionsQs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(mergedPage));
    p.set("limit", String(mergedLimit));
    if (mergedTableSearch.trim()) p.set("search", mergedTableSearch.trim());
    return p.toString();
  }, [mergedPage, mergedLimit, mergedTableSearch]);

  const mergedQuery = useQuery({
    queryKey: ["client-merge-sessions", tenantSlug, mergeSessionsQs],
    enabled: Boolean(hydrated && tenantSlug && mainTab === "merged"),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<MergeSessionsResponse>(
        `/api/${tenantSlug}/clients/merge-sessions?${mergeSessionsQs}`
      );
      return data;
    }
  });

  const savedQuery = useQuery({
    queryKey: ["client-saved-dup-groups", tenantSlug],
    enabled: Boolean(hydrated && tenantSlug && mainTab === "saved"),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: SavedDupRow[] }>(`/api/${tenantSlug}/clients/saved-duplicate-groups`);
      return data.data ?? [];
    }
  });

  const deleteSavedMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/clients/saved-duplicate-groups/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-saved-dup-groups", tenantSlug] });
    }
  });

  const saveGroupMut = useMutation({
    mutationFn: async (body: { master_client_id: number; client_ids: number[]; note?: string | null }) => {
      await api.post(`/api/${tenantSlug}/clients/saved-duplicate-groups`, body);
    },
    onSuccess: () => {
      setBanner({ kind: "ok", text: "Группа сохранена." });
      void qc.invalidateQueries({ queryKey: ["client-saved-dup-groups", tenantSlug] });
    },
    onError: (err: unknown) =>
      setBanner({ kind: "err", text: getUserFacingError(err, "Не удалось сохранить.") })
  });

  const mergeMutation = useMutation({
    mutationFn: async (body: { keep_client_id: number; merge_client_ids: number[] }) => {
      const { data } = await api.post<MergeResult>(`/api/${tenantSlug}/clients/merge`, body);
      return data;
    },
    onSuccess: (res) => {
      setBanner({
        kind: "ok",
        text: `Объединено: #${res.kept}, заказов ${res.orders_reassigned}, платежей ${res.payments_reassigned}.`
      });
      void qc.invalidateQueries({ queryKey: ["client-duplicate-candidates", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["client-merge-sessions", tenantSlug] });
      setCompareOpen(false);
      setActiveGroup(null);
      setMasterId(null);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { status?: number; data?: { error?: string } } };
      const code = ax.response?.data?.error;
      if (ax.response?.status === 409) setBanner({ kind: "err", text: "Один из клиентов уже был объединён." });
      else if (code === "NoMergeTargets") setBanner({ kind: "err", text: "Нет клиентов для объединения." });
      else setBanner({ kind: "err", text: getUserFacingError(err, "Не удалось объединить.") });
    }
  });

  const agentOptions = useMemo(
    () =>
      (agentsQ.data ?? []).map((a) => ({
        value: String(a.id),
        label: a.fio?.trim() || `ID ${a.id}`
      })),
    [agentsQ.data]
  );

  const regionOptionsLabeled = useMemo(() => {
    const d = refsQ.data;
    if ((d?.region_options ?? []).length > 0) {
      return (d!.region_options ?? []).map((r) => ({
        value: r.value,
        label: (r.label ?? "").trim() || r.value
      }));
    }
    if ((d?.regions ?? []).length > 0) {
      return (d!.regions ?? []).map((r) => ({ value: r, label: r }));
    }
    const m = new Map<string, string>();
    for (const h of Object.values(d?.city_territory_hints ?? {})) {
      if (!h.region_stored) continue;
      const lb = (h.region_label ?? "").trim() || h.region_stored;
      if (!m.has(h.region_stored)) m.set(h.region_stored, lb);
    }
    return Array.from(m.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [refsQ.data]);

  const allCityOptions = useMemo(() => {
    const d = refsQ.data;
    if ((d?.city_options ?? []).length > 0) {
      return (d!.city_options ?? []).map((r) => ({
        value: r.value,
        label: cityDisplayLabel(r.value, r.label)
      }));
    }
    return (d?.cities ?? []).map((c) => ({ value: c, label: cityDisplayLabel(c, null) }));
  }, [refsQ.data]);

  const filteredZoneOptions = useMemo(() => {
    const d = refsQ.data;
    const hints = d?.city_territory_hints;
    const zonesRef = d?.zones ?? [];
    const m = new Map<string, string>();
    for (const h of Object.values(hints ?? {})) {
      if (!h.zone_stored) continue;
      if (draft.region && h.region_stored !== draft.region) continue;
      const lb = (h.zone_label ?? "").trim() || h.zone_stored;
      m.set(h.zone_stored, lb);
    }
    for (const z of zonesRef) {
      const t = z.trim();
      if (!t) continue;
      if (draft.region) {
        const linked = Object.values(hints ?? {}).some(
          (h) => h.zone_stored === t && h.region_stored === draft.region
        );
        if (!linked) continue;
      }
      if (!m.has(t)) m.set(t, t);
    }
    return Array.from(m.entries())
      .map(([value, label]) => ({ value, label: label.trim() || value }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [refsQ.data, draft.region]);

  const filteredCityOptions = useMemo(() => {
    const hints = refsQ.data?.city_territory_hints;
    return allCityOptions.filter((o) => {
      const h = pickCityTerritoryHint(hints, o.value);
      if (draft.region) {
        if (!h || !h.region_stored || h.region_stored !== draft.region) return false;
      }
      if (draft.zone) {
        if (!h || !h.zone_stored || h.zone_stored !== draft.zone) return false;
      }
      return true;
    });
  }, [allCityOptions, draft.region, draft.zone, refsQ.data?.city_territory_hints]);

  const clientTypeOptionsLabeled = useMemo(() => {
    const raw = refsQ.data?.client_type_options ?? [];
    return raw.map((o) => {
      const lb = (o.label ?? "").trim();
      return {
        value: o.value,
        label: lb && lb.toLowerCase() !== o.value.trim().toLowerCase() ? lb : o.value
      };
    });
  }, [refsQ.data?.client_type_options]);

  const applyFilters = () => {
    setApplied({ ...draft });
    setDupPage(1);
    setFilterPopover(null);
  };

  const resetFilters = () => {
    const z = defaultApplied();
    setDraft(z);
    setApplied(z);
    setDupPage(1);
    setFilterPopover(null);
  };

  const openCompare = useCallback((g: DuplicateGroup) => {
    setActiveGroup(g);
    setMasterId(null);
    setCompareOpen(true);
  }, []);

  const runMerge = () => {
    if (!activeGroup || masterId == null) return;
    const mergeIds = activeGroup.client_ids.filter((id) => id !== masterId);
    if (mergeIds.length === 0) {
      setBanner({ kind: "err", text: "Выберите мастера и минимум одного дубликата." });
      return;
    }
    mergeMutation.mutate({ keep_client_id: masterId, merge_client_ids: mergeIds });
  };

  const mergePreviewQ = useQuery({
    queryKey: ["client-merge-preview", tenantSlug, activeGroup?.key, masterId],
    enabled: Boolean(tenantSlug && compareOpen && activeGroup && masterId != null),
    staleTime: 0,
    queryFn: async () => {
      const mergeIds = (activeGroup?.client_ids ?? []).filter((id) => id !== masterId);
      const { data } = await api.post<MergePreviewResult>(`/api/${tenantSlug}/clients/merge-preview`, {
        keep_client_id: masterId,
        merge_client_ids: mergeIds
      });
      return data;
    }
  });

  const saveCurrentGroup = () => {
    if (!activeGroup || masterId == null) return;
    const ids = activeGroup.client_ids;
    if (ids.length < 2) return;
    saveGroupMut.mutate({ master_client_id: masterId, client_ids: ids, note: null });
  };

  const toggleSearchField = (id: string, checked: boolean) => {
    setDraft((prev) => {
      const set = new Set(prev.search_fields);
      if (checked) set.add(id);
      else set.delete(id);
      if (set.size === 0) return { ...prev, search_fields: ["name"] };
      return { ...prev, search_fields: Array.from(set) };
    });
  };

  const selectAllSearchFields = () => {
    setDraft((prev) => ({ ...prev, search_fields: SEARCH_FIELD_OPTS.map((x) => x.id) }));
  };

  const toggleClientType = (code: string, checked: boolean) => {
    setDraft((prev) => {
      const set = new Set(prev.client_type_codes);
      if (checked) set.add(code);
      else set.delete(code);
      return { ...prev, client_type_codes: Array.from(set) };
    });
  };

  const searchFieldsSummary = useMemo(() => {
    if (draft.search_fields.length >= SEARCH_FIELD_OPTS.length) return "Все поля";
    const labels = SEARCH_FIELD_OPTS.filter((o) => draft.search_fields.includes(o.id)).map((o) => o.label);
    return labels.length ? labels.join(", ") : "Название";
  }, [draft.search_fields]);

  const filteredDupGroups = useMemo(() => {
    const q = tableRowFilter.trim().toLowerCase();
    const rows = dupQuery.data?.groups ?? [];
    if (!q) return rows;
    return rows.filter((g) => {
      const p0 = g.previews[0];
      const hay = [p0?.name, p0?.legal_name, p0?.phone, g.key].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [dupQuery.data?.groups, tableRowFilter]);

  const dupTotalPages = Math.max(1, Math.ceil((dupQuery.data?.total ?? 0) / dupLimit));

  if (!hydrated || !tenantSlug) {
    return (
      <PageShell>
        <PageHeader title="Объединение клиентов" />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка…
        </div>
      </PageShell>
    );
  }

  const tabTriggers = (
    <TabsList className="h-auto flex-wrap justify-end gap-1 rounded-lg border border-border/60 bg-muted/45 p-1">
      <TabsTrigger
        value="fields"
        className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
      >
        По полям
      </TabsTrigger>
      <TabsTrigger
        value="geo"
        className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
      >
        По местоположению
      </TabsTrigger>
      <TabsTrigger
        value="saved"
        className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
      >
        Сохранённые
      </TabsTrigger>
      <TabsTrigger
        value="merged"
        className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm"
      >
        Объединённые
      </TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)} className="flex min-h-0 flex-1 flex-col">
      <PageShell className="flex flex-col">
        <div className="border-b border-border/70 px-4 pb-4 pt-2">
          <PageHeader title="Объединение клиентов" actions={tabTriggers} />
        </div>

        {banner ? (
          <div
            className={cn(
              "mx-4 mt-2 rounded-md border px-3 py-2 text-sm",
              banner.kind === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            )}
          >
            {banner.text}
          </div>
        ) : null}

        <TabsContent value="fields" className="mt-0 flex flex-1 flex-col space-y-4 px-4 pb-8 pt-3">
          <DupFilterBar
            draft={draft}
            setDraft={setDraft}
            agentOptions={agentOptions}
            regionOptions={regionOptionsLabeled}
            zoneOptions={filteredZoneOptions}
            cityOptions={filteredCityOptions}
            clientTypeOptions={clientTypeOptionsLabeled}
            refs={refsQ.data}
            filterPopover={filterPopover}
            setFilterPopover={setFilterPopover}
            searchFieldsSummary={searchFieldsSummary}
            toggleSearchField={toggleSearchField}
            selectAllSearchFields={selectAllSearchFields}
            toggleClientType={toggleClientType}
            onApply={applyFilters}
            onReset={resetFilters}
          />
          <DupTableToolbar
            dupLimit={dupLimit}
            setDupLimit={setDupLimit}
            tableRowFilter={tableRowFilter}
            setTableRowFilter={setTableRowFilter}
            onRefresh={() => void dupQuery.refetch()}
            loading={dupQuery.isFetching}
          />
          {dupQuery.data?.truncated ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              Показаны не все группы — уточните фильтры (лимит выборки на сервере).
            </div>
          ) : null}
          <DupCandidatesTable
            groups={filteredDupGroups}
            loading={dupQuery.isLoading}
            error={dupQuery.isError}
            onOpenMerge={openCompare}
          />
          <DupPagination
            page={dupPage}
            totalPages={dupTotalPages}
            total={dupQuery.data?.total ?? 0}
            limit={dupLimit}
            onPageChange={setDupPage}
          />
        </TabsContent>

        <TabsContent value="geo" className="mt-0 flex flex-1 flex-col space-y-4 px-4 pb-8 pt-3">
          <DupFilterBar
            draft={draft}
            setDraft={setDraft}
            agentOptions={agentOptions}
            regionOptions={regionOptionsLabeled}
            zoneOptions={filteredZoneOptions}
            cityOptions={filteredCityOptions}
            clientTypeOptions={clientTypeOptionsLabeled}
            refs={refsQ.data}
            filterPopover={filterPopover}
            setFilterPopover={setFilterPopover}
            searchFieldsSummary={searchFieldsSummary}
            toggleSearchField={toggleSearchField}
            selectAllSearchFields={selectAllSearchFields}
            toggleClientType={toggleClientType}
            onApply={applyFilters}
            onReset={resetFilters}
          />
          <DupTableToolbar
            dupLimit={dupLimit}
            setDupLimit={setDupLimit}
            tableRowFilter={tableRowFilter}
            setTableRowFilter={setTableRowFilter}
            onRefresh={() => void dupQuery.refetch()}
            loading={dupQuery.isFetching}
          />
          <DupCandidatesTable
            groups={filteredDupGroups}
            loading={dupQuery.isLoading}
            error={dupQuery.isError}
            onOpenMerge={openCompare}
          />
          <DupPagination
            page={dupPage}
            totalPages={dupTotalPages}
            total={dupQuery.data?.total ?? 0}
            limit={dupLimit}
            onPageChange={setDupPage}
          />
        </TabsContent>

        <TabsContent value="saved" className="mt-0 space-y-4 px-4 pb-8 pt-3">
          <div className={MERGE_TOOLBAR_STRIP_CLASS}>
            <span className="text-xs text-muted-foreground">Сохранённые группы для последующего объединения</span>
            <Button type="button" variant="outline" size="icon" onClick={() => void savedQuery.refetch()}>
              <RefreshCw className={cn("h-4 w-4", savedQuery.isFetching && "animate-spin")} />
            </Button>
          </div>
          <div className={MERGE_TABLE_SHELL_CLASS}>
            <Table className="bg-card">
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="!font-bold">Дата сохранения</TableHead>
                  <TableHead className="!font-bold">Основной клиент</TableHead>
                  <TableHead className="!font-bold">Описания</TableHead>
                  <TableHead className="!font-bold">Кто создал</TableHead>
                  <TableHead className="!text-right !font-bold">Похожих</TableHead>
                  <TableHead className="!text-right !font-bold">Не объединены</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Загрузка…
                    </TableCell>
                  </TableRow>
                ) : savedQuery.data?.length ? (
                  savedQuery.data.map((r) => (
                    <TableRow key={r.id} className="even:bg-muted/20">
                      <TableCell className="whitespace-nowrap text-sm">{formatRuShortDateTime(r.created_at)}</TableCell>
                      <TableCell>
                        <Link href={`/clients/${r.master_client_id}`} className="text-primary hover:underline">
                          {r.master_name}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {r.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{r.created_by_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm">
                          <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.similar_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{r.not_merged_count}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteSavedMut.mutate(r.id)}
                          disabled={deleteSavedMut.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Нет сохранённых групп. Откройте сравнение дубликатов и нажмите «Сохранить группу».
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="merged" className="mt-0 space-y-4 px-4 pb-8 pt-3">
          <div className={MERGE_TOOLBAR_STRIP_CLASS}>
            <Input
              placeholder="Поиск по названию клиента…"
              value={mergedTableSearch}
              onChange={(e) => {
                setMergedTableSearch(e.target.value);
                setMergedPage(1);
              }}
              className="max-w-xs bg-background"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => void mergedQuery.refetch()}>
              <RefreshCw className={cn("h-4 w-4", mergedQuery.isFetching && "animate-spin")} />
            </Button>
          </div>
          <div className={MERGE_TABLE_SHELL_CLASS}>
            <Table className="bg-card">
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="!font-bold">Название клиента</TableHead>
                  <TableHead className="!font-bold">Объединил(а)</TableHead>
                  <TableHead className="!font-bold">Дата объединения</TableHead>
                  <TableHead className="!text-right !font-bold">Кол-во объединённых</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Загрузка…
                    </TableCell>
                  </TableRow>
                ) : mergedQuery.data?.data.length ? (
                  mergedQuery.data.data.map((r, idx) => (
                    <TableRow key={`${r.master_client_id}-${r.merged_at}-${idx}`} className="even:bg-muted/20">
                      <TableCell>
                        <Link href={`/clients/${r.master_client_id}`} className="text-primary hover:underline">
                          {r.master_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{r.merged_by_name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatRuShortDateTime(r.merged_at)}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm">
                          <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.merged_clients_count}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      История объединений пуста.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <MergedPagination
            page={mergedPage}
            total={mergedQuery.data?.total ?? 0}
            limit={mergedLimit}
            onPageChange={setMergedPage}
          />
        </TabsContent>
      </PageShell>

      {compareOpen && activeGroup ? (
        <CompareMergeOverlay
          group={activeGroup}
          masterId={masterId}
          setMasterId={setMasterId}
          mergePreview={mergePreviewQ.data ?? null}
          mergePreviewLoading={mergePreviewQ.isLoading || mergePreviewQ.isFetching}
          onClose={() => {
            setCompareOpen(false);
            setActiveGroup(null);
          }}
          onMerge={runMerge}
          onSave={saveCurrentGroup}
          merging={mergeMutation.isPending}
          saving={saveGroupMut.isPending}
        />
      ) : null}
    </Tabs>
  );
}

function DupFilterBar(props: {
  draft: AppliedDupFilters;
  setDraft: Dispatch<SetStateAction<AppliedDupFilters>>;
  agentOptions: { value: string; label: string }[];
  regionOptions: { value: string; label: string }[];
  zoneOptions: { value: string; label: string }[];
  cityOptions: { value: string; label: string }[];
  clientTypeOptions: { value: string; label: string }[];
  refs: ClientRefs | undefined;
  filterPopover: FilterPopoverKind;
  setFilterPopover: Dispatch<SetStateAction<FilterPopoverKind>>;
  searchFieldsSummary: string;
  toggleSearchField: (id: string, checked: boolean) => void;
  selectAllSearchFields: () => void;
  toggleClientType: (code: string, checked: boolean) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const {
    draft,
    setDraft,
    agentOptions,
    regionOptions,
    zoneOptions,
    cityOptions,
    clientTypeOptions,
    refs,
    filterPopover,
    setFilterPopover,
    searchFieldsSummary,
    toggleSearchField,
    selectAllSearchFields,
    toggleClientType,
    onApply,
    onReset
  } = props;

  const [selectCloseToken, setSelectCloseToken] = useState(0);
  const bumpSelectClose = () => setSelectCloseToken((t) => t + 1);

  const closeAuxAndSearch = () => {
    bumpSelectClose();
    setFilterPopover(null);
  };

  const handleApply = () => {
    closeAuxAndSearch();
    onApply();
  };

  const handleReset = () => {
    closeAuxAndSearch();
    onReset();
  };

  useEffect(() => {
    if (!filterPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterPopover(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterPopover, setFilterPopover]);

  const fmtOpts = (refs?.client_formats ?? []).map((x) => ({ value: x, label: x }));
  const catOpts =
    (refs?.category_options ?? []).length > 0
      ? (refs!.category_options ?? []).map((x) => ({ value: x.value, label: x.label }))
      : (refs?.categories ?? []).map((x) => ({ value: x, label: x }));

  const selectCloseProps = {
    closeToken: selectCloseToken,
    onOpenChange: (o: boolean) => {
      if (o) setFilterPopover(null);
    }
  } as const;

  return (
    <div className={cn("flex flex-col gap-3", MERGE_FILTER_PANEL_CLASS)}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="orders-filter-field-label min-w-[10rem] flex-1">
          <Label>Агент</Label>
          <FilterSearchableSelect
            emptyLabel="Все агенты"
            value={draft.agent_id}
            onValueChange={(v) => setDraft((d) => ({ ...d, agent_id: v }))}
            options={agentOptions}
            className={filterPanelSelectClassName}
            {...selectCloseProps}
          />
        </div>
        <div className="orders-filter-field-label min-w-[10rem] flex-1">
          <Label>Область</Label>
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.region}
            onValueChange={(v) => setDraft((d) => ({ ...d, region: v, zone: "", city: "" }))}
            options={regionOptions}
            className={filterPanelSelectClassName}
            {...selectCloseProps}
          />
        </div>
        <div className="orders-filter-field-label min-w-[10rem] flex-1">
          <Label>Зона</Label>
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.zone}
            onValueChange={(v) => setDraft((d) => ({ ...d, zone: v, city: "" }))}
            options={zoneOptions}
            disabled={zoneOptions.length === 0}
            className={filterPanelSelectClassName}
            {...selectCloseProps}
          />
        </div>
        <div className="orders-filter-field-label min-w-[10rem] flex-1">
          <Label>Город</Label>
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.city}
            onValueChange={(v) => setDraft((d) => ({ ...d, city: v }))}
            options={cityOptions}
            className={filterPanelSelectClassName}
            {...selectCloseProps}
          />
        </div>
        <div className="orders-filter-field-label min-w-[10rem] flex-1">
          <Label>Формат клиента</Label>
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.client_format}
            onValueChange={(v) => setDraft((d) => ({ ...d, client_format: v }))}
            options={fmtOpts}
            className={filterPanelSelectClassName}
            {...selectCloseProps}
          />
        </div>
        <div className="orders-filter-field-label min-w-[10rem] flex-1">
          <Label>Категория клиента</Label>
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.category}
            onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            options={catOpts}
            className={filterPanelSelectClassName}
            {...selectCloseProps}
          />
        </div>
        <div className="orders-filter-field-label relative min-w-[10rem] flex-1">
          <Label>Тип клиента</Label>
          <Button
            type="button"
            variant="outline"
            className={cn(filterPanelSelectClassName, "w-full justify-between bg-background font-normal")}
            onClick={() => {
              bumpSelectClose();
              setFilterPopover((p) => (p === "clientTypes" ? null : "clientTypes"));
            }}
          >
            <span className="truncate">
              {draft.client_type_codes.length === 0
                ? "Все типы"
                : `${draft.client_type_codes.length} выбрано`}
            </span>
          </Button>
          {filterPopover === "clientTypes" ? (
            <div
              data-merge-popover-root
              className="absolute left-0 top-full z-[480] mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-2 shadow-md"
            >
              {clientTypeOptions.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">Нет справочника типов</p>
              ) : (
                clientTypeOptions.map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-input"
                      checked={draft.client_type_codes.includes(o.value)}
                      onChange={(e) => toggleClientType(o.value, e.target.checked)}
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                ))
              )}
            </div>
          ) : null}
        </div>
        <div className="orders-filter-field-label min-w-[8rem]">
          <Label>Статус</Label>
          <FilterSelect
            emptyLabel="Все"
            className={filterPanelSelectClassName}
            value={draft.is_active === "all" ? "" : draft.is_active}
            onMouseDown={() => {
              bumpSelectClose();
              setFilterPopover(null);
            }}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({
                ...d,
                is_active: v === "" ? "all" : v === "yes" ? "yes" : "no"
              }));
            }}
          >
            <option value="yes">Активный</option>
            <option value="no">Не активный</option>
          </FilterSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
        <div className="orders-filter-field-label relative min-w-[12rem] flex-1">
          <Label>Поиск по</Label>
          <Button
            type="button"
            variant="outline"
            className={cn(filterPanelSelectClassName, "w-full max-w-[24rem] justify-between bg-background font-normal")}
            onClick={() => {
              bumpSelectClose();
              setFilterPopover((p) => (p === "searchFields" ? null : "searchFields"));
            }}
          >
            <span className="truncate text-left">{searchFieldsSummary}</span>
          </Button>
          {filterPopover === "searchFields" ? (
            <div
              data-merge-popover-root
              className="absolute left-0 top-full z-[480] mt-1 w-full max-w-md rounded-md border bg-popover p-2 shadow-md"
            >
              <button
                type="button"
                className="mb-2 text-xs text-primary hover:underline"
                onClick={() => selectAllSearchFields()}
              >
                Выбрать все
              </button>
              <div className="grid gap-1 sm:grid-cols-2">
                {SEARCH_FIELD_OPTS.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-input"
                      checked={draft.search_fields.includes(o.id)}
                      onChange={(e) => toggleSearchField(o.id, e.target.checked)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="orders-filter-field-label min-w-[12rem] flex-[2]">
          <Label>Строка поиска</Label>
          <Input
            placeholder="Название, ИНН, телефон…"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            className="h-10 bg-background"
          />
        </div>
        <div className="flex gap-2 pb-0.5">
          <Button type="button" variant="outline" size="icon" onClick={handleReset} title="Сброс">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button type="button" className="min-w-[7rem] shadow-sm" onClick={handleApply}>
            Применить
          </Button>
        </div>
      </div>
    </div>
  );
}

function DupTableToolbar(props: {
  dupLimit: number;
  setDupLimit: (n: number) => void;
  tableRowFilter: string;
  setTableRowFilter: (s: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className={MERGE_TOOLBAR_STRIP_CLASS}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={props.onRefresh}>
          <RefreshCw className={cn("h-4 w-4", props.loading && "animate-spin")} />
        </Button>
        <FilterSelect
          emptyLabel="Строк"
          className={cn(filterPanelSelectClassName, "w-20 min-w-[4.5rem]")}
          value={String(props.dupLimit)}
          onChange={(e) => props.setDupLimit(Number.parseInt(e.target.value, 10) || 10)}
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </FilterSelect>
      </div>
      <Input
        placeholder="Поиск в текущей странице…"
        value={props.tableRowFilter}
        onChange={(e) => props.setTableRowFilter(e.target.value)}
        className="h-9 max-w-xs bg-background"
      />
    </div>
  );
}

function DupCandidatesTable(props: {
  groups: DuplicateGroup[];
  loading: boolean;
  error: boolean;
  onOpenMerge: (g: DuplicateGroup) => void;
}) {
  return (
    <div className={MERGE_TABLE_SHELL_CLASS}>
      <Table className="bg-card">
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="!font-bold">Название клиента</TableHead>
            <TableHead className="!font-bold">Название фирмы</TableHead>
            <TableHead className="!font-bold">ИНН</TableHead>
            <TableHead className="!font-bold">ПИНФЛ</TableHead>
            <TableHead className="!font-bold">Телефон</TableHead>
            <TableHead className="!font-bold">Номер договора</TableHead>
            <TableHead className="!font-bold">Адрес</TableHead>
            <TableHead className="!text-right !font-bold">Кол-во похожих</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Загрузка…
              </TableCell>
            </TableRow>
          ) : props.error ? (
            <TableRow>
              <TableCell colSpan={8} className="text-destructive">
                Ошибка загрузки
              </TableCell>
            </TableRow>
          ) : !props.groups.length ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                Нет данных по текущим фильтрам.
              </TableCell>
            </TableRow>
          ) : (
            props.groups.map((g) => {
              const p = g.previews[0];
              if (!p) return null;
              return (
                <TableRow key={`${g.reason}-${g.key}`} className="even:bg-muted/20">
                  <TableCell className="max-w-[200px] font-medium">
                    <Link href={`/clients/${p.id}`} className="text-primary hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">{p.legal_name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{p.inn?.trim() || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{formatPinflDisplay(p.client_pinfl)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{p.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm">{p.contract_number?.trim() || "—"}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm">{p.address?.trim() || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 border-primary/40"
                      onClick={() => props.onOpenMerge(g)}
                    >
                      <Store className="h-4 w-4" />
                      {g.count}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DupPagination(props: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}) {
  const from = props.total === 0 ? 0 : (props.page - 1) * props.limit + 1;
  const to = Math.min(props.page * props.limit, props.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Показано {from} – {to} / {props.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2">
          {props.page} / {props.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function MergedPagination(props: {
  page: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(props.total / props.limit));
  const from = props.total === 0 ? 0 : (props.page - 1) * props.limit + 1;
  const to = Math.min(props.page * props.limit, props.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Показано {from} – {to} / {props.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2">
          {props.page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={props.page >= totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
