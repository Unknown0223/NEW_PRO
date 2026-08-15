"use client";

import type { ClientMapControlsHandle, ClientMapPoint } from "@/components/clients/clients-leaflet-map";
import { ClientMapCategoryStats } from "@/components/clients/map/client-map-category-stats";
import { ClientMapFiltersPanel } from "@/components/clients/map/client-map-filters-panel";
import { ClientMapSelectedPanel } from "@/components/clients/map/client-map-selected-panel";
import { ClientMapPanelHeader } from "@/components/clients/map/client-map-ui";
import {
  ClientMapBottomLinks,
  ClientMapSearchToolbar,
  ClientMapZoomControls
} from "@/components/clients/map/client-map-toolbar";
import { GROUP_PROCESSING_IDS_STORAGE_KEY } from "@/components/clients/group-processing/group-processing-actions";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import {
  applyClientMapFilters,
  computeCategoryCounts,
  INITIAL_CLIENT_MAP_FILTERS,
  type ClientMapFiltersState
} from "@/lib/client-map-filters";
import type { ClientRow } from "@/lib/client-types";
import { mergeRefSelectOptions } from "@/lib/ref-select-options";
import { buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ClientsLeafletMapDynamic = dynamic(
  () =>
    import("@/components/clients/clients-leaflet-map").then((m) => ({
      default: m.ClientsLeafletMap
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[460px] items-center justify-center bg-muted">
        <p className="text-sm text-slate-500">Карта (Yandex) загружается…</p>
      </div>
    )
  }
);

function hasCoords(c: ClientRow): boolean {
  const lat = c.latitude != null && c.latitude !== "" ? parseFloat(c.latitude) : NaN;
  const lon = c.longitude != null && c.longitude !== "" ? parseFloat(c.longitude) : NaN;
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function parseFocusIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ].slice(0, 5000);
}

function loadStoredFocusIds(): number[] {
  try {
    const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 5000);
  } catch {
    return [];
  }
}

type PanelSection = "filter" | "category";

type ClientRefOptionDto = { value: string; label: string };

type ClientReferencesResponse = {
  categories?: string[];
  client_type_codes?: string[];
  zones?: string[];
  regions?: string[];
  cities?: string[];
  category_options?: ClientRefOptionDto[];
  client_type_options?: ClientRefOptionDto[];
  city_options?: ClientRefOptionDto[];
  region_options?: ClientRefOptionDto[];
};

