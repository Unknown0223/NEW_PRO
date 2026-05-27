"use client";

import type { RefusalFiltersState } from "@/lib/refusals-types";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";

function normTrim(v: string): string {
  return v.trim();
}

type CascadeOpts = {
  filters: RefusalFiltersState;
  setFilters: Dispatch<SetStateAction<RefusalFiltersState>>;
  buildTerritoryCascade: (current: { zone: string; region: string; city: string }) => {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
};

export function useRefusalsFilterCascade({
  filters,
  setFilters,
  buildTerritoryCascade
}: CascadeOpts) {
  const territoryCascade = useMemo(
    () =>
      buildTerritoryCascade({
        zone: filters.zone,
        region: filters.region,
        city: filters.city
      }),
    [buildTerritoryCascade, filters.zone, filters.region, filters.city]
  );

  const zoneKeys = useMemo(
    () => new Set(territoryCascade.zones.map((o) => normTrim(o.value))),
    [territoryCascade.zones]
  );
  const regionKeys = useMemo(
    () => new Set(territoryCascade.regions.map((o) => normTrim(o.value))),
    [territoryCascade.regions]
  );
  const cityKeys = useMemo(
    () => new Set(territoryCascade.cities.map((o) => normTrim(o.value))),
    [territoryCascade.cities]
  );

  useEffect(() => {
    const z = normTrim(filters.zone);
    if (!z || zoneKeys.size === 0) return;
    if (!zoneKeys.has(z)) {
      setFilters((d) => ({ ...d, zone: "", region: "", city: "" }));
    }
  }, [zoneKeys, filters.zone, setFilters]);

  useEffect(() => {
    const r = normTrim(filters.region);
    if (!r || regionKeys.size === 0) return;
    if (!regionKeys.has(r)) {
      setFilters((d) => ({ ...d, region: "", city: "" }));
    }
  }, [regionKeys, filters.region, setFilters]);

  useEffect(() => {
    const c = normTrim(filters.city);
    if (!c || cityKeys.size === 0) return;
    if (!cityKeys.has(c)) {
      setFilters((d) => ({ ...d, city: "" }));
    }
  }, [cityKeys, filters.city, setFilters]);

  const patchTerritoryZone = (zone: string) => {
    setFilters((d) => ({ ...d, zone, region: "", city: "" }));
  };

  const patchTerritoryRegion = (region: string) => {
    setFilters((d) => ({ ...d, region, city: "" }));
  };

  return { territoryCascade, patchTerritoryZone, patchTerritoryRegion };
}
