"use client";

/** Create-context / edit / stock / exchange-returns / client / ui-prefs (ADR-008 M1.4). */
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import type { ClientRow } from "@/lib/client-types";
import type { ProductRow } from "@/lib/product-types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { STALE } from "@/lib/query-stale";
import { resolveLockedOrderAgentId } from "../order-edit-header";
import { resolvePriceTypeFromOrder } from "../view/polki-shelf-return/polki-apply-order-defaults";
import type { PolkiPriceTypeEntryRef } from "../view/polki-shelf-return/polki-price-type-options";
import { salePriceTypeOptionsFromProfile } from "../view/polki-shelf-return/polki-price-type-options";
import { formatQtyState } from "../utils";
import { hydrateApplyBonusForNewOrderEdit } from "../order-edit-bonus-confirm.logic";
import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import type { OrderCreateContextResponse, OrderCreateErrorTarget } from "./draft.types";

const EMPTY_CREATE_PRODUCTS: ProductRow[] = [];

export type UseOrderCreateDraftDataArgs = {
  tenantSlug: string | null | undefined;
  isEditMode: boolean;
  editOrderId: number | null;
  isExchangeFlow: boolean;
  requiresAgentForProductCatalog: boolean;
  hasAgentSelected: boolean;
  agentCatalogReady: boolean;
  selectedClientIdNum: number;
  selectedAgentIdNum: number;
  selectedWarehouseIdNum: number;
  selectedExpeditorIdNum: number;
  clientId: string;
  warehouseId: string;
  agentId: string;
  expeditorUserId: string;
  paymentMethodRef: string;
  clientIdNum: number;
  exchangeSourceOrderIds: number[];
  exchangeOrderIdsSortedKey: string;
  editHydratedOrderId: number | null;
  setEditHydratedOrderId: React.Dispatch<React.SetStateAction<number | null>>;
  skipNextWarehouseQtyClearRef: React.MutableRefObject<boolean>;
  setEditOrderNumber: (v: string | null) => void;
  setClientId: (v: string) => void;
  setAgentId: (v: string) => void;
  setWarehouseId: (v: string) => void;
  setEditSourceWarehouseId: (v: number | null) => void;
  setPaymentMethodRef: (v: string) => void;
  setExpeditorUserId: (v: string) => void;
  setApplyBonus: (v: boolean) => void;
  setApplyDiscount: (v: boolean) => void;
  setOrderIsConsignment: (v: boolean) => void;
  setConsignmentDueDate: (v: string) => void;
  setRequestTypeRef: (v: string) => void;
  setOrderComment: (v: string) => void;
  setQtyByProductId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setBlockByProductId: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setEditReservedQtyByProduct: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setSelectionNotice: (v: string | null) => void;
  setLocalError: (v: string | null) => void;
  setPriceType: (v: string) => void;
  reportLocalError: (message: string, target?: OrderCreateErrorTarget) => void;
  debugOrderCreate: (event: string, payload?: Record<string, unknown>) => void;
};

