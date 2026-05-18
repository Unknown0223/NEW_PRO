"use client";

import type { ClientMapPoint } from "@/components/clients/clients-leaflet-map";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import type { ClientRow } from "@/lib/client-types";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Users, Layers } from "lucide-react";

const ClientsLeafletMapDynamic = dynamic(
  () =>
    import("@/components/clients/clients-leaflet-map").then((m) => ({
      default: m.ClientsLeafletMap
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center rounded-lg border bg-muted/20">
        <p className="text-sm text-muted-foreground">Карта (Yandex) загружается…</p>
      </div>
    )
  }
);

function hasCoords(c: ClientRow): boolean {
  const lat = c.latitude != null && c.latitude !== "" ? parseFloat(c.latitude) : NaN;
  const lon = c.longitude != null && c.longitude !== "" ? parseFloat(c.longitude) : NaN;
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export default function ClientsMapPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const [allClients, setAllClients] = useState<ClientRow[]>([]);
  /** API `total` — GPS bor klientlar soni (has_coords=1) */
  const [gpsClientsTotal, setGpsClientsTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hasLocationOnly, setHasLocationOnly] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSalesChannel, setSelectedSalesChannel] = useState("");
  const [cityLabelByValue, setCityLabelByValue] = useState<Record<string, string>>({});
  const [regionLabelByValue, setRegionLabelByValue] = useState<Record<string, string>>({});
  const [regionRefOptions, setRegionRefOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [cityRefOptions, setCityRefOptions] = useState<Array<{ value: string; label: string }>>([]);

  const fetchClients = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [{ data: body }, { data: refs }] = await Promise.all([
        api.get<{ data: ClientRow[]; total: number }>(
          `/api/${tenantSlug}/clients?page=1&limit=3500&map=1&has_coords=1&sort=name&order=asc`
        ),
        api.get<{
          city_options?: Array<{ value: string; label: string }>;
          region_options?: Array<{ value: string; label: string }>;
        }>(`/api/${tenantSlug}/clients/references`)
      ]);
      setAllClients(body.data ?? []);
      setGpsClientsTotal(typeof body.total === "number" ? body.total : null);
      const cityMap: Record<string, string> = {};
      for (const o of refs.city_options ?? []) {
        if (o?.value) cityMap[o.value] = o.label || o.value;
      }
      setCityLabelByValue(cityMap);
      setCityRefOptions((refs.city_options ?? []).filter((o): o is { value: string; label: string } => Boolean(o?.value)));
      const regionMap: Record<string, string> = {};
      for (const o of refs.region_options ?? []) {
        if (o?.value) regionMap[o.value] = o.label || o.value;
      }
      setRegionLabelByValue(regionMap);
      setRegionRefOptions((refs.region_options ?? []).filter((o): o is { value: string; label: string } => Boolean(o?.value)));
    } catch (e) {
      console.error("Failed to fetch clients for map", e);
      setAllClients([]);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug) void fetchClients();
  }, [tenantSlug, fetchClients]);

  const agentOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of allClients) {
      if (c.agent_id != null && c.agent_id > 0) {
        m.set(c.agent_id, c.agent_name?.trim() || `Agent #${c.agent_id}`);
      }
    }
    return [...m.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [allClients]);
  const regionOptions = useMemo(() => {
    if (regionRefOptions.length > 0) {
      return [...new Set(regionRefOptions.map((o) => o.value))];
    }
    return [...new Set(allClients.map((c) => c.region).filter((x): x is string => Boolean(x && x.trim())))].sort((a, b) => a.localeCompare(b, "ru"));
  }, [allClients, regionRefOptions]);
  const regionOptionLabels = useMemo(
    () =>
      regionOptions.map((x) => ({
        raw: x,
        label: regionLabelByValue[x] ?? x
      })),
    [regionOptions, regionLabelByValue]
  );
  const categoryOptions = useMemo(
    () => [...new Set(allClients.map((c) => c.category).filter((x): x is string => Boolean(x && x.trim())))].sort((a, b) => a.localeCompare(b, "ru")),
    [allClients]
  );
  const cityOptions = useMemo(() => {
    if (cityRefOptions.length > 0) {
      return [...new Set(cityRefOptions.map((o) => o.value))];
    }
    return [...new Set(allClients.map((c) => c.city).filter((x): x is string => Boolean(x && x.trim())))].sort((a, b) => a.localeCompare(b, "ru"));
  }, [allClients, cityRefOptions]);
  const salesChannelOptions = useMemo(
    () => [...new Set(allClients.map((c) => c.sales_channel).filter((x): x is string => Boolean(x && x.trim())))].sort((a, b) => a.localeCompare(b, "ru")),
    [allClients]
  );

  const mapClients = allClients
    .filter((c) => !hasLocationOnly || hasCoords(c))
    .filter((c) => (selectedAgentId == null ? true : c.agent_id === selectedAgentId))
    .filter((c) => {
      if (!selectedRegion) return true;
      const raw = c.region ?? "";
      const rawNorm = norm(raw);
      const selectedNorm = norm(selectedRegion);
      const rawLabelNorm = norm(regionLabelByValue[raw] ?? raw);
      const selectedLabelNorm = norm(regionLabelByValue[selectedRegion] ?? selectedRegion);
      return rawNorm === selectedNorm || rawLabelNorm === selectedLabelNorm;
    })
    .filter((c) => {
      if (!selectedCity) return true;
      const raw = c.city ?? "";
      const rawNorm = norm(raw);
      const selectedNorm = norm(selectedCity);
      const rawLabelNorm = norm(cityLabelByValue[raw] ?? raw);
      const selectedLabelNorm = norm(cityLabelByValue[selectedCity] ?? selectedCity);
      return rawNorm === selectedNorm || rawLabelNorm === selectedLabelNorm;
    })
    .filter((c) => (selectedCategory ? c.category === selectedCategory : true))
    .filter((c) => (selectedSalesChannel ? c.sales_channel === selectedSalesChannel : true))
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.region && c.region.toLowerCase().includes(q)) ||
        (c.district && c.district.toLowerCase().includes(q))
      );
    });

  const clientsWithCoords: ClientMapPoint[] = mapClients
    .filter(hasCoords)
    .map((c) => ({
      ...c,
      city: c.city ? cityLabelByValue[c.city] ?? c.city : c.city,
      region: c.region ? regionLabelByValue[c.region] ?? c.region : c.region,
      lat: parseFloat(c.latitude!),
      lon: parseFloat(c.longitude!)
    }))
    .filter((c) => !isNaN(c.lat) && !isNaN(c.lon));

  const selectableClients = useMemo(
    () =>
      clientsWithCoords
        .map((c) => ({ id: c.id, name: c.name }))
        .slice(0, 600),
    [clientsWithCoords]
  );
  const agentSelectOptions = useMemo(
    () => agentOptions.map((a) => ({ value: String(a.id), label: a.label })),
    [agentOptions]
  );
  const regionSelectOptions = useMemo(
    () => regionOptionLabels.map((o) => ({ value: o.raw, label: o.label })),
    [regionOptionLabels]
  );
  const salesChannelSelectOptions = useMemo(
    () => salesChannelOptions.map((x) => ({ value: x, label: x })),
    [salesChannelOptions]
  );
  const citySelectOptions = useMemo(
    () => cityOptions.map((x) => ({ value: x, label: cityLabelByValue[x] ?? x })),
    [cityLabelByValue, cityOptions]
  );
  const categorySelectOptions = useMemo(
    () => categoryOptions.map((x) => ({ value: x, label: x })),
    [categoryOptions]
  );
  const clientSelectOptions = useMemo(
    () => selectableClients.map((c) => ({ value: String(c.id), label: c.name })),
    [selectableClients]
  );

  const totalWithCoords = allClients.filter(hasCoords).length;

  return (
    <PageShell>
      <PageHeader
        title="Карта клиентов"
        description={
          tenantSlug
            ? `Yandex Map. Клиенты с GPS (сервер): ${gpsClientsTotal ?? totalWithCoords}.`
            : "Клиенты с GPS-координатами"
        }
        actions={
          <>
            <Link
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              href="/clients"
            >
              К списку клиентов
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              href="/clients/new"
            >
              Новый клиент
            </Link>
          </>
        }
      />

      {!authHydrated ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
        </div>
      ) : !tenantSlug ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-destructive">Tenant не найден.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Загрузка клиентов…</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Клиенты на карте</CardTitle>
              <p className="text-xs text-muted-foreground">Отображено: {clientsWithCoords.length}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-md border bg-muted/20 p-2">
                <p className="mb-1 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Агент ({clientsWithCoords.length}/{gpsClientsTotal ?? allClients.length})
                </p>
                <FilterSearchableSelect
                  emptyLabel="— Все агенты —"
                  value={selectedAgentId == null ? "" : String(selectedAgentId)}
                  onValueChange={(v) => {
                    const n = Number.parseInt(v, 10);
                    setSelectedAgentId(Number.isFinite(n) ? n : null);
                  }}
                  options={agentSelectOptions}
                  searchPlaceholder="Поиск агента"
                  className="h-9 rounded-md text-xs"
                />
              </div>

              <div className="rounded-md border bg-muted/20 p-2">
                <p className="mb-1 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Фильтры поиска
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Адрес или объект"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={hasLocationOnly}
                      onChange={(e) => setHasLocationOnly(e.target.checked)}
                      className="accent-primary"
                    />
                    Только с координатами
                  </label>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Область</label>
                    <FilterSearchableSelect
                      emptyLabel="— Все области —"
                      value={selectedRegion}
                      onValueChange={setSelectedRegion}
                      options={regionSelectOptions}
                      searchPlaceholder="Поиск области"
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Город</label>
                    <FilterSearchableSelect
                      emptyLabel="— Все города —"
                      value={selectedCity}
                      onValueChange={setSelectedCity}
                      options={citySelectOptions}
                      searchPlaceholder="Поиск города"
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Канал продаж</label>
                    <FilterSearchableSelect
                      emptyLabel="— Все каналы —"
                      value={selectedSalesChannel}
                      onValueChange={setSelectedSalesChannel}
                      options={salesChannelSelectOptions}
                      searchPlaceholder="Поиск канала"
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Выделить одного клиента</label>
                    <FilterSearchableSelect
                      emptyLabel="— Не выбрано —"
                      value={selectedClientId == null ? "" : String(selectedClientId)}
                      onValueChange={(v) => {
                        const n = Number.parseInt(v, 10);
                        setSelectedClientId(Number.isFinite(n) ? n : null);
                      }}
                      options={clientSelectOptions}
                      searchPlaceholder="Поиск клиента"
                      className="h-9 rounded-md text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-2">
                <p className="mb-1 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  Количество по категориям
                </p>
                <div className="space-y-2">
                  <label className="text-[11px] text-muted-foreground">Категория</label>
                  <FilterSearchableSelect
                    emptyLabel="— Все категории —"
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                    options={categorySelectOptions}
                    searchPlaceholder="Поиск категории"
                    className="h-9 rounded-md text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">После выбора карта покажет только клиентов этой категории.</p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setSearch("");
                  setHasLocationOnly(true);
                  setSelectedClientId(null);
                  setSelectedAgentId(null);
                  setSelectedRegion("");
                  setSelectedCity("");
                  setSelectedCategory("");
                  setSelectedSalesChannel("");
                }}
              >
                Сбросить фильтры
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchClients}
                disabled={loading || !tenantSlug}
                className="w-full"
              >
                {loading ? "Обновление…" : "Обновить"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-panel">
            <CardContent className="p-1.5 sm:p-2">
              {clientsWithCoords.length === 0 ? (
                <div className="flex h-[640px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    {allClients.length === 0 ? "Клиенты не найдены." : "Нет клиентов с координатами."}
                  </p>
                </div>
              ) : (
                <ClientsLeafletMapDynamic clients={clientsWithCoords} selectedClientId={selectedClientId} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
