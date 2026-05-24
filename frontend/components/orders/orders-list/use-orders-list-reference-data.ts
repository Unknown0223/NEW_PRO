"use client";

import { api } from "@/lib/api";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import {
  paymentMethodSelectOptions,
  type ProfilePaymentMethodEntry
} from "@/lib/payment-method-options";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export function useOrdersListReferenceData(tenantSlug: string | null, effectiveRole: string | null | undefined) {
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
    queryKey: ["agents", tenantSlug, "orders-toolbar"],
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
    queryKey: ["expeditors", tenantSlug, "orders-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: { id: number; fio: string; code: string | null }[] }>(
        `/api/${tenantSlug}/expeditors`
      );
      return body.data ?? [];
    }
  });

  const productsFilterQ = useQuery({
    queryKey: ["products", tenantSlug, "orders-filter"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{
        data: { id: number; name: string; sku: string }[];
      }>(`/api/${tenantSlug}/products?page=1&limit=100&is_active=true`);
      return body.data ?? [];
    }
  });

  const productCategoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "orders-filter"],
    enabled: Boolean(tenantSlug) && canBulkCatalog,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{
        data: { id: number; name: string; is_active?: boolean }[];
      }>(`/api/${tenantSlug}/product-categories`);
      return (body.data ?? []).filter((c) => c.is_active !== false);
    }
  });

  const ordersProfileRefsQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "orders-filters"],
    enabled: Boolean(tenantSlug) && canBulkCatalog,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          payment_types?: string[];
          payment_method_entries?: ProfilePaymentMethodEntry[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
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
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const x of raw) {
      const t = String(x).trim().slice(0, 64);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ value: t, label: t });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [ordersProfileRefsQ.data?.payment_types]);

  return {
    canBulkCatalog,
    warehousesQ,
    agentsQ,
    expeditorsQ,
    productsFilterQ,
    productCategoriesQ,
    ordersProfileRefsQ,
    paymentMethodFilterOpts,
    paymentTypeFilterOpts
  };
}
