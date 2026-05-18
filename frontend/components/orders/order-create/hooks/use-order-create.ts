"use client";

import { api } from "@/lib/api";
import { ORDER_TYPE_VALUES } from "@/lib/order-types";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, isApiUnreachable, withApiSupportLine } from "@/lib/error-utils";
import type { ClientRow } from "@/lib/client-types";
import type { ProductRow } from "@/lib/product-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AxiosError } from "axios";
import { STALE } from "@/lib/query-stale";
import {
  orderAgentFilterOption,
  orderClientPickerDisplayName,
  orderExpeditorFilterOption
} from "@/lib/order-picker-labels";
import {
  activeRefSelectOptions,
  refEntryLabelByStored
} from "@/lib/profile-ref-entries";
import {
  buildExchangeCreateBody,
  buildExchangePairRows
} from "@/components/orders/exchange-order-create-panel";
import type {
  OrderCreateProps,
  PolkiOrderPickRow,
  PolkiPairRowModel,
  PolkiClientItem,
  PolkiOrderGroup
} from "../types";
import { MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from "../constants";
import {
  parsePriceAmount,
  parseStockQty,
  availableOrderQty,
  formatQtyState,
  orderStatusLabelRu,
  currentMonthEndIsoDate,
  unitPriceForType,
  buildPolkiPairRows,
  polkiSplitTotal,
  isPolkiShelfSourceOrder,
  isPolkiReturnByOrderPickable,
  polkiOrderRowHasBonus
} from "../utils";

export function useOrderCreate({ tenantSlug, onCreated, onCancel, orderType }: OrderCreateProps) {
  const qc = useQueryClient();
  const normalizedType = (orderType ?? "order").trim();
  const isExchangeFlow = normalizedType === "exchange";
  const isPolkiFree = normalizedType === "return";
  const isPolkiByOrder = normalizedType === "return_by_order";
  const isPolkiSheet = isPolkiFree || isPolkiByOrder;
  /** Oddiy zakaz: katalog va kategoriyalar faqat agent tanlangandan keyin (API `selected_agent_id`). */
  const requiresAgentForProductCatalog = !isPolkiSheet && !isExchangeFlow;

  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [applyBonus, setApplyBonus] = useState(true);
  /** Bo‘sh = barcha kategoriyalar; bo‘sh emas = faqat tanlangan id lar */
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  /** Pastdagi katalog tablari: faqat `selectedCategoryIds` bo‘sh emas; jadval faqat shu kategoriya mahsulotlari */
  const [activeCatalogCategoryId, setActiveCatalogCategoryId] = useState<number | null>(null);
  const [qtyByProductId, setQtyByProductId] = useState<Record<number, string>>({});
  /** Mahsulot qadoqlari (bloklar); kartotekada qty_per_block bo‘lsa Miqdor = blok × dona/blok */
  const [blockByProductId, setBlockByProductId] = useState<Record<number, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [expeditorUserId, setExpeditorUserId] = useState("");
  const [priceType, setPriceType] = useState("retail");
  const [orderComment, setOrderComment] = useState("");
  const [requestTypeRef, setRequestTypeRef] = useState("");
  const [orderNotePreset, setOrderNotePreset] = useState("");
  const [refSelectKey, setRefSelectKey] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [orderOpenedAt] = useState(() => new Date());
  const [polkiDateFrom, setPolkiDateFrom] = useState("");
  const [polkiDateTo, setPolkiDateTo] = useState("");
  const polkiRangeAnchorRef = useRef<HTMLElement | null>(null);
  const [polkiRangeOpen, setPolkiRangeOpen] = useState(false);
  const [polkiOrderIds, setPolkiOrderIds] = useState<number[]>([]);
  const [polkiTotalQty, setPolkiTotalQty] = useState<Record<string, string>>({});
  const [polkiBonusToBalance, setPolkiBonusToBalance] = useState<Record<string, boolean>>({});
  const [polkiBonusCash, setPolkiBonusCash] = useState<Record<string, string>>({});
  const [refusalReasonRefPolki, setRefusalReasonRefPolki] = useState("");
  const [polkiHeaderDate, setPolkiHeaderDate] = useState("");
  const [polkiTradeDirection, setPolkiTradeDirection] = useState("");
  const [polkiSkidkaType, setPolkiSkidkaType] = useState("none");
  const [orderIsConsignment, setOrderIsConsignment] = useState(false);
  const [consignmentDueDate, setConsignmentDueDate] = useState("");
  const [consignmentDueOpen, setConsignmentDueOpen] = useState(false);
  const consignmentDueAnchorRef = useRef<HTMLButtonElement>(null);
  /** Savdo zakazi uchun profil `payment_method_entries[].id` (backend `payment_method_ref`) */
  const [paymentMethodRef, setPaymentMethodRef] = useState("");
  const [exchangeSourceOrderIds, setExchangeSourceOrderIds] = useState<number[]>([]);
  const [exMinusKey, setExMinusKey] = useState("");
  const [exMinusQty, setExMinusQty] = useState("");
  const [exPlusProductId, setExPlusProductId] = useState("");
  const [exPlusQty, setExPlusQty] = useState("");
  const resetFlowAfterClientChange = useCallback(() => {
    setWarehouseId("");
    setAgentId("");
    setExpeditorUserId("");
    setPaymentMethodRef("");
    setQtyByProductId({});
    setBlockByProductId({});
    setSelectionNotice(null);
    setSelectedCategoryIds([]);
    setActiveCatalogCategoryId(null);
  }, []);
  const selectedClientIdNum = clientId.trim() ? Number.parseInt(clientId.trim(), 10) : NaN;
  const selectedAgentIdNum = agentId.trim() ? Number.parseInt(agentId.trim(), 10) : NaN;
  const hasAgentSelected = Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0;
  const agentCatalogReady = !requiresAgentForProductCatalog || hasAgentSelected;
  const selectedWarehouseIdNum = warehouseId.trim() ? Number.parseInt(warehouseId.trim(), 10) : NaN;
  const selectedExpeditorIdNum = expeditorUserId.trim() ? Number.parseInt(expeditorUserId.trim(), 10) : NaN;
  const ORDER_CREATE_DEBUG =
    process.env.NEXT_PUBLIC_ORDER_CREATE_DEBUG === "1" ||
    (typeof window !== "undefined" &&
      window.localStorage.getItem("salesdoc.orderCreateDebug") === "1");
  const debugOrderCreate = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      if (!ORDER_CREATE_DEBUG) return;
      // eslint-disable-next-line no-console
      console.info(`[order-create-debug] ${event}`, payload ?? {});
    },
    [ORDER_CREATE_DEBUG]
  );

  const polkiOrderIdsSortedKey = useMemo(
    () => [...polkiOrderIds].sort((a, b) => a - b).join(","),
    [polkiOrderIds]
  );
  const polkiOrderIdSet = useMemo(() => new Set(polkiOrderIds), [polkiOrderIds]);

  useEffect(() => {
    setQtyByProductId({});
    setBlockByProductId({});
  }, [warehouseId]);

  useEffect(() => {
    if (!isPolkiSheet) return;
    setQtyByProductId({});
    setBlockByProductId({});
    setPolkiTotalQty({});
    setPolkiBonusToBalance({});
    setPolkiBonusCash({});
  }, [isPolkiSheet, polkiDateFrom, polkiDateTo, clientId]);

  useEffect(() => {
    if (!orderIsConsignment) {
      setConsignmentDueOpen(false);
      return;
    }
    if (!consignmentDueDate.trim()) {
      setConsignmentDueDate(currentMonthEndIsoDate());
    }
  }, [orderIsConsignment, consignmentDueDate]);

  type OrderCreateContextResponse = {
    clients: ClientRow[];
    products: ProductRow[];
    warehouses: { id: number; name: string; stock_purpose?: string; is_active?: boolean }[];
    users: { id: number; login: string; name: string; role: string }[];
    price_types: string[];
    expeditors: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
    settings_profile: {
      references?: {
        request_type_entries?: unknown;
        order_note_entries?: unknown;
        refusal_reason_entries?: unknown;
        /** Legacy ro‘yxat (kodlar) — payment_method_entries bo‘lmasa fallback. */
        payment_types?: string[];
        payment_method_entries?: { id: string; name: string; active?: boolean }[];
      };
    };
    product_categories: { id: number; name: string }[];
  };

  const createCtxQ = useQuery({
    queryKey: [
      "orders",
      "create-context",
      tenantSlug,
      Number.isFinite(selectedClientIdNum) && selectedClientIdNum > 0 ? selectedClientIdNum : null,
      Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0 ? selectedAgentIdNum : null,
      Number.isFinite(selectedWarehouseIdNum) && selectedWarehouseIdNum > 0 ? selectedWarehouseIdNum : null,
      Number.isFinite(selectedExpeditorIdNum) && selectedExpeditorIdNum > 0 ? selectedExpeditorIdNum : null
    ],
    enabled: Boolean(tenantSlug),
    placeholderData: (previous) => previous,
    staleTime: 20_000,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (Number.isFinite(selectedClientIdNum) && selectedClientIdNum > 0) {
        params.set("selected_client_id", String(selectedClientIdNum));
      }
      if (Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0) {
        params.set("selected_agent_id", String(selectedAgentIdNum));
      }
      if (Number.isFinite(selectedWarehouseIdNum) && selectedWarehouseIdNum > 0) {
        params.set("selected_warehouse_id", String(selectedWarehouseIdNum));
      }
      if (Number.isFinite(selectedExpeditorIdNum) && selectedExpeditorIdNum > 0) {
        params.set("selected_expeditor_user_id", String(selectedExpeditorIdNum));
      }
      const qs = params.toString();
      debugOrderCreate("create-context.request", {
        selected_client_id:
          Number.isFinite(selectedClientIdNum) && selectedClientIdNum > 0 ? selectedClientIdNum : null,
        selected_agent_id: Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0 ? selectedAgentIdNum : null,
        selected_warehouse_id:
          Number.isFinite(selectedWarehouseIdNum) && selectedWarehouseIdNum > 0 ? selectedWarehouseIdNum : null,
        selected_expeditor_user_id:
          Number.isFinite(selectedExpeditorIdNum) && selectedExpeditorIdNum > 0 ? selectedExpeditorIdNum : null,
        query: qs || "(empty)"
      });
      const { data } = await api.get<OrderCreateContextResponse>(
        `/api/${tenantSlug}/orders/create-context${qs ? `?${qs}` : ""}`
      );
      debugOrderCreate("create-context.response", {
        clients: data.clients?.length ?? 0,
        warehouses: data.warehouses?.length ?? 0,
        users: data.users?.length ?? 0,
        expeditors: data.expeditors?.length ?? 0,
        products: data.products?.length ?? 0
      });
      return data;
    }
  });

  /** Agent tanlanganda katalog `create-context` javobida ham bor — alohida `create-catalog` chaqirilmasin (2× DB + 2× tarmoq). */
  const useSplitOrderCatalog = requiresAgentForProductCatalog && hasAgentSelected;

  const stockProductIdsKey = useMemo(() => {
    const src = agentCatalogReady ? (createCtxQ.data?.products ?? []) : [];
    const ids = src.map((p) => p.id).filter((n) => Number.isFinite(n) && n > 0);
    ids.sort((a, b) => a - b);
    return ids.join(",");
  }, [agentCatalogReady, createCtxQ.data?.products]);

  const stockQ = useQuery({
    queryKey: ["stock", tenantSlug, warehouseId, "order-form", stockProductIdsKey],
    enabled: Boolean(tenantSlug) && Boolean(warehouseId) && Boolean(stockProductIdsKey),
    staleTime: STALE.detail,
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("warehouse_id", warehouseId);
      qs.set("product_ids", stockProductIdsKey);
      const { data } = await api.get<{ data: { product_id: number; qty: string; reserved_qty: string }[] }>(
        `/api/${tenantSlug}/stock?${qs.toString()}`
      );
      return data.data;
    }
  });

  const clientIdNum = selectedClientIdNum;

  type ClientReturnDataPolki = {
    polki_scope?: "period" | "order";
    orders?: Array<{
      id: number;
      number: string;
      created_at: string;
    }>;
    items: Array<{
      product_id: number;
      sku: string;
      name: string;
      unit: string;
      qty: string;
      price: string;
      is_bonus: boolean;
      order_id?: number;
      order_number?: string;
    }>;
    max_returnable_value: string;
  };

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

  const polkiOrdersForPick = useMemo(
    () => (polkiOrdersPickQ.data ?? []).filter(isPolkiReturnByOrderPickable),
    [polkiOrdersPickQ.data]
  );

  const exchangeOrderIdsSortedKey = useMemo(
    () => [...exchangeSourceOrderIds].sort((a, b) => a - b).join(","),
    [exchangeSourceOrderIds]
  );

  const exchangeReturnsQ = useQuery({
    queryKey: ["exchange-returns", tenantSlug, clientIdNum, exchangeOrderIdsSortedKey],
    enabled: Boolean(
      tenantSlug &&
        isExchangeFlow &&
        Number.isFinite(clientIdNum) &&
        clientIdNum > 0 &&
        exchangeSourceOrderIds.length > 0
    ),
    staleTime: STALE.detail,
    queryFn: async () => {
      const ids = exchangeSourceOrderIds.join(",");
      const { data } = await api.get<{
        items: Array<{
          product_id: number;
          sku: string;
          name: string;
          unit: string;
          qty: string;
          price: string;
          is_bonus: boolean;
          order_id?: number;
          order_number?: string;
        }>;
      }>(`/api/${tenantSlug}/returns/client-data?client_id=${clientIdNum}&order_ids=${ids}`);
      return data;
    }
  });

  const polkiOrdersPickRawCount = polkiOrdersPickQ.data?.length ?? 0;

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

  const togglePolkiOrderPick = (id: number, checked: boolean) => {
    setPolkiOrderIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const togglePolkiOrdersSelectAll = (checked: boolean) => {
    if (checked) setPolkiOrderIds(polkiOrdersForPick.map((o) => o.id));
    else setPolkiOrderIds([]);
  };

  useEffect(() => {
    if (!isPolkiSheet) return;
    if (isPolkiFree) {
      const d = polkiDateTo || polkiDateFrom;
      if (d) setPolkiHeaderDate(d);
      else setPolkiHeaderDate(new Date().toISOString().slice(0, 10));
      return;
    }
    if (isPolkiByOrder && polkiOrderIds.length > 0) {
      const orders = polkiOrdersForPick;
      let best = "";
      for (const id of polkiOrderIds) {
        const o = orders.find((x) => x.id === id);
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
      } else if (polkiOrderIds.length > 1) {
        params.set("order_ids", [...polkiOrderIds].sort((a, b) => a - b).join(","));
      } else if (polkiOrderIds.length === 1) {
        params.set("order_id", String(polkiOrderIds[0]));
      }
      const { data } = await api.get<ClientReturnDataPolki>(
        `/api/${tenantSlug}/returns/client-data?${params.toString()}`
      );
      return data;
    }
  });

  const clientSummaryQ = useQuery({
    queryKey: ["client", tenantSlug, clientIdNum, "order-form"],
    enabled: Boolean(tenantSlug) && Number.isFinite(clientIdNum) && clientIdNum > 0,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<
        ClientRow & {
          open_orders_total?: string;
        }
      >(`/api/${tenantSlug}/clients/${clientIdNum}`);
      return data;
    }
  });

  const ctxProfile = createCtxQ.data?.settings_profile;
  const uiPrefsQ = useQuery({
    queryKey: ["me", "ui-preferences", tenantSlug, "order-create"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        data?: {
          order_create?: {
            show_payment_method_selector?: boolean;
          };
        };
      }>(`/api/${tenantSlug}/me/ui-preferences`);
      return data.data;
    }
  });

  const requiresAgentAndPayment = !isPolkiSheet && normalizedType === "order";
  const tenantShowPaymentMethodSelector =
    (ctxProfile as { feature_flags?: Record<string, unknown> } | undefined)?.feature_flags
      ?.show_order_payment_method_selector !== false;
  const userShowPaymentMethodSelector = uiPrefsQ.data?.order_create?.show_payment_method_selector;
  const showOrderPaymentMethodSelector =
    typeof userShowPaymentMethodSelector === "boolean"
      ? userShowPaymentMethodSelector
      : tenantShowPaymentMethodSelector;
  const requiresPaymentMethodForSubmit = requiresAgentAndPayment && showOrderPaymentMethodSelector;

  const paymentMethodSelectOptions = useMemo(() => {
    const raw = ctxProfile?.references?.payment_method_entries;
    if (!Array.isArray(raw) || raw.length === 0) {
      const legacy = ctxProfile?.references?.payment_types;
      if (Array.isArray(legacy) && legacy.length > 0) {
        const uniq = Array.from(
          new Set(legacy.map((s) => String(s).trim()).filter(Boolean).map((s) => s.slice(0, 64)))
        );
        return uniq.map((s) => ({ id: s, name: s }));
      }
      // Oxirgi fallback: tenantda umuman sozlanmagan bo‘lsa ham select bo‘sh qolmasin.
      return [
        { id: "naqd", name: "Naqd" },
        { id: "terminal", name: "Terminal" },
        { id: "perechisleniye", name: "Perechisleniye" }
      ];
    }
    const out: { id: string; name: string }[] = [];
    for (const e of raw) {
      if (!e || typeof e !== "object") continue;
      const row = e as { id?: unknown; name?: unknown; active?: boolean };
      const id =
        typeof row.id === "string"
          ? row.id.trim()
          : typeof row.id === "number" && Number.isFinite(row.id)
            ? String(row.id)
            : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!id || !name || row.active === false) continue;
      out.push({ id, name });
    }
    return out;
  }, [ctxProfile]);

  useEffect(() => {
    if (showOrderPaymentMethodSelector) return;
    if (!paymentMethodRef.trim()) return;
    setPaymentMethodRef("");
  }, [showOrderPaymentMethodSelector, paymentMethodRef]);

  useEffect(() => {
    if (!showOrderPaymentMethodSelector) return;
    if (!paymentMethodRef.trim()) return;
    const exists = paymentMethodSelectOptions.some((e) => e.id === paymentMethodRef.trim());
    if (!exists) {
      setPaymentMethodRef("");
      setSelectionNotice("To‘lov usuli tanlovi yangilandi: mos bo‘lmagan qiymat olib tashlandi.");
    }
  }, [showOrderPaymentMethodSelector, paymentMethodRef, paymentMethodSelectOptions]);

  const requestTypeOptions = useMemo(
    () => activeRefSelectOptions(ctxProfile?.references?.request_type_entries),
    [ctxProfile]
  );
  const orderNoteOptions = useMemo(
    () => activeRefSelectOptions(ctxProfile?.references?.order_note_entries),
    [ctxProfile]
  );
  const refusalReasonPolkiOptions = useMemo(
    () => activeRefSelectOptions(ctxProfile?.references?.refusal_reason_entries),
    [ctxProfile]
  );

  const clients = createCtxQ.data?.clients ?? [];
  const eligibleClients = useMemo(
    () =>
      clients.filter((c) => {
        if (c.agent_id != null && c.agent_id > 0) return true;
        return c.agent_assignments.some((row) => {
          const hasAgent = row.agent_id != null && row.agent_id > 0;
          const hasExpeditor = row.expeditor_user_id != null && row.expeditor_user_id > 0;
          return hasAgent || hasExpeditor;
        });
      }),
    [clients]
  );
  const eligibleClientById = useMemo(() => {
    const out = new Map<number, (typeof eligibleClients)[number]>();
    for (const c of eligibleClients) out.set(c.id, c);
    return out;
  }, [eligibleClients]);
  const eligibleClientIdSet = useMemo(() => new Set(eligibleClients.map((c) => c.id)), [eligibleClients]);
  const orderClientPickerScopeIds = useMemo(() => eligibleClients.map((c) => c.id), [eligibleClients]);
  const polkiSelectedClientLabel = useMemo(() => {
    if (!clientId.trim()) return null;
    const id = Number.parseInt(clientId.trim(), 10);
    if (!Number.isFinite(id) || id < 1) return null;
    const fromList = eligibleClientById.get(id);
    if (fromList) {
      return orderClientPickerDisplayName(fromList);
    }
    if (clientSummaryQ.isFetching) return "Загрузка…";
    const d = clientSummaryQ.data;
    if (d?.name) {
      return orderClientPickerDisplayName({ id, name: d.name });
    }
    return `Клиент #${id}`;
  }, [clientId, eligibleClientById, clientSummaryQ.data, clientSummaryQ.isFetching]);
  const products = agentCatalogReady ? (createCtxQ.data?.products ?? []) : [];
  const warehouses = createCtxQ.data?.warehouses ?? [];
  const users = createCtxQ.data?.users ?? [];
  const categories = agentCatalogReady ? (createCtxQ.data?.product_categories ?? []) : [];
  const selectedClientRow = useMemo(() => {
    const id = Number.parseInt(clientId.trim(), 10);
    if (!Number.isFinite(id) || id < 1) return null;
    return eligibleClientById.get(id) ?? null;
  }, [clientId, eligibleClientById]);
  const clientAssignmentsForLock = useMemo(() => {
    if (selectedClientRow?.agent_assignments?.length) return selectedClientRow.agent_assignments;
    return clientSummaryQ.data?.agent_assignments;
  }, [selectedClientRow, clientSummaryQ.data?.agent_assignments]);
  const selectedClientExpeditorIds = useMemo(() => {
    if (!selectedClientRow) return [] as number[];
    const ids = new Set<number>();
    for (const row of selectedClientRow.agent_assignments) {
      if (row.expeditor_user_id != null && row.expeditor_user_id > 0) ids.add(row.expeditor_user_id);
    }
    return Array.from(ids);
  }, [selectedClientRow]);
  const selectedClientExpeditorIdSet = useMemo(
    () => new Set(selectedClientExpeditorIds),
    [selectedClientExpeditorIds]
  );

  useEffect(() => {
    if (!createCtxQ.data) return;
    /** Kalit o‘zgaganda `placeholderData: previous` — yangi klient eski `clients` ro‘yxatida bo‘lmasligi mumkin; fetch tugaguncha tekshirma. */
    if (createCtxQ.isPlaceholderData) return;
    if (!clientId.trim()) return;
    const id = Number.parseInt(clientId.trim(), 10);
    if (!Number.isFinite(id) || id < 1) {
      setClientId("");
      return;
    }
    if (!eligibleClientIdSet.has(id)) {
      debugOrderCreate("client.reset.invalid", {
        client_id: id,
        available_client_ids_sample: eligibleClients.slice(0, 15).map((c) => c.id),
        available_clients_total: eligibleClients.length,
        selected_agent_id:
          Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0 ? selectedAgentIdNum : null,
        selected_warehouse_id:
          Number.isFinite(selectedWarehouseIdNum) && selectedWarehouseIdNum > 0 ? selectedWarehouseIdNum : null,
        selected_expeditor_user_id:
          Number.isFinite(selectedExpeditorIdNum) && selectedExpeditorIdNum > 0 ? selectedExpeditorIdNum : null
      });
      setAgentId("");
      setWarehouseId("");
      setExpeditorUserId("");
      setPaymentMethodRef("");
      setQtyByProductId({});
      setBlockByProductId({});
      setPolkiOrderIds([]);
      setSelectionNotice(
        "Tanlangan klient kombinatsiyasi cheklovga tushdi: agent/ombor/qabulchi qayta tanlanadi."
      );
    }
  }, [
    eligibleClients,
    eligibleClientIdSet,
    clientId,
    createCtxQ.data,
    debugOrderCreate,
    selectedAgentIdNum,
    selectedWarehouseIdNum,
    selectedExpeditorIdNum,
    createCtxQ.isPlaceholderData
  ]);

  const warehouseIdSet = useMemo(() => new Set(warehouses.map((w) => w.id)), [warehouses]);

  useEffect(() => {
    if (!createCtxQ.data) return;
    if (createCtxQ.isPlaceholderData) return;
    if (!warehouseId.trim()) return;
    const id = Number.parseInt(warehouseId.trim(), 10);
    if (!Number.isFinite(id) || id < 1 || !warehouseIdSet.has(id)) {
      debugOrderCreate("warehouse.reset.invalid", {
        warehouse_id: id,
        available_warehouse_ids: warehouses.map((w) => w.id)
      });
      setWarehouseId("");
      setQtyByProductId({});
      setBlockByProductId({});
      setSelectionNotice("Ombor tanlovi yangilandi: mos bo‘lmagan qiymat olib tashlandi.");
    }
  }, [warehouseId, warehouses, warehouseIdSet, debugOrderCreate, createCtxQ.data, createCtxQ.isPlaceholderData]);

  useEffect(() => {
    if (!createCtxQ.data) return;
    if (createCtxQ.isPlaceholderData) return;
    if (!expeditorUserId.trim() || expeditorUserId.trim() === "__none__") return;
    const id = Number.parseInt(expeditorUserId.trim(), 10);
    if (!Number.isFinite(id) || id < 1) {
      setExpeditorUserId("");
      return;
    }
    const baseExps = createCtxQ.data?.expeditors ?? [];
    const exps =
      selectedClientRow == null
        ? baseExps
        : selectedClientExpeditorIds.length > 0
          ? baseExps.filter((e) => selectedClientExpeditorIdSet.has(e.id))
          : [];
    const expIdSet = new Set(exps.map((e) => e.id));
    if (!expIdSet.has(id)) {
      debugOrderCreate("expeditor.reset.invalid", {
        expeditor_user_id: id,
        available_expeditor_ids: exps.map((e) => e.id)
      });
      setExpeditorUserId("");
      setSelectionNotice("Dastavchi tanlovi yangilandi: mos bo‘lmagan qiymat olib tashlandi.");
    }
  }, [
    expeditorUserId,
    createCtxQ.data,
    createCtxQ.data?.expeditors,
    selectedClientRow,
    selectedClientExpeditorIds,
    selectedClientExpeditorIdSet,
    debugOrderCreate,
    createCtxQ.isPlaceholderData
  ]);

  useEffect(() => {
    if (!isPolkiSheet || warehouses.length === 0) return;
    if (createCtxQ.isPlaceholderData) return;
    if (warehouseId.trim()) return;
    const ret = warehouses.find((w) => w.stock_purpose === "return" && w.is_active !== false);
    if (ret) setWarehouseId(String(ret.id));
  }, [isPolkiSheet, warehouses, warehouseId, createCtxQ.isPlaceholderData]);
  const agentUsers = useMemo(() => {
    // `users` — `create-context` linkage (klient, ombor, qabulchi, agent) bo‘yicha serverda kesilgan ro‘yxat.
    return users.filter((u) => {
      const role = u.role.trim().toLowerCase();
      return role.includes("agent") && !role.includes("expeditor");
    });
  }, [users]);
  const agentUserIdSet = useMemo(() => new Set(agentUsers.map((u) => u.id)), [agentUsers]);
  const agentFilterOptions = useMemo(
    () => agentUsers.map((u) => orderAgentFilterOption({ id: u.id, name: u.name, login: u.login })),
    [agentUsers]
  );

  useEffect(() => {
    if (!createCtxQ.data) return;
    if (createCtxQ.isPlaceholderData) return;
    if (!agentId.trim()) return;
    const id = Number.parseInt(agentId.trim(), 10);
    if (!Number.isFinite(id) || id < 1 || !agentUserIdSet.has(id)) {
      debugOrderCreate("agent.reset.invalid", {
        agent_id: id,
        available_agent_ids: agentUsers.map((u) => u.id).slice(0, 50),
        available_agents_total: agentUsers.length
      });
      setAgentId("");
      setSelectionNotice("Agent tanlovi yangilandi: mos bo‘lmagan qiymat olib tashlandi.");
    }
  }, [agentId, agentUsers, agentUserIdSet, createCtxQ.data, createCtxQ.isPlaceholderData, debugOrderCreate]);

  const filteredExpeditors = useMemo(() => {
    const base = createCtxQ.data?.expeditors ?? [];
    if (!selectedClientRow) return base;
    if (selectedClientExpeditorIds.length === 0) return [];
    return base.filter((e) => selectedClientExpeditorIdSet.has(e.id));
  }, [
    createCtxQ.data?.expeditors,
    selectedClientRow,
    selectedClientExpeditorIds,
    selectedClientExpeditorIdSet
  ]);

  const expeditorFilterOptions = useMemo(() => {
    const rows = filteredExpeditors.map((r) =>
      orderExpeditorFilterOption({ id: r.id, fio: r.fio, login: r.login })
    );
    return [{ value: "__none__", label: "Ekspeditorsiz", searchText: "ekspeditorsiz без" }, ...rows];
  }, [filteredExpeditors]);

  useEffect(() => {
    if (createCtxQ.isPlaceholderData) return;
    if (agentUsers.length !== 1) return;
    /** Tanlangan agent bor-yo‘qligida majburiylama — placeholder/stale ro‘yxat boshqa agentni yo‘qotmasin. */
    if (agentId.trim()) return;
    const onlyAgentId = agentUsers[0].id;
    debugOrderCreate("agent.autoset.by-client", {
      client_id: selectedClientRow?.id ?? null,
      agent_id_from_client: onlyAgentId,
      previous_agent_id: null
    });
    setAgentId(String(onlyAgentId));
    setSelectionNotice("Agent klient kartasiga mos ravishda avtomatik tanlandi.");
  }, [createCtxQ.isPlaceholderData, agentUsers, agentId, debugOrderCreate, selectedClientRow?.id]);

  useEffect(() => {
    debugOrderCreate("selection.snapshot", {
      client_id: Number.isFinite(clientIdNum) && clientIdNum > 0 ? clientIdNum : null,
      agent_id: Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0 ? selectedAgentIdNum : null,
      warehouse_id:
        Number.isFinite(selectedWarehouseIdNum) && selectedWarehouseIdNum > 0 ? selectedWarehouseIdNum : null,
      expeditor_user_id:
        Number.isFinite(selectedExpeditorIdNum) && selectedExpeditorIdNum > 0 ? selectedExpeditorIdNum : null,
      available: {
        clients: eligibleClients.length,
        agentUsers: agentUsers.length,
        warehouses: warehouses.length,
        expeditors: filteredExpeditors.length
      }
    });
  }, [
    clientIdNum,
    selectedAgentIdNum,
    selectedWarehouseIdNum,
    selectedExpeditorIdNum,
    eligibleClients.length,
    agentUsers.length,
    warehouses.length,
    filteredExpeditors.length,
    debugOrderCreate
  ]);
  const stockByProduct = new Map<number, { qty: string; reserved_qty: string }>(
    (stockQ.data ?? []).map((s) => [s.product_id, s])
  );
  const categoryFilterSet = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);
  const categoryFilterActive = categoryFilterSet.size > 0;

  useEffect(() => {
    if (selectedCategoryIds.length === 0) {
      setActiveCatalogCategoryId(null);
      return;
    }
    setActiveCatalogCategoryId((cur) =>
      cur != null && selectedCategoryIds.includes(cur) ? cur : selectedCategoryIds[0]!
    );
  }, [selectedCategoryIds]);

  const polkiRowsAll = useMemo((): PolkiPairRowModel[] => {
    if (!isPolkiSheet || !polkiContextQ.data?.items?.length) return [];
    return buildPolkiPairRows(polkiContextQ.data.items as PolkiClientItem[], products);
  }, [isPolkiSheet, polkiContextQ.data?.items, products]);

  const polkiLineKeySet = useMemo(
    () => new Set(polkiRowsAll.map((r) => r.pair_key)),
    [polkiRowsAll]
  );
  useEffect(() => {
    if (!isPolkiSheet) return;
    const pruneRecord = <T,>(prev: Record<string, T>): Record<string, T> => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!polkiLineKeySet.has(k)) delete next[k];
      }
      return next;
    };
    setPolkiTotalQty((p) => pruneRecord(p));
    setPolkiBonusCash((p) => pruneRecord(p));
    setPolkiBonusToBalance((p) => pruneRecord(p));
  }, [isPolkiSheet, polkiLineKeySet]);

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

  const polkiRowsFiltered = useMemo((): PolkiPairRowModel[] => {
    if (!isPolkiSheet) return [];
    return polkiRowsAll.filter((r) => {
      if (!categoryFilterActive) return true;
      const cid = r.category_id;
      if (cid == null || !Number.isFinite(cid)) return false;
      const activeId = activeCatalogCategoryId ?? selectedCategoryIds[0];
      return cid === activeId;
    });
  }, [isPolkiSheet, polkiRowsAll, categoryFilterActive, activeCatalogCategoryId, selectedCategoryIds]);

  const polkiDisplayRows = useMemo((): PolkiPairRowModel[] => {
    if (!isPolkiSheet) return [];
    const n = productSearch.trim().toLowerCase();
    if (!n) return polkiRowsFiltered;
    return polkiRowsFiltered.filter(
      (r) => r.name.toLowerCase().includes(n) || (r.sku ?? "").toLowerCase().includes(n)
    );
  }, [isPolkiSheet, polkiRowsFiltered, productSearch]);

  const polkiOrderGroups = useMemo((): PolkiOrderGroup[] => {
    if (!isPolkiSheet) return [];
    const byOrder = new Map<number, PolkiPairRowModel[]>();
    for (const r of polkiDisplayRows) {
      const arr = byOrder.get(r.order_id) ?? [];
      arr.push(r);
      byOrder.set(r.order_id, arr);
    }
    return Array.from(byOrder.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([orderId, rows]) => ({
        orderId,
        orderNumber: rows[0]?.order_number ?? String(orderId),
        orderDate: polkiOrderDateById.get(orderId) ?? "",
        rows
      }));
  }, [isPolkiSheet, polkiDisplayRows, polkiOrderDateById]);

  const hasPolkiQtyOverMax = useMemo(() => {
    if (!isPolkiSheet) return false;
    for (const r of polkiRowsAll) {
      const pk = r.pair_key;
      const tr = polkiTotalQty[pk] ?? "";
      if (!tr.trim()) continue;
      const tq = Number.parseFloat(tr.replace(",", "."));
      if (Number.isFinite(tq) && tq > 0 && tq > r.max_paid + r.max_bonus) return true;
    }
    return false;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty]);

  const hasPolkiBonusCashOverMax = useMemo(() => {
    if (!isPolkiSheet) return false;
    for (const r of polkiRowsAll) {
      if (r.max_bonus <= 0) continue;
      const pk = r.pair_key;
      const total = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
      const { effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      const defer = Boolean(polkiBonusToBalance[pk]);
      const bq = defer ? 0 : effBonus;
      const maxCash = defer
        ? r.max_bonus * r.unit_price_bonus
        : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus);
      const cash = parsePriceAmount(polkiBonusCash[pk] ?? "");
      if (cash > maxCash + 1e-6) return true;
    }
    return false;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance, polkiBonusCash]);

  const polkiTotalReturnQtySum = useMemo(() => {
    if (!isPolkiSheet) return 0;
    let s = 0;
    for (const r of polkiRowsAll) {
      const pk = r.pair_key;
      const total = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
      const { effPaid, effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      const defer = Boolean(polkiBonusToBalance[pk]);
      const physBonus = defer ? 0 : effBonus;
      s += effPaid + physBonus;
    }
    return s;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance]);

  const polkiTotalBonusCashSum = useMemo(() => {
    if (!isPolkiSheet) return 0;
    let t = 0;
    for (const r of polkiRowsAll) {
      if (r.max_bonus <= 0) continue;
      const pk = r.pair_key;
      const total = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
      const { effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      const defer = Boolean(polkiBonusToBalance[pk]);
      const bq = defer ? 0 : effBonus;
      const maxCash = defer
        ? r.max_bonus * r.unit_price_bonus
        : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus);
      const cash = parsePriceAmount(polkiBonusCash[pk] ?? "");
      t += Math.min(cash, maxCash);
    }
    return t;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance, polkiBonusCash]);

  const polkiDebtHintSum = useMemo(() => {
    if (!isPolkiSheet) return 0;
    let d = 0;
    for (const r of polkiRowsAll) {
      if (!polkiBonusToBalance[r.pair_key]) continue;
      const total = Number.parseFloat((polkiTotalQty[r.pair_key] ?? "").replace(",", "."));
      const { effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      if (effBonus <= 0) continue;
      const suggested = effBonus * r.unit_price_bonus;
      const maxC = r.max_bonus * r.unit_price_bonus;
      const cash = Math.min(parsePriceAmount(polkiBonusCash[r.pair_key] ?? ""), maxC);
      d += Math.max(0, suggested - cash);
    }
    return d;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance, polkiBonusCash]);

  const polkiSelectedLinesCount = useMemo(() => {
    if (!isPolkiSheet) return 0;
    let n = 0;
    for (const r of polkiRowsAll) {
      const pk = r.pair_key;
      const total = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
      const { effPaid, effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      const defer = Boolean(polkiBonusToBalance[pk]);
      const bq = defer ? 0 : effBonus;
      const maxCash =
        r.max_bonus > 0
          ? defer
            ? r.max_bonus * r.unit_price_bonus
            : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus)
          : 0;
      const effCash = r.max_bonus > 0 ? Math.min(parsePriceAmount(polkiBonusCash[pk] ?? ""), maxCash) : 0;
      if (effPaid + bq + effCash > 0) n++;
    }
    return n;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance, polkiBonusCash]);

  const polkiEstimatedSum = useMemo(() => {
    if (!isPolkiSheet) return 0;
    let t = 0;
    for (const r of polkiRowsAll) {
      const pk = r.pair_key;
      const total = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
      const { effPaid, effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      const defer = Boolean(polkiBonusToBalance[pk]);
      const bq = defer ? 0 : effBonus;
      const maxCash =
        r.max_bonus > 0
          ? defer
            ? r.max_bonus * r.unit_price_bonus
            : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus)
          : 0;
      const cash = r.max_bonus > 0 ? Math.min(parsePriceAmount(polkiBonusCash[pk] ?? ""), maxCash) : 0;
      t += effPaid * r.unit_price_paid;
      t += cash;
    }
    return t;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance, polkiBonusCash]);

  const polkiVolumeM3 = useMemo(() => {
    if (!isPolkiSheet) return 0;
    let v = 0;
    for (const r of polkiRowsAll) {
      const pk = r.pair_key;
      const total = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
      const { effPaid, effBonus } = polkiSplitTotal(r, Number.isFinite(total) ? total : 0);
      const defer = Boolean(polkiBonusToBalance[pk]);
      const physBonus = defer ? 0 : effBonus;
      const vol = r.volume_m3 != null ? Number.parseFloat(String(r.volume_m3)) : NaN;
      if (Number.isFinite(vol) && effPaid + physBonus > 0) v += (effPaid + physBonus) * vol;
    }
    return v;
  }, [isPolkiSheet, polkiRowsAll, polkiTotalQty, polkiBonusToBalance]);

  const catalogProducts = useMemo(() => {
    const stockMap = new Map((stockQ.data ?? []).map((s) => [s.product_id, s]));
    const filtered = products.filter((p) => {
      if (categoryFilterActive) {
        const cid = p.category_id;
        if (cid == null || !Number.isFinite(cid) || !categoryFilterSet.has(cid)) return false;
      }
      if (!warehouseId) return false;
      const s = stockMap.get(p.id);
      return availableOrderQty(s) > 0;
    });
    const seen = new Set<number>();
    const deduped: ProductRow[] = [];
    for (const p of filtered) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      deduped.push(p);
    }
    return deduped;
  }, [products, categoryFilterActive, categoryFilterSet, warehouseId, stockQ.data]);

  /**
   * Tanlangan ombor bo‘yicha: katalog mahsulotlari ichida Mavjud (fakt − bron) > 0 bo‘lgan kategoriyalar.
   * `stockQ.isSuccess` bo‘lmaguncha `null` — chip yoki tabda noto‘g‘ri kategoriya chiqmasin.
   */
  const categoryIdsWithPositiveStock = useMemo(() => {
    if (!warehouseId.trim()) return null;
    if (!stockProductIdsKey) return new Set<number>();
    if (!stockQ.isSuccess) return null;
    const stockMap = new Map((stockQ.data ?? []).map((s) => [s.product_id, s]));
    const ids = new Set<number>();
    for (const p of products) {
      const cid = p.category_id;
      if (cid == null || !Number.isFinite(cid)) continue;
      if (availableOrderQty(stockMap.get(p.id)) > 0) ids.add(cid);
    }
    return ids;
  }, [products, warehouseId, stockProductIdsKey, stockQ.isSuccess, stockQ.data]);

  /** Ombor qoldiqlari kutilganda `null`; tayyor bo‘lsa faqat Mavjud (fakt − bron) > 0 bo‘lgan kategoriyalar; xato bo‘lsa `[]`. */
  const categoriesWithWarehouseSellableStock = useMemo(() => {
    if (!warehouseId.trim() || !stockProductIdsKey) return categories;
    if (stockQ.isError) return [];
    if (!stockQ.isSuccess) return null;
    if (categoryIdsWithPositiveStock == null) return null;
    return categories.filter((c) => categoryIdsWithPositiveStock.has(c.id));
  }, [categories, warehouseId, stockProductIdsKey, stockQ.isSuccess, stockQ.isError, categoryIdsWithPositiveStock]);

  /** Tanlangan narxda narx yo‘q yoki miqdor mavjud qoldiqdan oshgan qatorlar soni (kategoriya bo‘yicha). */
  const lineProblemCountByCategoryId = useMemo(() => {
    const counts = new Map<number, number>();
    if (!warehouseId.trim()) return counts;
    const stockMap = new Map((stockQ.data ?? []).map((s) => [s.product_id, s]));
    for (const p of products) {
      const cid = p.category_id;
      if (cid == null || !Number.isFinite(cid)) continue;
      if (availableOrderQty(stockMap.get(p.id)) <= 0) continue;
      const raw = qtyByProductId[p.id];
      const lineQ = Number.parseFloat((raw ?? "").replace(",", "."));
      if (!Number.isFinite(lineQ) || lineQ <= 0) continue;
      const avail = availableOrderQty(stockMap.get(p.id));
      const missingPrice = unitPriceForType(p, priceType) == null;
      const overQty = lineQ > avail;
      if (missingPrice || overQty) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    return counts;
  }, [products, warehouseId, stockQ.data, qtyByProductId, priceType]);

  useEffect(() => {
    if (categoryIdsWithPositiveStock == null) return;
    setSelectedCategoryIds((prev) => {
      const next = prev.filter((id) => categoryIdsWithPositiveStock.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [categoryIdsWithPositiveStock]);

  useEffect(() => {
    if (selectedCategoryIds.length === 0) {
      setActiveCatalogCategoryId(null);
      return;
    }
    setActiveCatalogCategoryId((cur) =>
      cur != null && selectedCategoryIds.includes(cur) ? cur : selectedCategoryIds[0]!
    );
  }, [selectedCategoryIds]);

  const productSearchNorm = productSearch.trim().toLowerCase();
  const displayProducts = useMemo(() => {
    if (!productSearchNorm) return catalogProducts;
    return catalogProducts.filter((p) => {
      const n = p.name.toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      return n.includes(productSearchNorm) || sku.includes(productSearchNorm);
    });
  }, [catalogProducts, productSearchNorm]);

  /** Jadval: kategoriya bo‘yicha ustun-sarlavha + qatorlar */
  const displayProductGroups = useMemo(() => {
    if (displayProducts.length === 0) return [];
    const byId = new Map<number, ProductRow[]>();
    const uncategorized: ProductRow[] = [];
    for (const p of displayProducts) {
      const cid = p.category_id;
      if (cid == null || !Number.isFinite(cid)) {
        uncategorized.push(p);
        continue;
      }
      const arr = byId.get(cid) ?? [];
      arr.push(p);
      byId.set(cid, arr);
    }
    const known = new Set(categories.map((c) => c.id));
    const out: { key: string; categoryName: string; products: ProductRow[] }[] = [];
    for (const c of categories) {
      const prows = byId.get(c.id);
      if (!prows?.length) continue;
      out.push({ key: `c-${c.id}`, categoryName: c.name, products: prows });
    }
    for (const [cid, prows] of byId) {
      if (known.has(cid)) continue;
      out.push({ key: `o-${cid}`, categoryName: `Kategoriya #${cid}`, products: prows });
    }
    if (uncategorized.length > 0) {
      out.push({ key: "none", categoryName: "Kategoriyasiz", products: uncategorized });
    }
    return out;
  }, [displayProducts, categories]);

  /** Tanlangan kategoriyalar > 0 bo‘lsa — pastdagi tab; jadval faqat faol tab bo‘yicha (miqdorlar `product_id` da saqlanadi) */
  const catalogTabMode = selectedCategoryIds.length > 0;
  const tableProductGroups = useMemo(() => {
    if (!catalogTabMode) {
      return displayProductGroups;
    }
    const aid = activeCatalogCategoryId ?? selectedCategoryIds[0]!;
    const cat = categories.find((c) => c.id === aid);
    const name = cat?.name ?? `Kategoriya #${aid}`;
    const prows = displayProducts.filter((p) => p.category_id === aid);
    return [{ key: `tab-${aid}`, categoryName: name, products: prows }];
  }, [catalogTabMode, displayProductGroups, displayProducts, activeCatalogCategoryId, selectedCategoryIds, categories]);

  const hasQtyOverStock = useMemo(() => {
    const rows = stockQ.data ?? [];
    const map = new Map(rows.map((s) => [s.product_id, s]));
    for (const p of catalogProducts) {
      const raw = qtyByProductId[p.id];
      if (!raw?.trim()) continue;
      const lineQ = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(lineQ) || lineQ <= 0) continue;
      const avail = availableOrderQty(map.get(p.id));
      if (lineQ > avail) return true;
    }
    return false;
  }, [catalogProducts, qtyByProductId, stockQ.data]);
  const hasMissingPriceForSelected = useMemo(() => {
    for (const p of catalogProducts) {
      const raw = qtyByProductId[p.id];
      const q = Number.parseFloat((raw ?? "").replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      if (unitPriceForType(p, priceType) == null) return true;
    }
    return false;
  }, [catalogProducts, qtyByProductId, priceType]);
  const missingPriceProductNames = useMemo(() => {
    const names: string[] = [];
    for (const p of catalogProducts) {
      const raw = qtyByProductId[p.id];
      const q = Number.parseFloat((raw ?? "").replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      if (unitPriceForType(p, priceType) == null) names.push(p.name);
    }
    return names.slice(0, 3);
  }, [catalogProducts, qtyByProductId, priceType]);

  const selectedItemsCount = catalogProducts.reduce((acc, p) => {
    const raw = qtyByProductId[p.id];
    const q = Number.parseFloat((raw ?? "").replace(",", "."));
    return Number.isFinite(q) && q > 0 ? acc + 1 : acc;
  }, 0);
  const selectedTotalQty = useMemo(() => {
    const map = new Map((stockQ.data ?? []).map((s) => [s.product_id, s]));
    let sum = 0;
    for (const p of catalogProducts) {
      const raw = qtyByProductId[p.id];
      const q = Number.parseFloat((raw ?? "").replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      const avail = availableOrderQty(map.get(p.id));
      sum += Math.min(q, avail);
    }
    return sum
      .toFixed(3)
      .replace(/\.?0+$/, "");
  }, [catalogProducts, qtyByProductId, stockQ.data]);

  const estimatedSum = useMemo(() => {
    const map = new Map((stockQ.data ?? []).map((s) => [s.product_id, s]));
    let t = 0;
    for (const p of catalogProducts) {
      const raw = qtyByProductId[p.id];
      const q = Number.parseFloat((raw ?? "").replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      const avail = availableOrderQty(map.get(p.id));
      const effective = Math.min(q, avail);
      if (effective <= 0) continue;
      const up = unitPriceForType(p, priceType);
      if (up != null) t += effective * parsePriceAmount(up);
    }
    return t;
  }, [catalogProducts, qtyByProductId, priceType, stockQ.data]);

  const exchangePairRows = useMemo(
    () => buildExchangePairRows(exchangeReturnsQ.data?.items),
    [exchangeReturnsQ.data?.items]
  );

  const exchangePayloadCheck = useMemo(
    () =>
      buildExchangeCreateBody({
        sourceOrderIds: exchangeSourceOrderIds,
        minusKey: exMinusKey,
        minusQty: exMinusQty,
        plusProductId: exPlusProductId,
        plusQty: exPlusQty,
        pairRows: exchangePairRows
      }),
    [
      exchangeSourceOrderIds,
      exMinusKey,
      exMinusQty,
      exPlusProductId,
      exPlusQty,
      exchangePairRows
    ]
  );

  const totalVolumeM3 = useMemo(() => {
    const map = new Map((stockQ.data ?? []).map((s) => [s.product_id, s]));
    let v = 0;
    for (const p of catalogProducts) {
      const raw = qtyByProductId[p.id];
      const q = Number.parseFloat((raw ?? "").replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      const avail = availableOrderQty(map.get(p.id));
      const eff = Math.min(q, avail);
      if (eff <= 0) continue;
      const volU = p.volume_m3 != null ? Number.parseFloat(p.volume_m3) : NaN;
      if (Number.isFinite(volU)) v += eff * volU;
    }
    return v;
  }, [catalogProducts, qtyByProductId, stockQ.data]);

  const hasClient = Boolean(clientId.trim());
  const hasWarehouse = Boolean(warehouseId.trim());
  const canPickWarehouse = hasClient;
  const canPickPricingAndExpeditor = hasWarehouse;
  const canPickProducts = hasClient && hasWarehouse;
  const canShowOrderCatalog =
    canPickProducts &&
    (!requiresAgentForProductCatalog || hasAgentSelected) &&
    Boolean(createCtxQ.data) &&
    !createCtxQ.isPlaceholderData;

  const loadingLists = createCtxQ.isPending && !createCtxQ.data;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isPolkiSheet) {
        const cid = Number.parseInt(clientId, 10);
        if (!Number.isFinite(cid) || cid < 1) throw new Error("client");
        const wid = Number.parseInt(warehouseId, 10);
        if (!warehouseId.trim() || !Number.isFinite(wid) || wid < 1) throw new Error("warehouse");
        if (isPolkiByOrder && polkiOrderIds.length < 1) {
          throw new Error("polki_order");
        }
        const distinctOrderCount = new Set(polkiRowsAll.map((row) => row.order_id)).size;
        const usePeriodBatch =
          (isPolkiByOrder && polkiOrderIds.length > 1) ||
          (isPolkiFree && distinctOrderCount > 1);

        let sumPhysical = 0;
        const batchLines: {
          order_id: number;
          product_id: number;
          paid_qty: number;
          bonus_qty: number;
          bonus_cash: number;
        }[] = [];
        const periodMerge = new Map<number, { paid: number; bonus: number; cash: number }>();

        for (const r of polkiRowsAll) {
          const pk = r.pair_key;
          const totalParsed = Number.parseFloat((polkiTotalQty[pk] ?? "").replace(",", "."));
          const { effPaid, effBonus } = polkiSplitTotal(
            r,
            Number.isFinite(totalParsed) ? totalParsed : 0
          );
          const defer = Boolean(polkiBonusToBalance[pk]);
          const pq = effPaid;
          const bq = defer ? 0 : effBonus;
          let cash = parsePriceAmount(polkiBonusCash[pk] ?? "");
          const maxCash =
            r.max_bonus > 0
              ? defer
                ? r.max_bonus * r.unit_price_bonus
                : Math.max(0, (r.max_bonus - bq) * r.unit_price_bonus)
              : 0;
          if (r.max_bonus <= 0) cash = 0;
          else cash = Math.min(cash, maxCash);

          if (pq + bq + cash <= 0) continue;
          sumPhysical += pq + bq;
          if (usePeriodBatch) {
            const oid = r.order_id;
            if (!oid || oid < 1) throw new Error("polki_missing_order");
            batchLines.push({
              order_id: oid,
              product_id: r.product_id,
              paid_qty: pq,
              bonus_qty: bq,
              bonus_cash: cash
            });
          } else {
            const cur = periodMerge.get(r.product_id) ?? { paid: 0, bonus: 0, cash: 0 };
            cur.paid += pq;
            cur.bonus += bq;
            cur.cash += cash;
            periodMerge.set(r.product_id, cur);
          }
        }
        if (sumPhysical > MAX_POLKI_RETURN_QTY) throw new Error("polki_too_many");
        const noteParts: string[] = [];
        if (polkiHeaderDate.trim()) noteParts.push(`Дата заявки: ${polkiHeaderDate.trim()}`);
        if (polkiTradeDirection.trim()) {
          const td =
            POLKI_TRADE_DIRECTION_OPTS.find((o) => o.value === polkiTradeDirection)?.label ??
            polkiTradeDirection;
          noteParts.push(`Направление: ${td}`);
        }
        if (polkiSkidkaType !== "none") {
          const sd =
            POLKI_SKIDKA_OPTS.find((o) => o.value === polkiSkidkaType)?.label ?? polkiSkidkaType;
          noteParts.push(`Скидка: ${sd}`);
        }
        if (orderNotePreset.trim()) {
          const presetLabel =
            refEntryLabelByStored(ctxProfile?.references?.order_note_entries, orderNotePreset) ??
            orderNotePreset;
          noteParts.push(presetLabel);
        }
        if (orderComment.trim()) noteParts.push(orderComment.trim());
        const noteJoined = noteParts.join("\n").trim();

        if (usePeriodBatch) {
          if (batchLines.length === 0) throw new Error("nolines");
          const body: Record<string, unknown> = {
            client_id: cid,
            warehouse_id: wid,
            price_type: priceType.trim() || "retail",
            lines: batchLines
          };
          if (noteJoined) body.note = noteJoined;
          if (refusalReasonRefPolki.trim()) body.refusal_reason_ref = refusalReasonRefPolki.trim();
          await api.post(`/api/${tenantSlug}/returns/period-batch`, body);
          return;
        }

        const lines = Array.from(periodMerge.entries())
          .map(([product_id, v]) => ({
            product_id,
            paid_qty: v.paid,
            bonus_qty: v.bonus,
            bonus_cash: v.cash
          }))
          .filter((l) => l.paid_qty + l.bonus_qty + l.bonus_cash > 0);
        if (lines.length === 0) throw new Error("nolines");

        const body: Record<string, unknown> = {
          client_id: cid,
          warehouse_id: wid,
          price_type: priceType.trim() || "retail",
          lines
        };
        if (isPolkiFree) {
          if (polkiDateFrom) body.date_from = polkiDateFrom;
          if (polkiDateTo) body.date_to = polkiDateTo;
        } else if (polkiOrderIds.length === 1) {
          body.order_id = polkiOrderIds[0];
        }
        if (noteJoined) body.note = noteJoined;
        if (refusalReasonRefPolki.trim()) body.refusal_reason_ref = refusalReasonRefPolki.trim();
        await api.post(`/api/${tenantSlug}/returns/period`, body);
        return;
      }

      if (isExchangeFlow) {
        const pairRows = buildExchangePairRows(exchangeReturnsQ.data?.items);
        const built = buildExchangeCreateBody({
          sourceOrderIds: exchangeSourceOrderIds,
          minusKey: exMinusKey,
          minusQty: exMinusQty,
          plusProductId: exPlusProductId,
          plusQty: exPlusQty,
          pairRows
        });
        if (!built.ok) throw new Error(`exchange_${built.reason}`);
        const cid = Number.parseInt(clientId, 10);
        if (!Number.isFinite(cid) || cid < 1) throw new Error("client");
        const wid = Number.parseInt(warehouseId, 10);
        if (!warehouseId.trim() || !Number.isFinite(wid) || wid < 1) throw new Error("warehouse");
        const agentParsed = agentId.trim() ? Number.parseInt(agentId, 10) : NaN;
        const agent_id =
          Number.isFinite(agentParsed) && agentParsed > 0 ? agentParsed : null;
        if (agent_id == null) throw new Error("agent");
        const freeComment = orderComment.trim();
        const presetStored = orderNotePreset.trim();
        let commentOut: string | null = freeComment || null;
        if (presetStored) {
          const presetLabel =
            refEntryLabelByStored(ctxProfile?.references?.order_note_entries, presetStored) ??
            presetStored;
          commentOut = freeComment ? `${presetLabel}\n${freeComment}` : presetLabel;
        }
        const body: Record<string, unknown> = {
          client_id: cid,
          warehouse_id: wid,
          agent_id,
          price_type: priceType.trim() || "retail",
          order_type: "exchange",
          apply_bonus: false,
          items: [],
          comment: commentOut,
          request_type_ref: requestTypeRef.trim() || null,
          ...built.body
        };
        const expRaw = expeditorUserId.trim();
        if (expRaw === "__none__") body.expeditor_user_id = null;
        else if (expRaw !== "") {
          const eid = Number.parseInt(expRaw, 10);
          if (Number.isFinite(eid) && eid > 0) body.expeditor_user_id = eid;
        }
        await api.post(`/api/${tenantSlug}/orders`, body);
        return;
      }

      const cid = Number.parseInt(clientId, 10);
      if (!Number.isFinite(cid) || cid < 1) throw new Error("client");

      const wid = Number.parseInt(warehouseId, 10);
      if (!warehouseId.trim() || !Number.isFinite(wid) || wid < 1) throw new Error("warehouse");

      const validatedOrderType =
        orderType && (ORDER_TYPE_VALUES as readonly string[]).includes(orderType) ? orderType : "order";

      const agentParsed = agentId.trim() ? Number.parseInt(agentId, 10) : NaN;
      const agent_id =
        Number.isFinite(agentParsed) && agentParsed > 0 ? agentParsed : null;

      if (validatedOrderType === "order") {
        if (agent_id == null) throw new Error("agent");
        if (requiresPaymentMethodForSubmit) {
          if (paymentMethodSelectOptions.length === 0) throw new Error("payment_method_empty");
          const pm = paymentMethodRef.trim().slice(0, 64);
          if (!pm) throw new Error("payment_method");
        }
      }

      const stockRows = stockQ.data ?? [];
      const stockMap = new Map(stockRows.map((s) => [s.product_id, s]));
      const qtyAgg = new Map<number, number>();
      for (const p of catalogProducts) {
        const raw = qtyByProductId[p.id];
        if (!raw || !raw.trim()) continue;
        const q = Number.parseFloat(raw.replace(",", "."));
        if (!Number.isFinite(q) || q < 0) throw new Error("qty");
        if (q === 0) continue;
        qtyAgg.set(p.id, (qtyAgg.get(p.id) ?? 0) + q);
      }
      const items: { product_id: number; qty: number }[] = [];
      for (const [productId, totalQ] of Array.from(qtyAgg.entries())) {
        if (totalQ <= 0) continue;
        if (!Number.isFinite(totalQ)) throw new Error("qty");
        const avail = availableOrderQty(stockMap.get(productId));
        if (totalQ > avail) throw new Error("qty_over_stock");
        items.push({ product_id: productId, qty: totalQ });
      }
      if (items.length === 0) throw new Error("nolines");

      const freeComment = orderComment.trim();
      const presetStored = orderNotePreset.trim();
      let commentOut: string | null = freeComment || null;
      if (presetStored) {
        const presetLabel =
          refEntryLabelByStored(ctxProfile?.references?.order_note_entries, presetStored) ??
          presetStored;
        commentOut = freeComment ? `${presetLabel}\n${freeComment}` : presetLabel;
      }
      const body: Record<string, unknown> = {
        client_id: cid,
        warehouse_id: wid,
        agent_id,
        price_type: priceType.trim() || "retail",
        order_type: validatedOrderType,
        apply_bonus: applyBonus,
        comment: commentOut,
        request_type_ref: requestTypeRef.trim() || null,
        items
      };
      if (validatedOrderType === "order" && orderIsConsignment) {
        body.is_consignment = true;
        const due = consignmentDueDate.trim() || currentMonthEndIsoDate();
        body.consignment_due_date = due;
      }
      const expRaw = expeditorUserId.trim();
      if (expRaw === "__none__") body.expeditor_user_id = null;
      else if (expRaw !== "") {
        const eid = Number.parseInt(expRaw, 10);
        if (Number.isFinite(eid) && eid > 0) body.expeditor_user_id = eid;
      }
      if (validatedOrderType === "order" && showOrderPaymentMethodSelector) {
        body.payment_method_ref = paymentMethodRef.trim().slice(0, 64);
      }

      await api.post(`/api/${tenantSlug}/orders`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["orders", "create-context", tenantSlug] });
      if (isPolkiSheet || isExchangeFlow) {
        void qc.invalidateQueries({ queryKey: ["returns", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["returns-client-data", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["exchange-returns", tenantSlug] });
      }
      setRequestTypeRef("");
      setOrderNotePreset("");
      setRefSelectKey((k) => k + 1);
      setOrderIsConsignment(false);
      setConsignmentDueDate("");
      setConsignmentDueOpen(false);
      setPaymentMethodRef("");
      onCreated();
    },
    onError: (e: Error) => {
      if (isPolkiSheet) {
        if (e.message === "warehouse") {
          setLocalError("Выберите склад возврата.");
          return;
        }
        if (e.message === "client") {
          setLocalError("Выберите клиента.");
          return;
        }
        if (e.message === "polki_order") {
          setLocalError(
            "Отметьте хотя бы один заказ со статусом «Доставлен» (доступны только такие заказы)."
          );
          return;
        }
        if (e.message === "polki_missing_order") {
          setLocalError("Для строки не указан заказ — обновите страницу.");
          return;
        }
        if (e.message === "polki_qty_over") {
          setLocalError("Количество возврата не больше проданного.");
          return;
        }
        if (e.message === "polki_too_many") {
          setLocalError(
            `В одном документе не более ${MAX_POLKI_RETURN_QTY} шт к возврату на склад.`
          );
          return;
        }
        if (e.message === "nolines") {
          setLocalError("Укажите хотя бы одну позицию с количеством или компенсацией бонуса.");
          return;
        }
        if (e.message === "qty") {
          setLocalError("Во всех строках количество должно быть положительным.");
          return;
        }
        if (e.message === "qty_over_stock") {
          setLocalError("Количество не больше остатка по каждой позиции.");
          return;
        }
      }
      if (e.message === "warehouse") {
        setLocalError("Omborni tanlash shart.");
        return;
      }
      if (e.message === "agent") {
        setLocalError("Savdo zakazi uchun agentni tanlang.");
        return;
      }
      if (e.message === "payment_method") {
        setLocalError("To‘lov usulini tanlang.");
        return;
      }
      if (e.message === "payment_method_empty") {
        setLocalError("To‘lov usullari ro‘yxati bo‘sh. Agent/dastavchi yoki sozlamalarni tekshiring.");
        return;
      }
      if (e.message === "client") {
        setLocalError("Klientni tanlang.");
        return;
      }
      if (e.message === "polki_order") {
        setLocalError("«Zakaz bo‘yicha» rejimida kamida bitta zakazni tanlang.");
        return;
      }
      if (e.message === "polki_missing_order") {
        setLocalError("Qator uchun zakaz identifikatori yo‘q — qayta yuklang.");
        return;
      }
      if (e.message === "polki_qty_over") {
        setLocalError("Qaytarish miqdori sotilgan miqdordan oshmasin.");
        return;
      }
      if (e.message === "polki_too_many") {
        setLocalError(`Bir hujjatda jami qaytarish ${MAX_POLKI_RETURN_QTY} donadan oshmasin.`);
        return;
      }
      if (e.message === "nolines") {
        setLocalError("Kamida bitta to‘liq qator (mahsulot + miqdor) kerak.");
        return;
      }
      if (e.message === "qty") {
        setLocalError("Barcha qatorlarda miqdor musbat bo‘lsin.");
        return;
      }
      if (e.message === "qty_over_stock") {
        setLocalError("Miqdor qoldiqdan oshmasin — har bir mahsulot uchun «Qoldiq» ustunidagi miqdordan ko‘p bo‘lmasin.");
        return;
      }
      const ax = e as AxiosError<{
        error?: string;
        message?: string;
        product_id?: number;
        credit_limit?: string;
        outstanding?: string;
        order_total?: string;
        details?: unknown;
      }>;
      const code = ax.response?.data?.error;
      const d = ax.response?.data;
      if (code === "DatabaseSchemaMismatch") {
        const msg = d?.message?.trim();
        setLocalError(
          msg ||
            "Bazada kerakli ustunlar yo‘q (migratsiya qo‘llanmagan). Backend papkasida: npm run db:deploy"
        );
        return;
      }
      if (code === "ValidationError" && d?.details != null) {
        const flat = getZodFlattenFromApiErrorBody(d);
        if (flat) {
          const hint = firstValidationUserHint(flat);
          setLocalError(
            hint
              ? withApiSupportLine(`Server tekshiruvi: ${hint}`, e)
              : withApiSupportLine(getUserFacingError(e, "Server tekshiruvi xatosi."), e)
          );
        } else {
          setLocalError(
            `Server tekshiruvi: ${typeof d.details === "string" ? d.details : JSON.stringify(d.details)}`
          );
        }
        return;
      }
      if (code === "BadQty") {
        setLocalError("Miqdor noto‘g‘ri (musbat son bo‘lsin).");
        return;
      }
      if (code === "BadWarehouse") {
        setLocalError("Tanlangan ombor topilmadi.");
        return;
      }
      if (code === "BadAgent") {
        setLocalError("Tanlangan agent topilmadi yoki faol emas.");
        return;
      }
      if (code === "OrderRequiresAgent") {
        setLocalError("Savdo zakazi uchun agent majburiy.");
        return;
      }
      if (code === "OrderRequiresWarehouse") {
        setLocalError("Savdo zakazi uchun ombor majburiy.");
        return;
      }
      if (code === "OrderRequiresPaymentMethod") {
        setLocalError("To‘lov usuli majburiy.");
        return;
      }
      if (code === "NoRetailPrice" || code === "NoPrice") {
        const id = ax.response?.data?.product_id as number | undefined;
        const pt = (ax.response?.data as { price_type?: string } | undefined)?.price_type ?? "retail";
        setLocalError(
          id != null
            ? `Mahsulot #${id} uchun «${pt}» narxi yo‘q.`
            : `Narx yo‘q («${pt}»).`
        );
        return;
      }
      if (code === "InsufficientStock") {
        const d = ax.response?.data as { product_id?: number; available?: string; requested?: string };
        setLocalError(
          d?.product_id != null
            ? `Mahsulot #${d.product_id}: omborda yetarli emas (mavjud ${d.available ?? "—"}, kerak ${d.requested ?? "—"}).`
            : "Omborda yetarli mahsulot yo‘q."
        );
        return;
      }
      if (code === "BadExpeditor") {
        setLocalError("Tanlangan ekspeditor topilmadi yoki faol emas.");
        return;
      }
      if (code === "BadClient") {
        setLocalError("Klient topilmadi yoki faol emas.");
        return;
      }
      if (code === "BadProduct") {
        setLocalError("Mahsulot topilmadi yoki faol emas.");
        return;
      }
      if (code === "ReturnNotInterchangeable") {
        const id = ax.response?.data?.product_id as number | undefined;
        const msg = ax.response?.data?.message;
        const text =
          id != null
            ? `Mahsulot #${id}: faol interchangeable guruhda emas yoki tanlangan narx turi (${priceType.trim() || "retail"}) mos emas.`
            : typeof msg === "string" && msg.trim()
              ? msg
              : "Qaytarish uchun mahsulot interchangeable guruhda emas yoki narx turi mos emas.";
        setLocalError(withApiSupportLine(text, e));
        return;
      }
      if (code === "BadOrder") {
        setLocalError("Zakaz topilmadi yoki qaytarish uchun mos emas.");
        return;
      }
      if (code === "BadOrderClient") {
        setLocalError("Zakaz bu mijozga tegishli emas yoki topilmadi.");
        return;
      }
      if (code === "TooManyItems") {
        const m = (d as { max?: number } | undefined)?.max;
        setLocalError(
          m != null ? `Juda ko‘p qator: server limiti ${m} ta.` : "Juda ko‘p qator (server limiti)."
        );
        return;
      }
      if (code === "QtyExceedsOrdered") {
        setLocalError("Qaytarish miqdori sotilgan / buyurtma miqdoridan oshmasin.");
        return;
      }
      if (code === "BonusCashExceeds") {
        setLocalError(
          "Bonus o‘rniga qaytariladigan naqd summa qolgan bonus qiymatidan oshmasin (dona + summa birgalikda hisoblanadi)."
        );
        return;
      }
      if (code === "DatabaseValidationError" && d?.message) {
        setLocalError(withApiSupportLine(String(d.message).slice(0, 500), e));
        return;
      }
      if (code === "NothingToReturn") {
        setLocalError("Qaytarish uchun mos pozitsiya yo‘q yoki limit tugagan.");
        return;
      }
      if (code === "DuplicateProduct") {
        setLocalError("Bir xil mahsulotni bir nechta qatorga qo‘shib bo‘lmaydi.");
        return;
      }
      if (code === "CreditLimitExceeded" && d) {
        setLocalError(
          `Kredit limiti yetmaydi. Limit: ${d.credit_limit ?? "—"}, ochiq zakazlar yig‘indisi: ${d.outstanding ?? "—"}, bu zakaz: ${d.order_total ?? "—"}.`
        );
        return;
      }
      if (code === "ConsignmentRequiresAgent") {
        setLocalError("Konsignatsiya zakazi uchun agentni tanlang.");
        return;
      }
      if (code === "ConsignmentAgentDisabled") {
        setLocalError("Bu agent uchun konsignatsiya yoqilmagan (Пользователи → Консигнация).");
        return;
      }
      if (code === "ConsignmentLimitExceeded" && d) {
        setLocalError(
          `Konsignatsiya limiti yetmaydi. Limit: ${(d as { consignment_limit?: string }).consignment_limit ?? "—"}, ochiq qarz: ${(d as { outstanding?: string }).outstanding ?? "—"}, bu zakaz: ${(d as { order_total?: string }).order_total ?? "—"}.`
        );
        return;
      }
      if (code === "BadConsignmentDueDate") {
        setLocalError("Konsignatsiya muddatini tekshiring (YYYY-MM-DD yoki to‘liq sana).");
        return;
      }
      if (ax.response?.status === 403) {
        setLocalError("Zakaz yaratish huquqi yo‘q (faqat admin / operator).");
        return;
      }
      setLocalError(getUserFacingError(e, "Xato"));
    }
  });

  const canShowPolkiGrid =
    isPolkiSheet &&
    hasClient &&
    (isPolkiFree || (isPolkiByOrder && polkiOrderIds.length > 0));

  const canUseCategoryChips = isPolkiSheet ? canPickProducts || canShowPolkiGrid : canShowOrderCatalog;

  const stockReadyForLines = isPolkiSheet
    ? !polkiContextQ.isLoading && !polkiContextQ.isError
    : !canShowOrderCatalog || (!stockQ.isLoading && !stockQ.isError);

  const canSubmit = isPolkiSheet
    ? Boolean(
        hasClient &&
          hasWarehouse &&
          polkiContextQ.isSuccess &&
          polkiSelectedLinesCount > 0 &&
          (polkiTotalReturnQtySum > 0 || polkiTotalBonusCashSum > 0) &&
          polkiTotalReturnQtySum <= MAX_POLKI_RETURN_QTY &&
          !hasPolkiQtyOverMax &&
          !hasPolkiBonusCashOverMax &&
          !mutation.isPending &&
          stockReadyForLines &&
          (isPolkiFree || (isPolkiByOrder && polkiOrderIds.length > 0))
      )
    : isExchangeFlow
      ? Boolean(
          hasClient &&
            hasWarehouse &&
            Boolean(agentId.trim()) &&
            exchangeReturnsQ.isSuccess &&
            exchangePayloadCheck.ok &&
            !mutation.isPending &&
            !loadingLists
        )
      : Boolean(
          hasClient &&
            hasWarehouse &&
            selectedItemsCount > 0 &&
            !mutation.isPending &&
            !loadingLists &&
            stockReadyForLines &&
            !hasQtyOverStock &&
            !hasMissingPriceForSelected &&
            (!requiresAgentAndPayment || Boolean(agentId.trim())) &&
            (!requiresPaymentMethodForSubmit || Boolean(paymentMethodRef.trim()))
        );

  /** Nega «Возврат» o‘chiq — foydalanuvchiga aniq sabab (rus.). */
  const polkiSubmitBlockedReason = useMemo((): string | null => {
    if (!isPolkiSheet || mutation.isPending) return null;
    if (!hasClient) return "Выберите клиента.";
    if (isPolkiByOrder && polkiOrderIds.length === 0) {
      return "В блоке «Заказы» отметьте хотя бы один доставленный заказ.";
    }
    if (!hasWarehouse) return "Выберите склад возврата (блок «Параметры возврата»).";
    if (polkiContextQ.isLoading) return "Загрузка состава возврата…";
    if (polkiContextQ.isError) {
      return "Не удалось загрузить состав. Проверьте клиента, заказы и сеть.";
    }
    if (!polkiContextQ.isSuccess) return "Ожидание данных для возврата…";
    if (polkiSelectedLinesCount === 0) {
      return "В «Состав заявки» введите количество к возврату или сумму компенсации бонуса хотя бы в одной строке.";
    }
    if (polkiTotalReturnQtySum <= 0 && polkiTotalBonusCashSum <= 0) {
      return "Суммарно к возврату 0: укажите шт в колонке «всего к возврату» и/или сумму в блоке бонуса.";
    }
    if (polkiTotalReturnQtySum > MAX_POLKI_RETURN_QTY) {
      return `Превышен лимит документа: не более ${MAX_POLKI_RETURN_QTY} шт на склад за раз (сейчас ${polkiTotalReturnQtySum}). Уменьшите количество или оформите несколько возвратов.`;
    }
    if (hasPolkiQtyOverMax) {
      return "В строке введено больше, чем разрешено («макс. всего» к возврату).";
    }
    if (hasPolkiBonusCashOverMax) {
      return "Сумма компенсации бонуса превышает допустимое значение для строки.";
    }
    if (!stockReadyForLines) return "Данные ещё не готовы…";
    return null;
  }, [
    isPolkiSheet,
    mutation.isPending,
    hasClient,
    isPolkiByOrder,
    polkiOrderIds.length,
    hasWarehouse,
    polkiContextQ.isLoading,
    polkiContextQ.isError,
    polkiContextQ.isSuccess,
    polkiSelectedLinesCount,
    polkiTotalReturnQtySum,
    polkiTotalBonusCashSum,
    hasPolkiQtyOverMax,
    hasPolkiBonusCashOverMax,
    stockReadyForLines
  ]);

  useEffect(() => {
    if (!hasClient) {
      setWarehouseId("");
      setAgentId("");
      setExpeditorUserId("");
      setPaymentMethodRef("");
    }
  }, [hasClient]);

  useEffect(() => {
    if (isPolkiSheet || isExchangeFlow) return;
    setSelectedCategoryIds([]);
    setActiveCatalogCategoryId(null);
  }, [selectedAgentIdNum, isPolkiSheet, isExchangeFlow]);

  useEffect(() => {
    setLocalError(null);
  }, [
    clientId,
    warehouseId,
    agentId,
    applyBonus,
    selectedCategoryIds,
    activeCatalogCategoryId,
    productSearch,
    qtyByProductId,
    expeditorUserId,
    priceType,
    orderComment,
    requestTypeRef,
    orderNotePreset,
    polkiHeaderDate,
    polkiTradeDirection,
    polkiSkidkaType,
    refusalReasonRefPolki,
    polkiOrderIdsSortedKey,
    paymentMethodRef
  ]);

  return {
    tenantSlug,
    onCreated,
    onCancel,
    orderType,
    ORDER_CREATE_DEBUG,
    activeCatalogCategoryId,
    agentCatalogReady,
    agentFilterOptions,
    agentId,
    agentUserIdSet,
    agentUsers,
    applyBonus,
    blockByProductId,
    canPickPricingAndExpeditor,
    canPickProducts,
    canPickWarehouse,
    canShowOrderCatalog,
    canShowPolkiGrid,
    canSubmit,
    canUseCategoryChips,
    catalogProducts,
    catalogTabMode,
    categories,
    categoriesWithWarehouseSellableStock,
    categoryFilterActive,
    categoryFilterSet,
    categoryIdsWithPositiveStock,
    clientAssignmentsForLock,
    clientId,
    clientIdNum,
    clientSummaryQ,
    clients,
    consignmentDueAnchorRef,
    consignmentDueDate,
    consignmentDueOpen,
    createCtxQ,
    ctxProfile,
    debugOrderCreate,
    displayProductGroups,
    displayProducts,
    eligibleClientById,
    eligibleClientIdSet,
    eligibleClients,
    estimatedSum,
    exMinusKey,
    exMinusQty,
    exPlusProductId,
    exPlusQty,
    exchangeOrderIdsSortedKey,
    exchangePairRows,
    exchangePayloadCheck,
    exchangeReturnsQ,
    exchangeSourceOrderIds,
    expeditorFilterOptions,
    expeditorUserId,
    filteredExpeditors,
    hasAgentSelected,
    hasClient,
    hasMissingPriceForSelected,
    hasPolkiBonusCashOverMax,
    hasPolkiQtyOverMax,
    hasQtyOverStock,
    hasWarehouse,
    isExchangeFlow,
    isPolkiByOrder,
    isPolkiFree,
    isPolkiSheet,
    lineProblemCountByCategoryId,
    loadingLists,
    localError,
    missingPriceProductNames,
    mutation,
    normalizedType,
    orderClientPickerScopeIds,
    orderComment,
    orderIsConsignment,
    orderNoteOptions,
    orderNotePreset,
    orderOpenedAt,
    paymentMethodRef,
    paymentMethodSelectOptions,
    polkiBonusCash,
    polkiBonusToBalance,
    polkiContextQ,
    polkiDateFrom,
    polkiDateTo,
    polkiDebtHintSum,
    polkiDisplayRows,
    polkiEstimatedSum,
    polkiHeaderDate,
    polkiLineKeySet,
    polkiOrderDateById,
    polkiOrderGroups,
    polkiOrderIdSet,
    polkiOrderIds,
    polkiOrderIdsSortedKey,
    polkiOrderPickHalfLists,
    polkiOrdersForPick,
    polkiOrdersPickQ,
    polkiOrdersPickRawCount,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    polkiRowsAll,
    polkiRowsFiltered,
    polkiSelectedClientLabel,
    polkiSelectedLinesCount,
    polkiSkidkaType,
    polkiSubmitBlockedReason,
    polkiTotalBonusCashSum,
    polkiTotalQty,
    polkiTotalReturnQtySum,
    polkiTradeDirection,
    polkiVolumeM3,
    priceType,
    productSearch,
    productSearchNorm,
    products,
    qc,
    qtyByProductId,
    refSelectKey,
    refusalReasonPolkiOptions,
    refusalReasonRefPolki,
    requestTypeOptions,
    requestTypeRef,
    requiresAgentAndPayment,
    requiresAgentForProductCatalog,
    requiresPaymentMethodForSubmit,
    resetFlowAfterClientChange,
    selectedAgentIdNum,
    selectedCategoryIds,
    selectedClientExpeditorIdSet,
    selectedClientExpeditorIds,
    selectedClientIdNum,
    selectedClientRow,
    selectedExpeditorIdNum,
    selectedItemsCount,
    selectedTotalQty,
    selectedWarehouseIdNum,
    selectionNotice,
    setActiveCatalogCategoryId,
    setAgentId,
    setApplyBonus,
    setBlockByProductId,
    setClientId,
    setConsignmentDueDate,
    setConsignmentDueOpen,
    setExMinusKey,
    setExMinusQty,
    setExPlusProductId,
    setExPlusQty,
    setExchangeSourceOrderIds,
    setExpeditorUserId,
    setLocalError,
    setOrderComment,
    setOrderIsConsignment,
    setOrderNotePreset,
    setPaymentMethodRef,
    setPolkiBonusCash,
    setPolkiBonusToBalance,
    setPolkiDateFrom,
    setPolkiDateTo,
    setPolkiHeaderDate,
    setPolkiOrderIds,
    setPolkiRangeOpen,
    setPolkiSkidkaType,
    setPolkiTotalQty,
    setPolkiTradeDirection,
    setPriceType,
    setProductSearch,
    setQtyByProductId,
    setRefSelectKey,
    setRefusalReasonRefPolki,
    setRequestTypeRef,
    setSelectedCategoryIds,
    setSelectionNotice,
    setWarehouseId,
    showOrderPaymentMethodSelector,
    stockByProduct,
    stockProductIdsKey,
    stockQ,
    stockReadyForLines,
    tableProductGroups,
    tenantShowPaymentMethodSelector,
    togglePolkiOrderPick,
    togglePolkiOrdersSelectAll,
    totalVolumeM3,
    uiPrefsQ,
    useSplitOrderCatalog,
    userShowPaymentMethodSelector,
    users,
    warehouseId,
    warehouseIdSet,
    warehouses,
  } as const;
}

export type OrderCreateVm = ReturnType<typeof useOrderCreate>;
