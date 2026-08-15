"use client";

import { formatStatusLabel } from "@/components/dashboard/sales/format";
import type { SalesFilterDraft } from "@/components/dashboard/sales/types";
import { buildPaymentMethodOptions } from "@/components/dashboard/finance/payment-method-options";
import { cityStoredCodeToDisplayLabel } from "@/lib/city-territory-hint";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { useMemo } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };
type ClientRefs = {
  zones?: string[];
  regions?: string[];
  cities?: string[];
  region_options?: Array<string | { value?: string; label?: string | null }>;
  city_options?: Array<string | { value?: string; label?: string | null }>;
};
type ProductSalesFilterOpts = {
  territory_1?: string[];
  territory_2?: string[];
  territory_3?: string[];
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  regions_by_zone?: Record<string, string[]>;
  trade_directions?: Array<{ id: number; name: string; code: string }>;
  payment_methods?: Array<{ id: string; label: string }>;
};
type ProfileRefs = {
  payment_method_entries?: Array<{ id: string; name: string; active?: boolean; code?: string | null }>;
  trade_directions?: string[];
};

function mapTerritoryOpts(
  items: Array<string | { value?: string; label?: string | null }>
): Array<{ value: string; label: string }> {
  return items.map((r) =>
    typeof r === "string" ? { value: r, label: r } : { value: String(r.value ?? ""), label: String(r.label ?? r.value ?? "") }
  );
}

function uniqSorted(values: string[]) {
  const s = new Set<string>();
  for (const v of values) {
    const t = String(v ?? "").trim();
    if (t) s.add(t);
  }
  return [...s].sort((a, b) => a.localeCompare(b, "ru"));
}

function territoryLabelLookup(
  options: Array<string | { value?: string; label?: string | null }> | undefined
): Map<string, string> {
  const m = new Map<string, string>();
  for (const o of options ?? []) {
    if (typeof o === "string") {
      const t = o.trim();
      if (t) m.set(t, t);
      continue;
    }
    const v = String(o.value ?? "").trim();
    const lab = String(o.label ?? o.value ?? "").trim();
    if (v) m.set(v, lab || v);
  }
  return m;
}

function withTerritoryLabels(
  values: string[],
  labelByValue: Map<string, string>,
  asCity: boolean
): Array<{ value: string; label: string }> {
  return values.map((value) => {
    const fromMap = labelByValue.get(value);
    const label = asCity
      ? cityStoredCodeToDisplayLabel(value, fromMap ?? value)
      : fromMap && fromMap !== value
        ? fromMap
        : cityStoredCodeToDisplayLabel(value, fromMap ?? value);
    return { value, label };
  });
}

export function useSalesFilterOptions(args: {
  draft: SalesFilterDraft;
  supervisors: StaffPick[];
  clientRefs: ClientRefs | undefined;
  profileRefs: ProfileRefs | undefined;
  reportFilters: ProductSalesFilterOpts | undefined;
  productCategories: Array<{ id: number; name: string }>;
  catalogManufacturers: Array<{ id: number; name: string }>;
  catalogGroups: Array<{ id: number; name: string }>;
  catalogBrands: Array<{ id: number; name: string }>;
}) {
  const {
    draft,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters,
    productCategories,
    catalogManufacturers,
    catalogGroups,
    catalogBrands
  } = args;

  return useMemo(() => {
    const paymentOptions = buildPaymentMethodOptions(profileRefs, reportFilters);
    const supervisorItems = supervisors.map((s) => staffDashboardMultiItem(s));

    const statusItems = (["new", "confirmed", "picking", "delivering", "delivered", "cancelled"] as const).map(
      (s) => ({ id: s, title: formatStatusLabel(s) })
    );

    const productCategoryItems = productCategories.map((c) => ({ id: String(c.id), title: c.name }));
    const manufacturerItems = catalogManufacturers.map((m) => ({ id: String(m.id), title: m.name }));
    const groupItems = catalogGroups.map((g) => ({ id: String(g.id), title: g.name }));
    const brandItems = catalogBrands.map((b) => ({ id: String(b.id), title: b.name }));

    const tradeOptions = (reportFilters?.trade_directions ?? []).map((t) => ({
      value: String(t.code || t.name).trim(),
      label: t.name
    }));

    const regionLabelByValue = territoryLabelLookup(clientRefs?.region_options);
    const cityLabelByValue = territoryLabelLookup(clientRefs?.city_options);

    const zoneOptions = (() => {
      const hasReport = (reportFilters?.territory_1?.length ?? 0) > 0;
      const base = hasReport ? (reportFilters?.territory_1 ?? []) : (clientRefs?.zones ?? []);
      return uniqSorted(base).map((z) => ({ value: z, label: z }));
    })();

    const regionOptions = (() => {
      const zones = draft.territory_1_list.map((z) => z.trim()).filter(Boolean);
      let rows: string[] = [];
      if (zones.length === 0) {
        const hasReport = (reportFilters?.territory_2?.length ?? 0) > 0;
        rows = hasReport ? (reportFilters?.territory_2 ?? []) : (clientRefs?.regions ?? []);
      } else {
        const set = new Set<string>();
        for (const z of zones) {
          for (const r of reportFilters?.regions_by_zone?.[z] ?? reportFilters?.territory_2_by_1?.[z] ?? []) {
            set.add(r);
          }
        }
        rows = [...set];
        if (rows.length === 0) rows = reportFilters?.territory_2 ?? clientRefs?.regions ?? [];
      }
      const labeled = withTerritoryLabels(uniqSorted(rows), regionLabelByValue, false);
      return labeled.length ? labeled : mapTerritoryOpts(clientRefs?.region_options ?? []);
    })();

    const cityOptions = (() => {
      const regions = draft.territory_2_list.map((r) => r.trim()).filter(Boolean);
      let rows: string[] = [];
      if (regions.length > 0) {
        const set = new Set<string>();
        for (const region of regions) {
          for (const c of reportFilters?.territory_3_by_2?.[region] ?? []) set.add(c);
        }
        rows = [...set];
        if (rows.length === 0) rows = reportFilters?.territory_3 ?? clientRefs?.cities ?? [];
      } else {
        const hasReport = (reportFilters?.territory_3?.length ?? 0) > 0;
        rows = hasReport ? (reportFilters?.territory_3 ?? []) : (clientRefs?.cities ?? []);
      }
      const labeled = withTerritoryLabels(uniqSorted(rows), cityLabelByValue, true);
      return labeled.length ? labeled : mapTerritoryOpts(clientRefs?.city_options ?? []).map((o) => ({
        value: o.value,
        label: cityStoredCodeToDisplayLabel(o.value, o.label)
      }));
    })();

    return {
      paymentOptions,
      supervisorItems,
      statusItems,
      productCategoryItems,
      manufacturerItems,
      groupItems,
      brandItems,
      tradeOptions,
      zoneOptions,
      regionOptions,
      cityOptions
    };
  }, [
    draft.territory_1_list,
    draft.territory_2_list,
    supervisors,
    clientRefs,
    profileRefs,
    reportFilters,
    productCategories,
    catalogManufacturers,
    catalogGroups,
    catalogBrands
  ]);
}
