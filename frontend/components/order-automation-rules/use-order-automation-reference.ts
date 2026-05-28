"use client";

import { api } from "@/lib/api";
import {
  buildZoneRegionCityCascadeOptions,
  type ClientRefsTerritoryBundle
} from "@/lib/territory-client-filters";
import { decodeAccessTokenTenantSlug, useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export type OrderAutomationFormOptionsDto = {
  agents: { id: number; label: string }[];
  warehouses: { id: number; label: string }[];
  territories: { value: string; label: string }[];
  payment_methods: { value: string; label: string }[];
  trade_directions: { value: string; label: string }[];
  request_types: { value: string; label: string }[];
  currencies: { value: string; label: string }[];
  default_currency_code: string;
};

export type OrderAutomationFilterRefs = {
  agents: { id: number; fio: string }[];
  warehouses: { id: number; name: string }[];
  paymentMethodFilterOpts: { value: string; label: string }[];
  tradeDirectionFilterOpts: { value: string; label: string }[];
  requestTypeFilterOpts: { value: string; label: string }[];
  territoryMultiselectOpts: { value: string; label: string }[];
  currencyFilterOpts: { value: string; label: string }[];
  defaultCurrencyCode: string;
  refLabelByCode: Map<string, string>;
  buildTerritoryCascade: (current: {
    zone: string;
    region: string;
    city: string;
  }) => ReturnType<typeof buildZoneRegionCityCascadeOptions>;
};

function useEffectiveTenantSlug(): string | null {
  const stored = useAuthStore((s) => s.tenantSlug);
  const token = useAuthStore((s) => s.accessToken);
  const hydrated = useAuthStoreHydrated();
  return useMemo(() => {
    if (!hydrated) return null;
    const fromJwt = decodeAccessTokenTenantSlug(token);
    return fromJwt ?? (stored?.trim() || null);
  }, [hydrated, token, stored]);
}

export function useOrderAutomationReference() {
  const tenantSlug = useEffectiveTenantSlug();
  const hydrated = useAuthStoreHydrated();

  const formOptionsQ = useQuery({
    queryKey: ["order-automation", "form-options", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: OrderAutomationFormOptionsDto }>(
        `/api/${tenantSlug}/order-automation/form-options`
      );
      return body.data;
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "order-automation-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefsTerritoryBundle>(
        `/api/${tenantSlug}/clients/references`
      );
      return data;
    }
  });

  const opts = formOptionsQ.data;

  const refLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of opts?.currencies ?? []) map.set(o.value, o.label);
    for (const o of opts?.payment_methods ?? []) map.set(o.value, o.label);
    return map;
  }, [opts?.currencies, opts?.payment_methods]);

  const buildTerritoryCascade = useCallback(
    (current: { zone: string; region: string; city: string }) =>
      buildZoneRegionCityCascadeOptions(clientRefsQ.data, undefined, undefined, current),
    [clientRefsQ.data]
  );

  const filterRefs: OrderAutomationFilterRefs = useMemo(
    () => ({
      agents: (opts?.agents ?? []).map((a) => ({ id: a.id, fio: a.label })),
      warehouses: (opts?.warehouses ?? []).map((w) => ({ id: w.id, name: w.label })),
      paymentMethodFilterOpts: opts?.payment_methods ?? [],
      tradeDirectionFilterOpts: opts?.trade_directions ?? [],
      requestTypeFilterOpts: opts?.request_types ?? [],
      territoryMultiselectOpts: opts?.territories ?? [],
      currencyFilterOpts: opts?.currencies ?? [],
      defaultCurrencyCode: opts?.default_currency_code ?? "UZS",
      refLabelByCode,
      buildTerritoryCascade
    }),
    [opts, refLabelByCode, buildTerritoryCascade]
  );

  return {
    tenantSlug,
    hydrated,
    formOptionsQ,
    clientRefsQ,
    filterRefs,
    refLabelByCode,
    defaultCurrencyCode: opts?.default_currency_code ?? "UZS",
    refsLoading: formOptionsQ.isLoading || formOptionsQ.isFetching,
    refsError: formOptionsQ.isError
  };
}
