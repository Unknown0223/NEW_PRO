"use client";

import { buildPaymentMethodOptions } from "@/components/dashboard/finance/payment-method-options";
import type { FinanceFilterDraft } from "@/components/dashboard/finance/types";
import { staffDashboardMultiItem } from "@/lib/order-picker-labels";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/lib/order-status";
import { useMemo } from "react";

type StaffPick = { id: number; fio: string; code?: string | null };
type ClientRefs = {
  zones?: string[];
  region_options?: Array<string | { value?: string; label?: string | null }>;
  city_options?: Array<string | { value?: string; label?: string | null }>;
  category_options?: Array<string | { label?: string; value?: string }>;
  categories?: string[];
};
type ProductSalesFilterOpts = {
  territory_2_by_1?: Record<string, string[]>;
  territory_3_by_2?: Record<string, string[]>;
  regions_by_zone?: Record<string, string[]>;
  cities_by_zone_region?: Record<string, string[]>;
  trade_directions?: Array<{ id: number; name: string; code: string }>;
  payment_methods?: Array<{ id: string; label: string }>;
};
type ProfileRefs = {
  payment_method_entries?: Array<{ id: string; name: string; active?: boolean; code?: string | null }>;
  payment_types?: string[];
};

function mapTerritoryOpts(
  items: Array<string | { value?: string; label?: string | null }>
): Array<{ value: string; label: string }> {
  return items.map((r) =>
    typeof r === "string" ? { value: r, label: r } : { value: String(r.value ?? ""), label: String(r.label ?? r.value ?? "") }
  );
}

export function useFinanceFilterOptions(args: {
  draft: FinanceFilterDraft;
  agents: StaffPick[];
  supervisors: StaffPick[];
  clientRefs: ClientRefs | undefined;
  profileRefs: ProfileRefs | undefined;
  reportFilters: ProductSalesFilterOpts | undefined;
  productCategories: Array<{ id: number; name: string }>;
}) {
  const { draft, agents, supervisors, clientRefs, profileRefs, reportFilters, productCategories } = args;

  return useMemo(() => {
    const paymentOptions = buildPaymentMethodOptions(profileRefs, reportFilters);
    const agentItems = agents.map((a) => staffDashboardMultiItem(a));
    const supervisorItems = supervisors.map((s) => staffDashboardMultiItem(s));

    const clientCategoryOptions = (() => {
      const fromOpts = (clientRefs?.category_options ?? [])
        .map((o) => (typeof o === "string" ? o : (o?.label ?? o?.value ?? "")))
        .map((x) => String(x).trim())
        .filter(Boolean);
      const fromList = (clientRefs?.categories ?? []).map((x) => String(x).trim()).filter(Boolean);
      return Array.from(new Set([...fromOpts, ...fromList])).sort((a, b) => a.localeCompare(b, "ru"));
    })();

    const productCategoryItems = productCategories.map((c) => ({
      id: String(c.id),
      title: c.name
    }));

    const tradeOptions = (reportFilters?.trade_directions ?? []).map((t) => ({
      value: String(t.code || t.name).trim(),
      label: t.name
    }));

    const zoneOptions = (clientRefs?.zones ?? []).map((z) => ({ value: z, label: z }));

    const regionOptions = (() => {
      const zones = draft.territory_1_list;
      const map = reportFilters?.territory_2_by_1 ?? reportFilters?.regions_by_zone;
      if (zones.length && map) {
        const set = new Set<string>();
        for (const z of zones) for (const r of map[z] ?? []) set.add(r);
        return Array.from(set).map((r) => ({ value: r, label: r }));
      }
      return mapTerritoryOpts(clientRefs?.region_options ?? []);
    })();

    const cityOptions = (() => {
      const regions = draft.territory_2_list;
      const map = reportFilters?.territory_3_by_2 ?? reportFilters?.cities_by_zone_region;
      if (regions.length && map) {
        const set = new Set<string>();
        for (const r of regions) for (const c of map[r] ?? []) set.add(c);
        return Array.from(set).map((c) => ({ value: c, label: c }));
      }
      return mapTerritoryOpts(clientRefs?.city_options ?? []);
    })();

    return {
      paymentOptions,
      agentItems,
      supervisorItems,
      clientCategoryOptions,
      productCategoryItems,
      tradeOptions,
      zoneOptions,
      regionOptions,
      cityOptions,
      statusItems: ORDER_STATUS_FILTER_OPTIONS.map((o) => ({ id: o.value, title: o.label }))
    };
  }, [draft.territory_1_list, draft.territory_2_list, agents, supervisors, clientRefs, profileRefs, reportFilters, productCategories]);
}
