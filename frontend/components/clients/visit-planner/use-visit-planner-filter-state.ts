"use client";

import { useGeoBoundaries } from "@/hooks/use-geo-boundaries";
import { useVisitPlannerCatalog } from "@/hooks/use-visit-planner-catalog";
import { territoryFieldMatches } from "@/lib/visit-planner-geo-filter";
import type { ClientRow } from "@/lib/client-types";
import {
  buildZoneRegionCityCascadeOptions,
  type ClientRefsTerritoryBundle
} from "@/lib/territory-client-filters";
import type { ClientBalanceTerritoryOptions } from "@/lib/client-balances-types";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { PickOption } from "@/components/clients/visit-planner/visit-planner-pickers";
import type { VisitMapPolygon } from "@/components/clients/visit-planner/visit-planner-yandex-map";
import { clientInPolygon } from "@/lib/geo-polygon";
import { resolveBoundaryColor } from "@/lib/geo-boundary-colors";
import {
  cityStoredCodeToDisplayLabel,
  pickCityTerritoryHint,
  type CityTerritoryHint
} from "@/lib/city-territory-hint";
import {
  boundsCenterForAdminTokens,
  buildAdminRegionMapPolygons,
  findAdminRegionForToken,
  loadUzAdminRegions,
  pointInAdminRegion,
  type UzAdminRegion
} from "@/lib/uz-admin-regions";
import { lalakuExpandRegionFilterTokens } from "@shared/territory-lalaku-seed";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

function clientRegionLabel(
  c: ClientRow,
  hints: Record<string, CityTerritoryHint> | undefined
): string {
  const direct = (c.region ?? "").trim();
  if (direct) return direct;
  const hint = pickCityTerritoryHint(hints, c.city ?? "");
  return hint?.region_stored?.trim() || hint?.region_label?.trim() || "";
}

function clientCityStored(c: ClientRow): string {
  return (c.city ?? "").trim();
}

function clientMatchesCity(
  c: ClientRow,
  tokens: string[],
  hints: Record<string, CityTerritoryHint> | undefined,
  cityOpts: { value: string; label: string }[]
): boolean {
  if (tokens.length === 0) return true;
  const stored = clientCityStored(c);
  if (!stored) return false;
  const hint = pickCityTerritoryHint(hints, stored);
  const label =
    hint?.city_label?.trim() ||
    cityOpts.find((o) => o.value === stored || o.label === stored)?.label ||
    cityStoredCodeToDisplayLabel(stored);

  return tokens.some(
    (t) =>
      territoryFieldMatches(stored, t) ||
      territoryFieldMatches(label, t) ||
      (hint?.city_label != null && territoryFieldMatches(hint.city_label, t))
  );
}

