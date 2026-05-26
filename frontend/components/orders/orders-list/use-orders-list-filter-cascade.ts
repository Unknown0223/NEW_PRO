"use client";

import type { RefSelectOption } from "@/lib/ref-select-options";
import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type { OrdersUrlFilters } from "./types";

function normTrim(v: string): string {
  return v.trim();
}

type CascadeOpts = {
  filterDraft: OrdersUrlFilters;
  setFilterDraft: Dispatch<SetStateAction<OrdersUrlFilters>>;
  buildTerritoryCascade: (current: {
    zone: string;
    region: string;
    city: string;
  }) => {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
  productIdsInCategory: Set<string>;
};

export function useOrdersListFilterCascade({
  filterDraft,
  setFilterDraft,
  buildTerritoryCascade,
  productIdsInCategory
}: CascadeOpts) {
  const territoryCascade = useMemo(
    () =>
      buildTerritoryCascade({
        zone: filterDraft.client_zone,
        region: filterDraft.client_region,
        city: filterDraft.client_city
      }),
    [
      buildTerritoryCascade,
      filterDraft.client_zone,
      filterDraft.client_region,
      filterDraft.client_city
    ]
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
    const z = normTrim(filterDraft.client_zone);
    if (!z || zoneKeys.size === 0) return;
    if (!zoneKeys.has(z)) {
      setFilterDraft((d) => ({ ...d, client_zone: "", client_region: "", client_city: "" }));
    }
  }, [zoneKeys, filterDraft.client_zone, setFilterDraft]);

  useEffect(() => {
    const r = normTrim(filterDraft.client_region);
    if (!r || regionKeys.size === 0) return;
    if (!regionKeys.has(r)) {
      setFilterDraft((d) => ({ ...d, client_region: "", client_city: "" }));
    }
  }, [regionKeys, filterDraft.client_region, setFilterDraft]);

  useEffect(() => {
    const c = normTrim(filterDraft.client_city);
    if (!c || cityKeys.size === 0) return;
    if (!cityKeys.has(c)) {
      setFilterDraft((d) => ({ ...d, client_city: "" }));
    }
  }, [cityKeys, filterDraft.client_city, setFilterDraft]);

  useEffect(() => {
    const pid = filterDraft.product_id.trim();
    if (!pid) return;
    if (!productIdsInCategory.has(pid)) {
      setFilterDraft((d) => ({ ...d, product_id: "" }));
    }
  }, [productIdsInCategory, filterDraft.product_id, setFilterDraft]);

  const patchTerritoryZone = (zone: string) => {
    setFilterDraft((d) => ({
      ...d,
      client_zone: zone,
      client_region: "",
      client_city: ""
    }));
  };

  const patchTerritoryRegion = (region: string) => {
    setFilterDraft((d) => ({
      ...d,
      client_region: region,
      client_city: ""
    }));
  };

  const patchProductCategory = (product_category_id: string) => {
    setFilterDraft((d) => ({
      ...d,
      product_category_id,
      product_id: ""
    }));
  };

  return { territoryCascade, patchTerritoryZone, patchTerritoryRegion, patchProductCategory };
}