export function useOrderCreateDraftData(args: UseOrderCreateDraftDataArgs) {
  const {
    tenantSlug, isEditMode, editOrderId, isExchangeFlow,
    requiresAgentForProductCatalog, hasAgentSelected, agentCatalogReady,
    selectedClientIdNum, selectedAgentIdNum, selectedWarehouseIdNum, selectedExpeditorIdNum,
    clientId, warehouseId, agentId, expeditorUserId, paymentMethodRef, clientIdNum,
    exchangeSourceOrderIds, exchangeOrderIdsSortedKey, editHydratedOrderId,
    setEditHydratedOrderId, skipNextWarehouseQtyClearRef, setEditOrderNumber,
    setClientId, setAgentId, setWarehouseId, setEditSourceWarehouseId, setPaymentMethodRef,
    setExpeditorUserId, setApplyBonus, setApplyDiscount, setOrderIsConsignment,
    setConsignmentDueDate, setRequestTypeRef, setOrderComment, setQtyByProductId,
    setBlockByProductId, setEditReservedQtyByProduct, setSelectionNotice, setLocalError,
    setPriceType, reportLocalError, debugOrderCreate
  } = args;

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

  const editOrderQ = useQuery({
    queryKey: ["order", tenantSlug, editOrderId, "edit-form"],
    enabled: Boolean(tenantSlug) && isEditMode && editOrderId != null,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${editOrderId}`);
      return data;
    }
  });

  useEffect(() => {
    if (!isEditMode) {
      if (editHydratedOrderId != null) setEditHydratedOrderId(null);
      return;
    }
    if (editOrderQ.isError) {
      const msg = getUserFacingError(editOrderQ.error, "Не удалось загрузить заказ.");
      reportLocalError(msg, null);
      return;
    }
    const row = editOrderQ.data;
    if (!row) return;
    if (row.status !== "new") {
      if (editHydratedOrderId !== row.id) setEditHydratedOrderId(row.id);
      reportLocalError("Редактировать можно только заказы в статусе «Новый».", null);
      return;
    }
    if (editHydratedOrderId === row.id) return;

    skipNextWarehouseQtyClearRef.current = true;
    setEditOrderNumber(row.number?.trim() || `#${row.id}`);
    setClientId(String(row.client_id));
    setAgentId(resolveLockedOrderAgentId(row, []));
    setWarehouseId(row.warehouse_id != null && row.warehouse_id > 0 ? String(row.warehouse_id) : "");
    setEditSourceWarehouseId(
      row.warehouse_id != null && row.warehouse_id > 0 ? row.warehouse_id : null
    );
    setPaymentMethodRef((row.payment_method_ref ?? "").trim());
    setExpeditorUserId(
      row.expeditor_id != null && row.expeditor_id > 0 ? String(row.expeditor_id) : "__none__"
    );
    setApplyBonus(hydrateApplyBonusForNewOrderEdit());
    setApplyDiscount(true);
    setOrderIsConsignment(Boolean(row.is_consignment));
    setConsignmentDueDate((row.consignment_due_date ?? "").trim().slice(0, 10));
    setRequestTypeRef((row.request_type_ref ?? "").trim());
    setOrderComment((row.comment ?? "").trim());
    const qtyMap: Record<number, string> = {};
    const reserved: Record<number, number> = {};
    for (const it of row.items ?? []) {
      if (it.is_bonus) continue;
      const q = Number.parseFloat(String(it.qty).replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      qtyMap[it.product_id] = formatQtyState(q);
      reserved[it.product_id] = (reserved[it.product_id] ?? 0) + q;
    }
    setQtyByProductId(qtyMap);
    setBlockByProductId({});
    setEditReservedQtyByProduct(reserved);
    setSelectionNotice(null);
    setLocalError(null);
    setEditHydratedOrderId(row.id);
  }, [isEditMode, editOrderQ.data, editOrderQ.isError, editOrderQ.error, editHydratedOrderId, reportLocalError]);

  /** Qulflangan header maydonlari boshqa effektlar (klient bo‘sh) tomonidan o‘chirilsa — qayta tiklash. */
  useEffect(() => {
    if (!isEditMode || !editOrderQ.data) return;
    const row = editOrderQ.data;
    if (editHydratedOrderId !== row.id) return;
    if (!clientId.trim() && row.client_id > 0) setClientId(String(row.client_id));
    if (!agentId.trim()) {
      const resolved = resolveLockedOrderAgentId(row, []);
      if (resolved) setAgentId(resolved);
    }
    if (!warehouseId.trim() && row.warehouse_id != null && row.warehouse_id > 0) {
      setWarehouseId(String(row.warehouse_id));
    }
    if (
      !expeditorUserId.trim() &&
      row.expeditor_id != null &&
      row.expeditor_id > 0
    ) {
      setExpeditorUserId(String(row.expeditor_id));
    }
    if (!paymentMethodRef.trim() && (row.payment_method_ref ?? "").trim()) {
      setPaymentMethodRef((row.payment_method_ref ?? "").trim());
    }
  }, [
    isEditMode,
    editOrderQ.data,
    editHydratedOrderId,
    clientId,
    agentId,
    warehouseId,
    expeditorUserId,
    paymentMethodRef
  ]);

  const editPriceTypeSyncedForOrderId = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      editPriceTypeSyncedForOrderId.current = null;
      return;
    }
    if (!editOrderQ.data || !createCtxQ.data) return;
    const orderId = editOrderQ.data.id;
    if (editPriceTypeSyncedForOrderId.current === orderId) return;
    const fallback = createCtxQ.data.price_types ?? [];
    const entries = (createCtxQ.data.settings_profile?.references?.price_type_entries ??
      []) as PolkiPriceTypeEntryRef[];
    const options = salePriceTypeOptionsFromProfile(entries, fallback);
    if (options.length === 0) return;
    const resolved = resolvePriceTypeFromOrder(editOrderQ.data, options, entries);
    if (resolved) setPriceType(resolved);
    editPriceTypeSyncedForOrderId.current = orderId;
  }, [isEditMode, editOrderQ.data, createCtxQ.data]);

  /** Agent tanlanganda katalog `create-context` javobida ham bor — alohida `create-catalog` chaqirilmasin (2× DB + 2× tarmoq). */
  const useSplitOrderCatalog = requiresAgentForProductCatalog && hasAgentSelected;

  const stockProductIdsKey = useMemo(() => {
    const src = agentCatalogReady
      ? (createCtxQ.data?.products ?? EMPTY_CREATE_PRODUCTS)
      : EMPTY_CREATE_PRODUCTS;
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

  return {
    createCtxQ,
    editOrderQ,
    stockQ,
    stockProductIdsKey,
    useSplitOrderCatalog,
    exchangeReturnsQ,
    clientSummaryQ,
    uiPrefsQ,
    EMPTY_CREATE_PRODUCTS
  };
}