export function ClientMapWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const mapControlsRef = useRef<ClientMapControlsHandle | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const seedFocusIds = useMemo(() => {
    const fromQ = parseFocusIds(searchParams.get("ids"));
    if (fromQ.length) return fromQ;
    if (searchParams.get("from") === "group") return loadStoredFocusIds();
    return [];
  }, [searchParams]);

  const [focusIds, setFocusIds] = useState<number[] | null>(() =>
    seedFocusIds.length ? seedFocusIds : null
  );

  useEffect(() => {
    setFocusIds(seedFocusIds.length ? seedFocusIds : null);
  }, [seedFocusIds]);

  const [draftFilters, setDraftFilters] = useState<ClientMapFiltersState>(INITIAL_CLIENT_MAP_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ClientMapFiltersState>(INITIAL_CLIENT_MAP_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<PanelSection>("filter");

  const clientsQ = useQuery({
    queryKey: ["clients", tenantSlug, "map", "gps"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientRow[]; total: number }>(
        `/api/${tenantSlug}/clients?page=1&limit=3500&map=1&has_coords=1&sort=name&order=asc`
      );
      return data;
    }
  });

  const refsQ = useQuery({
    queryKey: ["clients", tenantSlug, "references", "map"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientReferencesResponse>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "map"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/agents`);
      return data.data.filter((r) => r.is_active).map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const allClients = useMemo(() => clientsQ.data?.data ?? [], [clientsQ.data?.data]);
  const gpsTotal = clientsQ.data?.total ?? allClients.length;
  const refData = refsQ.data;
  const focusSet = useMemo(() => (focusIds?.length ? new Set(focusIds) : null), [focusIds]);

  const cityLabelByValue = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of refData?.city_options ?? []) {
      if (o?.value) m[o.value] = o.label || o.value;
    }
    return m;
  }, [refData?.city_options]);

  const regionLabelByValue = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of refData?.region_options ?? []) {
      if (o?.value) m[o.value] = o.label || o.value;
    }
    return m;
  }, [refData?.region_options]);

  const territoryCascade = useMemo(
    () =>
      buildZoneRegionCityCascadeOptions(refData, undefined, undefined, {
        zone: "",
        region: "",
        city: ""
      }),
    [refData]
  );

  const categorySelectOptions = useMemo(() => {
    if (!refData) return [];
    if (refData.category_options?.length) {
      return mergeRefSelectOptions("", refData.category_options, refData.categories);
    }
    return (refData.categories ?? []).map((v: string) => ({ value: v, label: v }));
  }, [refData]);

  const clientTypeSelectOptions = useMemo(() => {
    if (!refData) return [];
    if (refData.client_type_options?.length) {
      return mergeRefSelectOptions("", refData.client_type_options, refData.client_type_codes);
    }
    return (refData.client_type_codes ?? []).map((v: string) => ({ value: v, label: v }));
  }, [refData]);

  const clientTypeLabelByValue = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of clientTypeSelectOptions) {
      m.set(o.value, o.label);
    }
    return m;
  }, [clientTypeSelectOptions]);

  const agentSelectOptions = useMemo(() => {
    const fromApi = (agentsQ.data ?? []).map((a) => ({
      value: String(a.id),
      label: a.name || a.login || `Agent #${a.id}`
    }));
    if (fromApi.length > 0) return fromApi;
    const m = new Map<number, string>();
    for (const c of allClients) {
      if (c.agent_id != null && c.agent_id > 0) {
        m.set(c.agent_id, c.agent_name?.trim() || `Agent #${c.agent_id}`);
      }
    }
    return [...m.entries()]
      .map(([id, label]) => ({ value: String(id), label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [agentsQ.data, allClients]);

  const clientsWithGps = useMemo(() => allClients.filter(hasCoords), [allClients]);

  const focusStats = useMemo(() => {
    if (!focusSet) return null;
    const withGps = clientsWithGps.filter((c) => focusSet.has(c.id)).length;
    return {
      total: focusSet.size,
      withGps,
      withoutGps: Math.max(0, focusSet.size - withGps)
    };
  }, [focusSet, clientsWithGps]);

  const filteredClients = useMemo(() => {
    const base = focusSet ? clientsWithGps.filter((c) => focusSet.has(c.id)) : clientsWithGps;
    return applyClientMapFilters(base, appliedFilters, {
      regionLabelByValue,
      cityLabelByValue,
      search: appliedSearch
    });
  }, [clientsWithGps, appliedFilters, regionLabelByValue, cityLabelByValue, appliedSearch, focusSet]);

  const categoryStats = useMemo(
    () => computeCategoryCounts(focusSet ? clientsWithGps.filter((c) => focusSet.has(c.id)) : clientsWithGps),
    [clientsWithGps, focusSet]
  );

  const clientsWithCoords: ClientMapPoint[] = useMemo(
    () =>
      filteredClients
        .map((c) => ({
          ...c,
          city: c.city ? cityLabelByValue[c.city] ?? c.city : c.city,
          region: c.region ? regionLabelByValue[c.region] ?? c.region : c.region,
          lat: parseFloat(c.latitude!),
          lon: parseFloat(c.longitude!)
        }))
        .filter((c) => !isNaN(c.lat) && !isNaN(c.lon)),
    [filteredClients, cityLabelByValue, regionLabelByValue]
  );

  const selectedClient = useMemo(
    () => (selectedClientId != null ? clientsWithCoords.find((c) => c.id === selectedClientId) ?? null : null),
    [selectedClientId, clientsWithCoords]
  );

  const selectedClientTypeLabel = useMemo(() => {
    if (!selectedClient?.client_type_code) return undefined;
    return clientTypeLabelByValue.get(selectedClient.client_type_code.trim());
  }, [selectedClient, clientTypeLabelByValue]);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...draftFilters });
    setSelectedClientId(null);
  }, [draftFilters]);

  const handleResetFilters = useCallback(() => {
    setDraftFilters(INITIAL_CLIENT_MAP_FILTERS);
    setAppliedFilters(INITIAL_CLIENT_MAP_FILTERS);
    setSearchDraft("");
    setAppliedSearch("");
    setSelectedClientId(null);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusIds(null);
    setSelectedClientId(null);
    try {
      sessionStorage.removeItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    router.replace("/clients/map");
  }, [router]);

  const handleFindOnMap = useCallback(() => {
    setAppliedSearch(searchDraft.trim());
    const q = searchDraft.trim().toLowerCase();
    if (!q) return;
    const found = clientsWithCoords.find(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.region && c.region.toLowerCase().includes(q))
    );
    if (found) {
      setSelectedClientId(found.id);
      mapControlsRef.current?.flyTo(found.lat, found.lon, 14);
    }
  }, [searchDraft, clientsWithCoords]);

  const onDraftChange = useCallback((patch: Partial<ClientMapFiltersState>) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const displayedTotal = focusSet ? (focusStats?.withGps ?? clientsWithCoords.length) : gpsTotal;

  if (!authHydrated) {
    return (
      <PageShell className="flex flex-1 items-center justify-center bg-transparent">
        <p className="text-sm text-slate-500">Загрузка сессии…</p>
      </PageShell>
    );
  }

  if (!tenantSlug) {
    return (
      <PageShell className="flex flex-1 items-center justify-center bg-transparent">
        <p className="text-sm text-destructive">Tenant не найден.</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="flex min-h-0 flex-1 flex-col bg-transparent p-0 pb-0">
      <div className="shrink-0 px-4 pb-4 pt-5 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-950">Клиенты на карте</h1>
        <p className="mt-1 text-base text-slate-400">
          Отображено клиентов на карте ({clientsQ.isLoading ? "…" : clientsWithCoords.length}
          {displayedTotal !== clientsWithCoords.length ? ` из ${displayedTotal}` : ""})
        </p>
        {focusStats ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <span>
              Выбрано из списка: <b>{focusStats.total}</b>
              {focusStats.withGps > 0 ? (
                <>
                  {" "}
                  · с GPS: <b>{focusStats.withGps}</b>
                </>
              ) : null}
              {focusStats.withoutGps > 0 ? (
                <>
                  {" "}
                  · без координат: <b>{focusStats.withoutGps}</b>
                </>
              ) : null}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={clearFocus}>
              Показать всех
            </Button>
          </div>
        ) : null}
      </div>

      {clientsQ.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <p className="text-sm text-slate-500">Загрузка клиентов…</p>
        </div>
      ) : clientsQ.isError ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <p className="text-sm text-destructive">Не удалось загрузить клиентов.</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-5 sm:px-6 lg:flex-row">
          <aside className="w-full shrink-0 overflow-hidden rounded-md bg-card shadow-sm lg:w-[300px]">
            <ClientMapPanelHeader
              open={activeSection === "filter"}
              title="Фильтр"
              onClick={() => setActiveSection("filter")}
            />
            {activeSection === "filter" ? (
              <ClientMapFiltersPanel
                draft={draftFilters}
                onDraftChange={onDraftChange}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                agentOptions={agentSelectOptions}
                categoryOptions={categorySelectOptions}
                clientTypeOptions={clientTypeSelectOptions}
                zoneOptions={territoryCascade.zones}
                regionOptions={territoryCascade.regions}
                cityOptions={territoryCascade.cities}
              />
            ) : null}

            <ClientMapPanelHeader
              open={activeSection === "category"}
              title="Количество по категориям"
              onClick={() => setActiveSection("category")}
            />
            {activeSection === "category" ? <ClientMapCategoryStats rows={categoryStats} /> : null}
          </aside>

          <section className="relative min-h-[460px] min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
            <ClientMapSearchToolbar
              searchQuery={searchDraft}
              onSearchChange={setSearchDraft}
              onFind={handleFindOnMap}
            />
            <ClientMapBottomLinks />
            <ClientMapZoomControls
              onZoomIn={() => mapControlsRef.current?.zoomIn()}
              onZoomOut={() => mapControlsRef.current?.zoomOut()}
              onReset={() => mapControlsRef.current?.resetView()}
            />

            {clientsWithCoords.length === 0 ? (
              <div className="flex h-full min-h-[460px] items-center justify-center px-6 text-center">
                <p className="text-sm text-slate-500">
                  {focusSet
                    ? "У выбранных клиентов нет координат на карте."
                    : allClients.length === 0
                      ? "Клиенты не найдены."
                      : "Нет клиентов по выбранным фильтрам."}
                </p>
              </div>
            ) : (
              <ClientsLeafletMapDynamic
                clients={clientsWithCoords}
                selectedClientId={selectedClientId}
                selectedClientIds={focusIds ?? undefined}
                fillHeight
                hideBuiltinControls
                mapControlsRef={mapControlsRef}
                onClientClick={(c) => setSelectedClientId(c.id)}
              />
            )}

            {selectedClient ? (
              <ClientMapSelectedPanel
                client={selectedClient}
                clientTypeLabel={selectedClientTypeLabel}
                onClose={() => setSelectedClientId(null)}
              />
            ) : null}
          </section>
        </div>
      )}
    </PageShell>
  );
}
