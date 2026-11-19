"use client";

/**
 * PolkiReturnPolicy — queries + order-list derived (ADR-008 M1.3).
 */
import { api } from "@/lib/api";
import { defaultPolkiDateRangeFromFilter } from "@/lib/return-filter-dates";
import type { ReturnFilterMetaView } from "@/lib/return-filter-messages";
import { returnFilterProfileQueryKey } from "@/lib/return-filter-settings";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PolkiOrderPickRow } from "../types";
import { filterEligiblePolkiOrders } from "./polki-return-policy.logic";
import type { ClientReturnDataPolki, OrderReturnBalanceView } from "./polki-policy.types";

export type UsePolkiReturnPolicyDataArgs = {
  tenantSlug: string | null | undefined;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  isPolkiSheet: boolean;
  isExchangeFlow: boolean;
  clientId: string;
  clientIdNum: number;
  deepLinkClientId: number | null;
  setClientId: (v: string) => void;
};

export function usePolkiReturnPolicyData(args: UsePolkiReturnPolicyDataArgs) {
  const {
    tenantSlug,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    isExchangeFlow,
    clientId,
    clientIdNum,
    deepLinkClientId,
    setClientId
  } = args;

  const [polkiDateFrom, setPolkiDateFrom] = useState("");
  const [polkiDateTo, setPolkiDateTo] = useState("");
  const polkiRangeAnchorRef = useRef<HTMLElement | null>(null);
  const [polkiRangeOpen, setPolkiRangeOpen] = useState(false);
  const [polkiOrderIds, setPolkiOrderIds] = useState<number[]>([]);
  const [polkiHeaderDate, setPolkiHeaderDate] = useState("");
  const polkiDeepLinkAppliedRef = useRef(false);
  const polkiAutoCategoriesOrderRef = useRef<number | null>(null);

  const polkiOrderIdsSortedKey = useMemo(
    () => [...polkiOrderIds].sort((a, b) => a - b).join(","),
    [polkiOrderIds]
  );
  const polkiOrderIdSet = useMemo(() => new Set(polkiOrderIds), [polkiOrderIds]);

  const returnFilterSettingsQ = useQuery({
    queryKey: returnFilterProfileQueryKey(tenantSlug),
    enabled: Boolean(tenantSlug && isPolkiSheet),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        return_filter: {
          period_enabled: boolean;
          period_unit: "day" | "month";
          period_value: number;
          balance_zero_enabled: boolean;
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.return_filter;
    }
  });

  const polkiDefaultDatesAppliedRef = useRef(false);
  useEffect(() => {
    if (!isPolkiFree || !returnFilterSettingsQ.data) return;
    if (polkiDefaultDatesAppliedRef.current) return;
    const range = defaultPolkiDateRangeFromFilter(returnFilterSettingsQ.data);
    if (range) {
      setPolkiDateFrom(range.dateFrom);
      setPolkiDateTo(range.dateTo);
    }
    polkiDefaultDatesAppliedRef.current = true;
  }, [isPolkiFree, returnFilterSettingsQ.data]);

  const polkiOrdersPickQ = useQuery({
    queryKey: ["order-create-polki-orders", tenantSlug, clientIdNum],
    enabled: Boolean(
      tenantSlug &&
        (isPolkiByOrder || isExchangeFlow) &&
        Number.isFinite(clientIdNum) &&
        clientIdNum > 0
    ),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: PolkiOrderPickRow[] }>(
        `/api/${tenantSlug}/orders?page=1&limit=100&client_id=${clientIdNum}`
      );
      return body.data ?? [];
    }
  });

  const polkiOrderBalancesQ = useQuery({
    queryKey: ["order-create-polki-order-balances", tenantSlug, clientIdNum],
    enabled: Boolean(
      tenantSlug && isPolkiByOrder && Number.isFinite(clientIdNum) && clientIdNum > 0
    ),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data: body } = await api.get<{
        balances: OrderReturnBalanceView[];
        filter_meta?: ReturnFilterMetaView;
        data?: OrderReturnBalanceView[];
      }>(`/api/${tenantSlug}/returns/order-balances?client_id=${clientIdNum}`);
      return {
        balances: body.balances ?? body.data ?? [],
        filter_meta: body.filter_meta ?? null
      };
    }
  });

  const polkiOrderFilterMeta = polkiOrderBalancesQ.data?.filter_meta ?? null;

  const polkiOrdersForPick = useMemo(() => {
    const eligibleIds = new Set((polkiOrderBalancesQ.data?.balances ?? []).map((b) => b.order_id));
    return filterEligiblePolkiOrders(
      polkiOrdersPickQ.data ?? [],
      eligibleIds,
      polkiOrderBalancesQ.isSuccess
    );
  }, [polkiOrdersPickQ.data, polkiOrderBalancesQ.data, polkiOrderBalancesQ.isSuccess]);

  const polkiOrdersPickRawCount =
    polkiOrderFilterMeta?.delivered_in_period ??
    polkiOrderFilterMeta?.delivered_after_filter ??
    polkiOrdersPickQ.data?.length ??
    0;

  const polkiOrderPickHalfLists = useMemo((): [PolkiOrderPickRow[], PolkiOrderPickRow[]] => {
    const list = polkiOrdersForPick;
    const mid = Math.ceil(list.length / 2);
    return [list.slice(0, mid), list.slice(mid)];
  }, [polkiOrdersForPick]);

  useEffect(() => {
    if (!isPolkiByOrder) return;
    const valid = new Set(polkiOrdersForPick.map((o) => o.id));
    setPolkiOrderIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [isPolkiByOrder, polkiOrdersForPick]);

  const polkiOrderFieldsFromOrder = isPolkiByOrder && polkiOrderIds.length > 0;

  useEffect(() => {
    if (!isPolkiByOrder || deepLinkClientId == null) return;
    if (!clientId.trim()) setClientId(String(deepLinkClientId));
  }, [isPolkiByOrder, deepLinkClientId, clientId, setClientId]);

  useEffect(() => {
    if (!isPolkiSheet) return;
    if (isPolkiFree) {
      const d = polkiDateTo || polkiDateFrom;
      if (d) setPolkiHeaderDate(d);
      else setPolkiHeaderDate(new Date().toISOString().slice(0, 10));
      return;
    }
    if (isPolkiByOrder && polkiOrderIds.length > 0) {
      let best = "";
      for (const id of polkiOrderIds) {
        const o = polkiOrdersForPick.find((x) => x.id === id);
        const ca = o?.created_at ? String(o.created_at).slice(0, 10) : "";
        if (ca && (!best || ca > best)) best = ca;
      }
      if (best) {
        setPolkiHeaderDate(best);
        return;
      }
    }
    setPolkiHeaderDate((prev) => prev || new Date().toISOString().slice(0, 10));
  }, [
    isPolkiSheet,
    isPolkiFree,
    isPolkiByOrder,
    polkiDateFrom,
    polkiDateTo,
    polkiOrderIds,
    polkiOrdersForPick
  ]);

  const polkiContextQ = useQuery({
    queryKey: [
      "order-create-polki-context",
      tenantSlug,
      clientIdNum,
      polkiDateFrom,
      polkiDateTo,
      polkiOrderIdsSortedKey,
      isPolkiFree,
      isPolkiByOrder
    ],
    enabled: Boolean(
      tenantSlug &&
        isPolkiSheet &&
        Number.isFinite(clientIdNum) &&
        clientIdNum > 0 &&
        (isPolkiFree || (isPolkiByOrder && polkiOrderIds.length > 0))
    ),
    staleTime: STALE.detail,
    queryFn: async () => {
      const params = new URLSearchParams({ client_id: String(clientIdNum) });
      if (isPolkiFree) {
        if (polkiDateFrom) params.set("date_from", polkiDateFrom);
        if (polkiDateTo) params.set("date_to", polkiDateTo);
      } else if (polkiOrderIds.length >= 1) {
        params.set("order_id", String(polkiOrderIds[0]));
      }
      const { data } = await api.get<ClientReturnDataPolki>(
        `/api/${tenantSlug}/returns/client-data?${params.toString()}`
      );
      return data;
    }
  });

  const polkiOrderBalanceById = useMemo(() => {
    const m = new Map<number, OrderReturnBalanceView>();
    for (const b of polkiOrderBalancesQ.data?.balances ?? []) m.set(b.order_id, b);
    for (const b of polkiContextQ.data?.order_balances ?? []) m.set(b.order_id, b);
    if (polkiContextQ.data?.order_balance) {
      m.set(polkiContextQ.data.order_balance.order_id, polkiContextQ.data.order_balance);
    }
    return m;
  }, [polkiOrderBalancesQ.data, polkiContextQ.data?.order_balance, polkiContextQ.data?.order_balances]);

  const polkiSelectedOrderBalance = useMemo((): OrderReturnBalanceView | null => {
    if (!isPolkiByOrder || polkiOrderIds.length !== 1) return null;
    return polkiOrderBalanceById.get(polkiOrderIds[0]!) ?? polkiContextQ.data?.order_balance ?? null;
  }, [isPolkiByOrder, polkiOrderIds, polkiOrderBalanceById, polkiContextQ.data?.order_balance]);

  const polkiOrderDateById = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of polkiContextQ.data?.orders ?? []) {
      const d = o.created_at ? String(o.created_at).slice(0, 10) : "";
      m.set(o.id, d);
    }
    for (const o of polkiOrdersForPick) {
      if (m.has(o.id)) continue;
      const d = o.created_at ? String(o.created_at).slice(0, 10) : "";
      if (d) m.set(o.id, d);
    }
    return m;
  }, [polkiContextQ.data?.orders, polkiOrdersForPick]);

  const resetOrderSelection = useCallback(() => {
    setPolkiOrderIds([]);
    polkiAutoCategoriesOrderRef.current = null;
  }, []);

  const setDates = useCallback((from: string, to: string) => {
    setPolkiDateFrom(from);
    setPolkiDateTo(to);
  }, []);

  return {
    polkiDateFrom,
    setPolkiDateFrom,
    polkiDateTo,
    setPolkiDateTo,
    setDates,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    setPolkiRangeOpen,
    polkiOrderIds,
    setPolkiOrderIds,
    polkiOrderIdsSortedKey,
    polkiOrderIdSet,
    polkiHeaderDate,
    setPolkiHeaderDate,
    polkiOrdersPickQ,
    polkiOrderBalancesQ,
    polkiOrderFilterMeta,
    polkiOrdersForPick,
    polkiOrdersPickRawCount,
    polkiOrderPickHalfLists,
    polkiOrderFieldsFromOrder,
    polkiContextQ,
    polkiOrderBalanceById,
    polkiSelectedOrderBalance,
    polkiOrderDateById,
    resetOrderSelection,
    polkiDeepLinkAppliedRef,
    polkiAutoCategoriesOrderRef,
    returnFilterSettingsQ
  };
}
