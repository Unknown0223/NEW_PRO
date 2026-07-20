"use client";

import { api } from "@/lib/api";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import {
  paymentMethodSelectOptions,
  type ProfilePaymentMethodEntry
} from "@/lib/payment-method-options";
import {
  salePriceTypeOptionsFromProfile,
  type PolkiPriceTypeEntryRef
} from "@/components/orders/order-create/view/polki-shelf-return/polki-price-type-options";
import { STALE } from "@/lib/query-stale";
import {
  buildZoneRegionCityCascadeOptions,
  type ClientRefsTerritoryBundle
} from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { activeRefSelectOptions } from "@/lib/profile-ref-entries";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { OrdersUrlFilters } from "./types";

export function useOrdersListReferenceData(
  tenantSlug: string | null,
  effectiveRole: string | null | undefined,
  filterDraft: OrdersUrlFilters,
  actorUserId: number | null = null
) {
  const canBulkCatalog = isAdminOrOperatorLikeRole(effectiveRole);

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "orders-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/warehouses`
      );
      return body.data ?? [];
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, actorUserId, "orders-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: { id: number; fio: string; code: string | null }[] }>(
        `/api/${tenantSlug}/agents`
      );
      return body.data ?? [];
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, actorUserId, "orders-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: { id: number; fio: string; code: string | null }[] }>(
        `/api/${tenantSlug}/expeditors`
      );
      return body.data ?? [];
    }
  });

  const productCategoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "orders-filter"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{
        data: { id: number; name: string; is_active?: boolean }[];
      }>(`/api/${tenantSlug}/product-categories`);
      return (body.data ?? []).filter((c) => c.is_active !== false);
    }
  });

  const productsFilterQ = useQuery({
    queryKey: [
      "products",
      tenantSlug,
      "orders-filter",
      filterDraft.product_category_id
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const sp = new URLSearchParams({ page: "1", limit: "100", is_active: "true" });
      if (filterDraft.product_category_id.trim()) {
        sp.set("category_id", filterDraft.product_category_id.trim());
      }
      const { data: body } = await api.get<{
        data: { id: number; name: string; sku: string }[];
      }>(`/api/${tenantSlug}/products?${sp.toString()}`);
      return body.data ?? [];
    }
  });

  const ordersProfileRefsQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "orders-filters"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
          client_categories?: string[];
          trade_directions?: string[];
          price_type_entries?: PolkiPriceTypeEntryRef[];
          territory_nodes?: TerritoryNode[];
          request_type_entries?: unknown;
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "orders-filters"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefsTerritoryBundle>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const clientsFilterQ = useQuery({
    queryKey: ["clients", tenantSlug, "orders-filter"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { id: number; name: string; client_code: string | null }[];
      }>(`/api/${tenantSlug}/clients?limit=200&is_active=yes&sort=name&order=asc`);
      return data.data ?? [];
    }
  });

  const paymentMethodFilterOpts = useMemo(
    () =>
      paymentMethodSelectOptions(
        ordersProfileRefsQ.data,
        ordersProfileRefsQ.data?.payment_types ?? null
      ),
    [ordersProfileRefsQ.data]
  );

  const paymentTypeFilterOpts = useMemo(() => {
    const raw = ordersProfileRefsQ.data?.payment_types;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    // Saqlash kaliti (kod) → spravochnikdagi nom; topilmasa kalit o‘zi
    const entries = ordersProfileRefsQ.data?.payment_method_entries ?? [];
    const labelByKey = new Map<string, string>();
    for (const e of entries) {
      const name = e?.name?.trim();
      if (!name) continue;
      const key = (e.code?.trim() || name).slice(0, 64);
      if (!labelByKey.has(key)) labelByKey.set(key, name);
    }
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const x of raw) {
      const t = String(x).trim().slice(0, 64);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ value: t, label: labelByKey.get(t) ?? t });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [ordersProfileRefsQ.data?.payment_types, ordersProfileRefsQ.data?.payment_method_entries]);

  const clientCategoryFilterOpts = useMemo(() => {
    const raw = ordersProfileRefsQ.data?.client_categories;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const x of raw) {
      const t = String(x).trim().slice(0, 128);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ value: t, label: t });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [ordersProfileRefsQ.data?.client_categories]);

  const tradeDirectionFilterOpts = useMemo(() => {
    const raw = ordersProfileRefsQ.data?.trade_directions ?? [];
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const x of raw) {
      const t = String(x).trim().slice(0, 128);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ value: t, label: t });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [ordersProfileRefsQ.data?.trade_directions]);

  const nakladnoyTypeFilterOpts = useMemo(
    () => activeRefSelectOptions(ordersProfileRefsQ.data?.request_type_entries),
    [ordersProfileRefsQ.data?.request_type_entries]
  );

  const priceTypeFilterOpts = useMemo(() => {
    const sale = salePriceTypeOptionsFromProfile(
      ordersProfileRefsQ.data?.price_type_entries,
      ordersProfileRefsQ.data?.payment_types ?? []
    );
    return sale.map((o) => ({ value: o.key, label: o.label }));
  }, [ordersProfileRefsQ.data?.price_type_entries, ordersProfileRefsQ.data?.payment_types]);

  const territoryNodes = ordersProfileRefsQ.data?.territory_nodes;

  const buildTerritoryCascade = useCallback(
    (current: { zone: string; region: string; city: string }) =>
      buildZoneRegionCityCascadeOptions(clientRefsQ.data, undefined, territoryNodes, current),
    [clientRefsQ.data, territoryNodes]
  );

  return {
    canBulkCatalog,
    warehousesQ,
    agentsQ,
    expeditorsQ,
    productsFilterQ,
    productCategoriesQ,
    ordersProfileRefsQ,
    clientRefsQ,
    clientsFilterQ,
    paymentMethodFilterOpts,
    paymentTypeFilterOpts,
    nakladnoyTypeFilterOpts,
    priceTypeFilterOpts,
    clientCategoryFilterOpts,
    tradeDirectionFilterOpts,
    buildTerritoryCascade
  };
}