function clientMatchesBranch(
  c: ClientRow,
  refId: string,
  branchItems: { ref_id: string; name: string }[],
  boundaries: { kind: string; ref_id: string; polygon: { lat: number; lng: number }[] }[]
): boolean {
  const branch = branchItems.find((b) => b.ref_id === refId);
  if (!branch) return false;

  const saved = boundaries.find((b) => b.kind === "branch" && b.ref_id === refId && b.polygon.length >= 3);

  if (saved) {
    const lat = c.latitude != null ? parseFloat(c.latitude) : NaN;
    const lng = c.longitude != null ? parseFloat(c.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return clientInPolygon(lat, lng, saved.polygon);
  }

  return (
    territoryFieldMatches(c.zone, branch.name) ||
    territoryFieldMatches(c.city, branch.name) ||
    territoryFieldMatches(c.region, branch.name)
  );
}
function buildRegionMatcher(
  tokens: string[],
  hints: Record<string, CityTerritoryHint> | undefined,
  adminRegions: UzAdminRegion[]
) {
  const expanded = new Set<string>();
  for (const t of tokens) {
    for (const x of lalakuExpandRegionFilterTokens(t)) expanded.add(x);
    expanded.add(t);
  }
  const expandedList = [...expanded];
  const adminByToken = tokens.map((t) => findAdminRegionForToken(t, adminRegions)).filter((x): x is UzAdminRegion => Boolean(x));

  return (c: ClientRow): boolean => {
    const label = clientRegionLabel(c, hints);
    if (label && expandedList.some((t) => territoryFieldMatches(label, t))) return true;
    if ((c.region ?? "").trim() && expandedList.some((t) => territoryFieldMatches(c.region, t))) return true;

    if (adminByToken.length === 0) return false;
    const lat = c.latitude != null ? parseFloat(c.latitude) : NaN;
    const lng = c.longitude != null ? parseFloat(c.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (label) return false;
    return adminByToken.some((admin) => pointInAdminRegion(lat, lng, admin));
  };
}

export function useVisitPlannerFilterState(tenantSlug: string | null, clientsWithGps: ClientRow[]) {
  const { itemsByKind, profileQ } = useVisitPlannerCatalog(tenantSlug);
  const { q: boundariesQ } = useGeoBoundaries(tenantSlug);

  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [adminRegions, setAdminRegions] = useState<UzAdminRegion[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);

  const deferredRegionFilter = useDeferredValue(regionFilter);
  const deferredBranchFilter = useDeferredValue(branchFilter);
  const deferredCityFilter = useDeferredValue(cityFilter);

  useEffect(() => {
    let cancelled = false;
    setAdminLoading(true);
    loadUzAdminRegions()
      .then((list) => {
        if (!cancelled) setAdminRegions(list);
      })
      .catch(() => {
        if (!cancelled) setAdminRegions([]);
      })
      .finally(() => {
        if (!cancelled) setAdminLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filial yoki hudud o‘zgaganda shahar tanlovini tozalash (kaskad)
  useEffect(() => {
    setCityFilter([]);
  }, [regionFilter, branchFilter]);

  const refs = profileQ.data?.references;
  const territoryNodes = (refs?.territory_nodes ?? []) as TerritoryNode[];
  const cityHints = (refs as { city_territory_hints?: Record<string, CityTerritoryHint> } | undefined)
    ?.city_territory_hints;
  const cityRefOpts = (refs as { city_options?: { value: string; label: string }[] } | undefined)
    ?.city_options ?? [];

  const liveTerritory = useMemo(() => {
    const zones = new Set<string>();
    const regions = new Set<string>();
    const citySet = new Set<string>();
    for (const c of clientsWithGps) {
      if (c.zone?.trim()) zones.add(c.zone.trim());
      if (c.region?.trim()) regions.add(c.region.trim());
      if (c.city?.trim()) citySet.add(c.city.trim());
      const hint = pickCityTerritoryHint(cityHints, c.city ?? "");
      if (hint?.region_stored?.trim()) regions.add(hint.region_stored.trim());
    }
    return {
      zones: [...zones],
      regions: [...regions],
      cities: [...citySet],
      districts: [] as string[],
      neighborhoods: [] as string[],
      branches: [] as string[]
    };
  }, [clientsWithGps, cityHints]);

  const refsBundle: ClientRefsTerritoryBundle = useMemo(() => {
    const r = refs as ClientRefsTerritoryBundle | undefined;
    return {
      zones: r?.zones,
      regions: r?.regions,
      cities: r?.cities,
      city_options: r?.city_options,
      region_options: r?.region_options
    };
  }, [refs]);

  const cascade = useMemo(
    () =>
      buildZoneRegionCityCascadeOptions(refsBundle, liveTerritory as ClientBalanceTerritoryOptions, territoryNodes, {
        zone: "",
        region: regionFilter[0] ?? "",
        city: ""
      }),
    [refsBundle, liveTerritory, territoryNodes, regionFilter]
  );

  const branchItems = itemsByKind.branch ?? [];
  const boundaries = boundariesQ.data ?? [];

  const regionOptions: PickOption[] = useMemo(
    () =>
      cascade.regions.map((r) => ({
        value: r.value,
        label: r.label,
        searchText: r.value
      })),
    [cascade.regions]
  );

  const branchOptions: PickOption[] = useMemo(
    () =>
      branchItems.map((b) => ({
        value: b.ref_id,
        label: b.name,
        subtitle: b.subtitle,
        searchText: b.subtitle
      })),
    [branchItems]
  );

  const filterReady = regionFilter.length > 0 || branchFilter.length > 0;
  const deferredFilterReady = deferredRegionFilter.length > 0 || deferredBranchFilter.length > 0;

  /** Filial/hudud bo‘yicha (shaharsiz) — shahar dropdown uchun baza. */
  const clientsAfterTerritory = useMemo(() => {
    if (!deferredFilterReady) return [];

    let list = clientsWithGps;

    if (deferredRegionFilter.length > 0) {
      const matchRegion = buildRegionMatcher(deferredRegionFilter, cityHints, adminRegions);
      list = list.filter(matchRegion);
    }

    if (deferredBranchFilter) {
      list = list.filter((c) => clientMatchesBranch(c, deferredBranchFilter, branchItems, boundaries));
    }

    return list;
  }, [
    clientsWithGps,
    deferredRegionFilter,
    deferredBranchFilter,
    branchItems,
    boundaries,
    cityHints,
    adminRegions,
    deferredFilterReady
  ]);

  const cityOptions: PickOption[] = useMemo(() => {
    if (!filterReady) return [];

    const fromCascade = new Map<string, string>();
    for (const o of cascade.cities) {
      fromCascade.set(o.value, o.label || o.value);
    }

    // Multi-region: har bir hudud uchun cascade shaharlarini qo‘shamiz
    if (regionFilter.length > 1) {
      for (const reg of regionFilter) {
        const part = buildZoneRegionCityCascadeOptions(
          refsBundle,
          liveTerritory as ClientBalanceTerritoryOptions,
          territoryNodes,
          { zone: "", region: reg, city: "" }
        );
        for (const o of part.cities) {
          if (!fromCascade.has(o.value)) fromCascade.set(o.value, o.label || o.value);
        }
      }
    }

    const seen = new Map<string, PickOption>();
    for (const c of clientsAfterTerritory) {
      const stored = clientCityStored(c);
      if (!stored) continue;
      if (seen.has(stored)) continue;
      const hint = pickCityTerritoryHint(cityHints, stored);
      const optLabel =
        fromCascade.get(stored) ||
        cityRefOpts.find((o) => o.value === stored)?.label ||
        hint?.city_label ||
        cityStoredCodeToDisplayLabel(stored);
      seen.set(stored, {
        value: stored,
        label: optLabel,
        searchText: `${stored} ${optLabel}`
      });
    }

    // Katalogdagi shaharlar (hudud tanlanganda) — GPS bo‘lmasa ham tanlash mumkin
    for (const [value, label] of fromCascade) {
      if (!seen.has(value)) {
        seen.set(value, { value, label, searchText: `${value} ${label}` });
      }
    }

    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [
    filterReady,
    cascade.cities,
    regionFilter,
    refsBundle,
    liveTerritory,
    territoryNodes,
    clientsAfterTerritory,
    cityHints,
    cityRefOpts
  ]);

  const filteredClients = useMemo(() => {
    if (!deferredFilterReady) return [];
    let list = clientsAfterTerritory;
    if (deferredCityFilter.length > 0) {
      list = list.filter((c) => clientMatchesCity(c, deferredCityFilter, cityHints, cityRefOpts));
    }
    return list;
  }, [clientsAfterTerritory, deferredCityFilter, cityHints, cityRefOpts, deferredFilterReady]);

  const mapPolygons: VisitMapPolygon[] = useMemo(() => {
    const polys: VisitMapPolygon[] = [];
    const activeRegions = deferredRegionFilter.length > 0 ? deferredRegionFilter : regionFilter;

    if (activeRegions.length > 0 && adminRegions.length > 0) {
      polys.push(...buildAdminRegionMapPolygons(adminRegions, activeRegions));
    } else if (!filterReady && adminRegions.length > 0) {
      polys.push(...buildAdminRegionMapPolygons(adminRegions, []));
    }

    const activeBranch = deferredBranchFilter || branchFilter;
    if (activeBranch) {
      const saved = boundaries.find((b) => b.kind === "branch" && b.ref_id === activeBranch && b.polygon.length >= 3);
      if (saved) {
        const idx = boundaries.findIndex((b) => b.id === saved.id);
        const color = resolveBoundaryColor(saved, idx >= 0 ? idx : 0, boundaries);
        polys.push({
          id: saved.id,
          coords: saved.polygon.map((p) => [p.lat, p.lng] as [number, number]),
          color,
          active: true
        });
      }
    }

    return polys;
  }, [deferredRegionFilter, regionFilter, deferredBranchFilter, branchFilter, adminRegions, boundaries, filterReady]);

  const mapFocusCenter = useMemo(() => {
    const tokens = deferredRegionFilter.length > 0 ? deferredRegionFilter : regionFilter;
    if (tokens.length > 0) {
      return boundsCenterForAdminTokens(tokens, adminRegions);
    }
    const branchId = deferredBranchFilter || branchFilter;
    if (branchId) {
      const saved = boundaries.find(
        (b) => b.kind === "branch" && b.ref_id === branchId && b.polygon.length >= 3
      );
      if (saved) {
        const lat = saved.polygon.reduce((a, p) => a + p.lat, 0) / saved.polygon.length;
        const lng = saved.polygon.reduce((a, p) => a + p.lng, 0) / saved.polygon.length;
        return { lat, lng };
      }
    }
    return null;
  }, [deferredRegionFilter, regionFilter, deferredBranchFilter, branchFilter, adminRegions, boundaries]);

  const isFilterPending =
    regionFilter !== deferredRegionFilter ||
    branchFilter !== deferredBranchFilter ||
    cityFilter !== deferredCityFilter;

  return {
    regionFilter,
    setRegionFilter,
    branchFilter,
    setBranchFilter,
    cityFilter,
    setCityFilter,
    regionOptions,
    branchOptions,
    cityOptions,
    filteredClients,
    filterReady,
    mapPolygons,
    mapFocusCenter,
    catalogLoading: profileQ.isLoading || boundariesQ.isLoading,
    adminLoading,
    isFilterPending
  };
}
