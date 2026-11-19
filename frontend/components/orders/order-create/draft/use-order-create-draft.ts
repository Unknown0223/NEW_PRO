"use client";

import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import type { ClientRow } from "@/lib/client-types";
import type { ProductRow } from "@/lib/product-types";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STALE } from "@/lib/query-stale";
import {
  orderAgentFilterOption,
  orderClientPickerDisplayName,
  orderExpeditorFilterOption
} from "@/lib/order-picker-labels";
import {
  activeRefSelectOptions,
} from "@/lib/profile-ref-entries";
import {
  buildExchangeCreateBody,
  buildExchangePairRows
} from "@/components/orders/exchange-order-create-panel";
import type { OrderCreateProps } from "../types";
import { matchPaymentMethodSelectId, paymentMethodIdForPriceType, resolvePriceTypeFromOrder } from "../view/polki-shelf-return/polki-apply-order-defaults";
import { countPositiveQtyEntries, resolveLockedOrderAgentId } from "../order-edit-header";
import type { PolkiPriceTypeEntryRef } from "../view/polki-shelf-return/polki-price-type-options";
import { salePriceTypeOptionsFromProfile } from "../view/polki-shelf-return/polki-price-type-options";
import { useOldPrices } from "../hooks/use-old-prices";
import { buildPriceTypeLabelMap } from "@/lib/price-type-label";
import { defaultDatetimeLocalValue } from "@/lib/order-status-datetime";
import { localValueToDatetimeInput } from "@/components/ui/datetime-popover";
import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import {
  parsePriceAmount,
  availableOrderQty,
  currentMonthEndIsoDate,
  formatQtyState,
  unitPriceForType
} from "../utils";
import { hydrateApplyBonusForNewOrderEdit } from "../order-edit-bonus-confirm.logic";
import {
  buildOrdinaryItems,
  canSubmitExchangeBase,
  canSubmitOrdinaryBase
} from "./draft.logic";
import { runOrdinaryOrEditSubmit } from "./draft.submit-ordinary";
import { runExchangeSubmit } from "./draft.submit-exchange";
import { useOrderCreateDraftCatalog } from "./use-order-create-draft-catalog";
import { useOrderCreateDraftData } from "./use-order-create-draft-data";

export function useOrderCreateDraft({
  tenantSlug,
  onCreated,
  onCancel,
  orderType,
  editOrderId: editOrderIdProp,
  onClientInvalidExtra
}: OrderCreateProps & { onClientInvalidExtra?: () => void }) {
  const searchParams = useSearchParams();
  const normalizedType = (orderType ?? "order").trim();
  const isExchangeFlow = normalizedType === "exchange";
  const isPolkiFree = normalizedType === "return";
  const isPolkiByOrder = normalizedType === "return_by_order";
  const isPolkiSheet = isPolkiFree || isPolkiByOrder;
  /** Oddiy zakaz: katalog va kategoriyalar faqat agent tanlangandan keyin (API `selected_agent_id`). */
  const requiresAgentForProductCatalog = !isPolkiSheet && !isExchangeFlow;

  const editOrderIdFromUrl = useMemo(() => {
    const raw = searchParams.get("edit_order_id")?.trim() ?? "";
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);
  const editOrderId =
    editOrderIdProp != null && editOrderIdProp > 0 ? editOrderIdProp : editOrderIdFromUrl;
  const isEditMode = editOrderId != null && !isPolkiSheet && !isExchangeFlow;
  const [editHydratedOrderId, setEditHydratedOrderId] = useState<number | null>(null);
  const skipNextWarehouseQtyClearRef = useRef(false);
  /** Tahrirdagi eski rezerv — qoldiq tekshiruviga qo‘shiladi (ombor o‘zgarmaganda). */
  const [editReservedQtyByProduct, setEditReservedQtyByProduct] = useState<Record<number, number>>(
    {}
  );
  const [editSourceWarehouseId, setEditSourceWarehouseId] = useState<number | null>(null);
  const [editOrderNumber, setEditOrderNumber] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [applyBonus, setApplyBonus] = useState(true);
  const [applyDiscount, setApplyDiscount] = useState(true);
  /** Bo‘sh = barcha kategoriyalar; bo‘sh emas = faqat tanlangan id lar */
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  /** Pastdagi katalog tablari: faqat `selectedCategoryIds` bo‘sh emas; jadval faqat shu kategoriya mahsulotlari */
  const [activeCatalogCategoryId, setActiveCatalogCategoryId] = useState<number | null>(null);
  const [qtyByProductId, setQtyByProductId] = useState<Record<number, string>>({});
  /** Mahsulot qadoqlari (bloklar); kartotekada qty_per_block bo‘lsa Miqdor = blok × dona/blok */
  const [blockByProductId, setBlockByProductId] = useState<Record<number, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<
    | "client"
    | "warehouse"
    | "agent"
    | "payment"
    | "price"
    | "catalog"
    | "polki-orders"
    | "polki-lines"
    | null
  >(null);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const [expeditorUserId, setExpeditorUserId] = useState("");
  const [priceType, setPriceType] = useState("retail");
  const [orderComment, setOrderComment] = useState("");

  const reportLocalError = useCallback(
    (
      message: string,
      target:
        | "client"
        | "warehouse"
        | "agent"
        | "payment"
        | "price"
        | "catalog"
        | "polki-orders"
        | "polki-lines"
        | null = null
    ) => {
      setLocalError(message);
      setErrorTarget(target);
      if (typeof document === "undefined") return;
      requestAnimationFrame(() => {
        const sel = target ? `[data-oc-error="${target}"]` : '[role="alert"]';
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable = el.querySelector<HTMLElement>(
            "input:not([type=hidden]), select, textarea, button"
          );
          focusable?.focus?.({ preventScroll: true });
        }
      });
    },
    []
  );
  const [requestTypeRef, setRequestTypeRef] = useState("");
  const [orderNotePreset, setOrderNotePreset] = useState("");
  const [refSelectKey, setRefSelectKey] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [orderCreatedAtLocal, setOrderCreatedAtLocal] = useState(() => defaultDatetimeLocalValue());

  const deepLinkClientId = useMemo(() => {
    const raw = searchParams.get("client_id")?.trim() ?? "";
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const deepLinkSourceOrderId = useMemo(() => {
    const raw = searchParams.get("source_order_id")?.trim() ?? "";
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);
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

  useEffect(() => {
    /** Tahrirda ombor qulflangan — miqdorlarni ombor effektida o‘chirmaymiz. */
    if (isEditMode) return;
    if (skipNextWarehouseQtyClearRef.current) {
      skipNextWarehouseQtyClearRef.current = false;
      return;
    }
    setQtyByProductId({});
    setBlockByProductId({});
  }, [warehouseId, isEditMode]);


  useEffect(() => {
    if (!orderIsConsignment) {
      setConsignmentDueOpen(false);
      return;
    }
    if (!consignmentDueDate.trim()) {
      setConsignmentDueDate(currentMonthEndIsoDate());
    }
  }, [orderIsConsignment, consignmentDueDate]);

  const clientIdNum = selectedClientIdNum;
  const exchangeOrderIdsSortedKey = useMemo(
    () => [...exchangeSourceOrderIds].sort((a, b) => a - b).join(","),
    [exchangeSourceOrderIds]
  );

  const {
    createCtxQ,
    editOrderQ,
    stockQ,
    stockProductIdsKey,
    useSplitOrderCatalog,
    exchangeReturnsQ,
    clientSummaryQ,
    uiPrefsQ,
    EMPTY_CREATE_PRODUCTS
  } = useOrderCreateDraftData({
    tenantSlug,
    isEditMode,
    editOrderId,
    isExchangeFlow,
    requiresAgentForProductCatalog,
    hasAgentSelected,
    agentCatalogReady,
    selectedClientIdNum,
    selectedAgentIdNum,
    selectedWarehouseIdNum,
    selectedExpeditorIdNum,
    clientId,
    warehouseId,
    agentId,
    expeditorUserId,
    paymentMethodRef,
    clientIdNum,
    exchangeSourceOrderIds,
    exchangeOrderIdsSortedKey,
    editHydratedOrderId,
    setEditHydratedOrderId,
    skipNextWarehouseQtyClearRef,
    setEditOrderNumber,
    setClientId,
    setAgentId,
    setWarehouseId,
    setEditSourceWarehouseId,
    setPaymentMethodRef,
    setExpeditorUserId,
    setApplyBonus,
    setApplyDiscount,
    setOrderIsConsignment,
    setConsignmentDueDate,
    setRequestTypeRef,
    setOrderComment,
    setQtyByProductId,
    setBlockByProductId,
    setEditReservedQtyByProduct,
    setSelectionNotice,
    setLocalError,
    setPriceType,
    reportLocalError,
    debugOrderCreate
  });

  const ctxProfile = createCtxQ.data?.settings_profile;
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
    const injectStored = (
      out: { id: string; name: string }[],
      entries: Array<{ id?: string; name?: string; code?: string | null }> | undefined
    ) => {
      if (!isEditMode || !editOrderQ.data) return out;
      const stored = (editOrderQ.data.payment_method_ref ?? "").trim();
      const label = (editOrderQ.data.payment_method_label ?? "").trim();
      const mapped = matchPaymentMethodSelectId(stored, out, entries ?? []);
      if (stored && !mapped && !out.some((e) => e.id === stored)) {
        out.unshift({ id: stored, name: label || stored });
      }
      return out;
    };
    const raw = ctxProfile?.references?.payment_method_entries;
    if (!Array.isArray(raw) || raw.length === 0) {
      const legacy = ctxProfile?.references?.payment_types;
      if (Array.isArray(legacy) && legacy.length > 0) {
        const uniq = Array.from(
          new Set(legacy.map((s) => String(s).trim()).filter(Boolean).map((s) => s.slice(0, 64)))
        );
        return injectStored(
          uniq.map((s) => ({ id: s, name: s })),
          []
        );
      }
      return injectStored(
        [
          { id: "naqd", name: "Наличные" },
          { id: "terminal", name: "Терминал" },
          { id: "perechisleniye", name: "Перечисление" }
        ],
        []
      );
    }
    const out: { id: string; name: string }[] = [];
    for (const e of raw) {
      if (!e || typeof e !== "object") continue;
      const row = e as { id?: unknown; name?: unknown; active?: boolean; code?: string | null };
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
    return injectStored(out, raw);
  }, [ctxProfile, isEditMode, editOrderQ.data]);

  const applyPriceType = useCallback(
    (next: string) => {
      setPriceType(next);
      const entries = (createCtxQ.data?.settings_profile?.references?.price_type_entries ??
        []) as PolkiPriceTypeEntryRef[];
      const pmEntries = ctxProfile?.references?.payment_method_entries ?? [];
      const mapped = paymentMethodIdForPriceType(
        next,
        entries,
        paymentMethodSelectOptions,
        pmEntries
      );
      if (mapped) setPaymentMethodRef(mapped);
    },
    [
      createCtxQ.data?.settings_profile?.references?.price_type_entries,
      ctxProfile?.references?.payment_method_entries,
      paymentMethodSelectOptions
    ]
  );

  useEffect(() => {
    if (showOrderPaymentMethodSelector) return;
    if (isEditMode) return;
    if (!paymentMethodRef.trim()) return;
    setPaymentMethodRef("");
  }, [showOrderPaymentMethodSelector, paymentMethodRef, isEditMode]);

  useEffect(() => {
    if (!showOrderPaymentMethodSelector) return;
    if (!paymentMethodRef.trim()) return;
    const entries = ctxProfile?.references?.payment_method_entries ?? [];
    const mapped = matchPaymentMethodSelectId(paymentMethodRef, paymentMethodSelectOptions, entries);
    if (mapped) {
      if (mapped !== paymentMethodRef) setPaymentMethodRef(mapped);
      return;
    }
    if (isEditMode) return;
    setPaymentMethodRef("");
    setSelectionNotice("Выбор способа оплаты обновлён: неподходящее значение сброшено.");
  }, [
    showOrderPaymentMethodSelector,
    paymentMethodRef,
    paymentMethodSelectOptions,
    ctxProfile?.references?.payment_method_entries,
    isEditMode
  ]);

  useEffect(() => {
    if (!isEditMode) return;
    const entries = (createCtxQ.data?.settings_profile?.references?.price_type_entries ??
      []) as PolkiPriceTypeEntryRef[];
    const mapped = paymentMethodIdForPriceType(
      priceType,
      entries,
      paymentMethodSelectOptions,
      ctxProfile?.references?.payment_method_entries ?? []
    );
    if (!mapped) return;
    if (!paymentMethodRef.trim() && mapped !== paymentMethodRef) {
      setPaymentMethodRef(mapped);
    }
  }, [
    isEditMode,
    priceType,
    paymentMethodRef,
    paymentMethodSelectOptions,
    createCtxQ.data?.settings_profile?.references?.price_type_entries,
    ctxProfile?.references?.payment_method_entries
  ]);

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

  const clients = useMemo(() => createCtxQ.data?.clients ?? [], [createCtxQ.data?.clients]);
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
    if (isEditMode && editOrderQ.data?.client_id === id) {
      const name =
        editOrderQ.data.client_name?.trim() ||
        editOrderQ.data.client_legal_name?.trim() ||
        null;
      if (name) return orderClientPickerDisplayName({ id, name });
    }
    if (clientSummaryQ.isFetching) return "Загрузка…";
    const d = clientSummaryQ.data;
    if (d?.name) {
      return orderClientPickerDisplayName({ id, name: d.name });
    }
    return `Клиент #${id}`;
  }, [
    clientId,
    eligibleClientById,
    clientSummaryQ.data,
    clientSummaryQ.isFetching,
    isEditMode,
    editOrderQ.data
  ]);
  const products = useMemo(
    () => (agentCatalogReady ? (createCtxQ.data?.products ?? EMPTY_CREATE_PRODUCTS) : EMPTY_CREATE_PRODUCTS),
    [agentCatalogReady, createCtxQ.data?.products]
  );
  const oldPricesPriceTypeLabels = useMemo(
    () =>
      buildPriceTypeLabelMap(
        createCtxQ.data?.settings_profile?.references?.price_type_entries ?? []
      ),
    [createCtxQ.data?.settings_profile?.references?.price_type_entries]
  );
  const oldPricesProductIds = useMemo(() => products.map((p) => p.id), [products]);
  const oldPrices = useOldPrices({
    tenantSlug,
    productIds: oldPricesProductIds,
    priceTypeLabels: oldPricesPriceTypeLabels,
    currentPriceType: priceType,
    orderComment,
    setPriceType: applyPriceType,
    setOrderComment,
    setLocalError
  });
  const {
    oldPriceByProductId,
    priceAsOf,
    oldPricesEnabled,
    clearOldPrices
  } = oldPrices;
  const warehouses = useMemo(() => {
    const base = createCtxQ.data?.warehouses ?? [];
    if (
      isEditMode &&
      editOrderQ.data?.warehouse_id != null &&
      editOrderQ.data.warehouse_id > 0 &&
      !base.some((w) => w.id === editOrderQ.data!.warehouse_id)
    ) {
      return [
        {
          id: editOrderQ.data.warehouse_id,
          name: editOrderQ.data.warehouse_name?.trim() || `Склад #${editOrderQ.data.warehouse_id}`
        },
        ...base
      ];
    }
    return base;
  }, [createCtxQ.data?.warehouses, isEditMode, editOrderQ.data]);
  const users = useMemo(() => createCtxQ.data?.users ?? [], [createCtxQ.data?.users]);
  const categories = useMemo(
    () => (agentCatalogReady ? (createCtxQ.data?.product_categories ?? []) : []),
    [agentCatalogReady, createCtxQ.data?.product_categories]
  );
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
    /** Tahrir: klient/agent qulflangan — eligibility reset qilmaymiz. */
    if (isEditMode) return;
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
      onClientInvalidExtra?.();
      setSelectionNotice(
        "Выбранная комбинация для клиента попала под ограничение: агента/склад/экспедитора нужно выбрать заново."
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
    createCtxQ.isPlaceholderData,
    isEditMode
  ]);

  const warehouseIdSet = useMemo(() => new Set(warehouses.map((w) => w.id)), [warehouses]);

  useEffect(() => {
    if (!createCtxQ.data) return;
    if (createCtxQ.isPlaceholderData) return;
    if (!warehouseId.trim()) return;
    /** Tahrir: ombor ro‘yxati agent/klient filter bilan bo‘sh bo‘lishi mumkin — prefill saqlansin. */
    if (isEditMode) return;
    const id = Number.parseInt(warehouseId.trim(), 10);
    if (!Number.isFinite(id) || id < 1 || !warehouseIdSet.has(id)) {
      debugOrderCreate("warehouse.reset.invalid", {
        warehouse_id: id,
        available_warehouse_ids: warehouses.map((w) => w.id)
      });
      setWarehouseId("");
      setQtyByProductId({});
      setBlockByProductId({});
      setSelectionNotice("Выбор склада обновлён: неподходящее значение сброшено.");
    }
  }, [
    warehouseId,
    warehouses,
    warehouseIdSet,
    debugOrderCreate,
    createCtxQ.data,
    createCtxQ.isPlaceholderData,
    isEditMode
  ]);

  useEffect(() => {
    if (!createCtxQ.data) return;
    if (createCtxQ.isPlaceholderData) return;
    if (!expeditorUserId.trim() || expeditorUserId.trim() === "__none__") return;
    if (isEditMode) return;
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
      setSelectionNotice("Выбор экспедитора обновлён: неподходящее значение сброшено.");
    }
  }, [
    expeditorUserId,
    createCtxQ.data,
    createCtxQ.data?.expeditors,
    selectedClientRow,
    selectedClientExpeditorIds,
    selectedClientExpeditorIdSet,
    debugOrderCreate,
    createCtxQ.isPlaceholderData,
    isEditMode
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
  const agentFilterOptions = useMemo(() => {
    const opts = agentUsers.map((u) =>
      orderAgentFilterOption({ id: u.id, name: u.name, login: u.login })
    );
    if (isEditMode && editOrderQ.data) {
      const aid =
        Number.parseInt(agentId.trim(), 10) ||
        (editOrderQ.data.agent_id != null && editOrderQ.data.agent_id > 0
          ? editOrderQ.data.agent_id
          : NaN);
      if (Number.isFinite(aid) && aid > 0 && !opts.some((o) => o.value === String(aid))) {
        const label =
          editOrderQ.data.agent_display?.trim() ||
          editOrderQ.data.agent_name?.trim() ||
          `Агент #${aid}`;
        opts.unshift({
          value: String(aid),
          label,
          searchText: label.toLowerCase()
        });
      }
    }
    return opts;
  }, [agentUsers, isEditMode, agentId, editOrderQ.data]);

  useEffect(() => {
    if (!isEditMode || !editOrderQ.data) return;
    if (agentId.trim()) return;
    const resolved = resolveLockedOrderAgentId(editOrderQ.data, agentUsers);
    if (resolved) setAgentId(resolved);
  }, [isEditMode, editOrderQ.data, agentUsers, agentId]);

  useEffect(() => {
    if (!createCtxQ.data) return;
    if (createCtxQ.isPlaceholderData) return;
    if (!agentId.trim()) return;
    if (isEditMode) return;
    const id = Number.parseInt(agentId.trim(), 10);
    if (!Number.isFinite(id) || id < 1 || !agentUserIdSet.has(id)) {
      debugOrderCreate("agent.reset.invalid", {
        agent_id: id,
        available_agent_ids: agentUsers.map((u) => u.id).slice(0, 50),
        available_agents_total: agentUsers.length
      });
      setAgentId("");
      setSelectionNotice("Выбор агента обновлён: неподходящее значение сброшено.");
    }
  }, [
    agentId,
    agentUsers,
    agentUserIdSet,
    createCtxQ.data,
    createCtxQ.isPlaceholderData,
    debugOrderCreate,
    isEditMode
  ]);

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
    if (isEditMode && expeditorUserId.trim() && expeditorUserId.trim() !== "__none__") {
      const eid = Number.parseInt(expeditorUserId.trim(), 10);
      if (Number.isFinite(eid) && eid > 0 && !rows.some((r) => r.value === String(eid))) {
        const label = editOrderQ.data?.expeditor_display?.trim() || `Экспедитор #${eid}`;
        rows.unshift({
          value: String(eid),
          label,
          searchText: label.toLowerCase()
        });
      }
    }
    return [{ value: "__none__", label: "Без экспедитора", searchText: "без экспедитора ekspeditorsiz" }, ...rows];
  }, [filteredExpeditors, isEditMode, expeditorUserId, editOrderQ.data]);

  useEffect(() => {
    if (createCtxQ.isPlaceholderData) return;
    if (isEditMode) return;
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
    setSelectionNotice("Агент выбран автоматически по карточке клиента.");
  }, [
    createCtxQ.isPlaceholderData,
    agentUsers,
    agentId,
    debugOrderCreate,
    selectedClientRow?.id,
    isEditMode
  ]);

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
  const catalog = useOrderCreateDraftCatalog({
    products,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    warehouseId,
    stockProductIdsKey,
    stockQ,
    editReservedQtyByProduct,
    qtyByProductId,
    priceType,
    oldPriceByProductId,
    productSearch,
    isEditMode,
    editSourceWarehouseId,
    selectedWarehouseIdNum
  });
  const {
    categoryFilterSet,
    categoryFilterActive,
    catalogProducts,
    categoryIdsWithPositiveStock,
    categoriesWithWarehouseSellableStock,
    lineProblemCountByCategoryId,
    productSearchNorm,
    displayProducts,
    displayProductGroups,
    catalogTabMode,
    tableProductGroups,
    hasQtyOverStock,
    hasMissingPriceForSelected,
    missingPriceProductNames,
    selectedItemsCount,
    selectedTotalQty,
    estimatedSum,
    totalVolumeM3,
    stockByProduct
  } = catalog;

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

  useEffect(() => {
    if (!isEditMode || !editOrderQ.data?.created_at) return;
    const d = new Date(editOrderQ.data.created_at);
    if (Number.isNaN(d.getTime())) return;
    setOrderCreatedAtLocal(localValueToDatetimeInput(d));
  }, [isEditMode, editOrderQ.data?.created_at]);

  const orderOpenedAt = useMemo(() => {
    const d = new Date(orderCreatedAtLocal);
    if (!Number.isNaN(d.getTime())) return d;
    return new Date();
  }, [orderCreatedAtLocal]);

  const lockedAgentLabel = useMemo(() => {
    const id = agentId.trim();
    const fromOpts = id ? agentFilterOptions.find((o) => o.value === id)?.label?.trim() : "";
    if (fromOpts) return fromOpts;
    return (
      editOrderQ.data?.agent_name?.trim() ||
      editOrderQ.data?.agent_display?.trim() ||
      ""
    );
  }, [agentId, agentFilterOptions, editOrderQ.data]);

  const lockedWarehouseLabel = useMemo(() => {
    const id = warehouseId.trim();
    const fromList = id ? warehouses.find((w) => String(w.id) === id)?.name?.trim() : "";
    if (fromList) return fromList;
    return editOrderQ.data?.warehouse_name?.trim() || "";
  }, [warehouseId, warehouses, editOrderQ.data]);

  const loadingLists =
    (createCtxQ.isPending && !createCtxQ.data) ||
    (isEditMode && editOrderQ.isLoading && !editOrderQ.data);

  const editFormBlocked =
    isEditMode &&
    (editOrderQ.isError || (editOrderQ.data != null && editOrderQ.data.status !== "new"));

  useEffect(() => {
    if (isEditMode) return;
    if (!hasClient) {
      setWarehouseId("");
      setAgentId("");
      setExpeditorUserId("");
      setPaymentMethodRef("");
    }
  }, [hasClient, isEditMode]);

  useEffect(() => {
    if (isPolkiSheet || isExchangeFlow) return;
    setSelectedCategoryIds([]);
    setActiveCatalogCategoryId(null);
  }, [selectedAgentIdNum, isPolkiSheet, isExchangeFlow]);

  useEffect(() => {
    setLocalError(null);
    setErrorTarget(null);
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
    paymentMethodRef
  ]);


  const buildOrdinarySubmit = useCallback(
    (bonusConfirm?: {
      bonus_gift_lines?: { bonus_rule_id: number; product_id: number; qty: number }[];
      bonus_strategy_selections?: { strategy_id: number; rule_ids: number[] }[];
    } | void) =>
      runOrdinaryOrEditSubmit({
        tenantSlug: tenantSlug!,
        clientId,
        warehouseId,
        agentId,
        expeditorUserId,
        priceType,
        orderComment,
        orderNotePreset,
        requestTypeRef,
        orderType,
        applyBonus,
        applyDiscount,
        paymentMethodRef,
        orderIsConsignment,
        consignmentDueDate,
        orderCreatedAtLocal,
        qtyByProductId,
        stockRows: stockQ.data,
        isEditMode,
        editOrderId,
        editSourceWarehouseId,
        editReservedQtyByProduct,
        editOrder: editOrderQ.data,
        createCtx: createCtxQ.data,
        ctxProfile,
        paymentMethodSelectOptions,
        requiresPaymentMethodForSubmit,
        showOrderPaymentMethodSelector,
        priceAsOf,
        oldPricesEnabled,
        bonusConfirm
      }),
    [
      tenantSlug, clientId, warehouseId, agentId, expeditorUserId, priceType, orderComment,
      orderNotePreset, requestTypeRef, orderType, applyBonus, applyDiscount, paymentMethodRef,
      orderIsConsignment, consignmentDueDate, orderCreatedAtLocal, qtyByProductId, stockQ.data,
      isEditMode, editOrderId, editSourceWarehouseId, editReservedQtyByProduct, editOrderQ.data,
      createCtxQ.data, ctxProfile, paymentMethodSelectOptions, requiresPaymentMethodForSubmit,
      showOrderPaymentMethodSelector, priceAsOf, oldPricesEnabled
    ]
  );

  const buildExchangeSubmit = useCallback(
    () =>
      runExchangeSubmit({
        tenantSlug: tenantSlug!,
        clientId,
        warehouseId,
        agentId,
        expeditorUserId,
        priceType,
        orderComment,
        orderNotePreset,
        requestTypeRef,
        orderCreatedAtLocal,
        exchangeSourceOrderIds,
        exMinusKey,
        exMinusQty,
        exPlusProductId,
        exPlusQty,
        exchangeItems: exchangeReturnsQ.data?.items,
        ctxProfile
      }),
    [
      tenantSlug, clientId, warehouseId, agentId, expeditorUserId, priceType, orderComment,
      orderNotePreset, requestTypeRef, orderCreatedAtLocal, exchangeSourceOrderIds, exMinusKey,
      exMinusQty, exPlusProductId, exPlusQty, exchangeReturnsQ.data?.items, ctxProfile
    ]
  );

  const collectBonusPreviewItems = useCallback(() => {
    const widRaw =
      warehouseId.trim() ||
      (editSourceWarehouseId != null ? String(editSourceWarehouseId) : "");
    const wid = Number.parseInt(widRaw, 10);
    const sameWh =
      editSourceWarehouseId != null && Number.isFinite(wid) && wid === editSourceWarehouseId;
    return buildOrdinaryItems({
      qtyByProductId,
      stockRows: stockQ.data,
      sameWarehouseAsEdit: Boolean(sameWh),
      editReservedQtyByProduct
    });
  }, [warehouseId, editSourceWarehouseId, qtyByProductId, stockQ.data, editReservedQtyByProduct]);

  return {
    tenantSlug,
    onCreated,
    onCancel,
    orderType,
    isEditMode,
    editOrderId,
    editOrderNumber,
    editFormBlocked,
    headerClientAgentLocked: isEditMode,
    ORDER_CREATE_DEBUG,
    activeCatalogCategoryId,
    agentCatalogReady,
    agentFilterOptions,
    agentId,
    agentUserIdSet,
    agentUsers,
    applyBonus,
    applyDiscount,
    blockByProductId,
    canPickPricingAndExpeditor,
    canPickProducts,
    canPickWarehouse,
    canShowOrderCatalog,
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
    editOrderQ,
    debugOrderCreate,
    displayProductGroups,
    displayProducts,
    eligibleClientById,
    eligibleClientIdSet,
    eligibleClients,
    errorTarget,
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
    hasQtyOverStock,
    hasWarehouse,
    isExchangeFlow,
    isPolkiByOrder,
    isPolkiFree,
    isPolkiSheet,
    lineProblemCountByCategoryId,
    loadingLists,
    localError,
    lockedAgentLabel,
    lockedWarehouseLabel,
    missingPriceProductNames,
    normalizedType,
    orderClientPickerScopeIds,
    orderComment,
    orderIsConsignment,
    orderNoteOptions,
    orderNotePreset,
    orderOpenedAt,
    orderCreatedAtLocal,
    setOrderCreatedAtLocal,
    paymentMethodRef,
    paymentMethodSelectOptions,
    polkiSelectedClientLabel,
    priceAsOf,
    priceType,
    oldPriceByProductId,
    oldPrices,
    oldPricesEnabled,
    oldPricesPriceTypeLabels,
    productSearch,
    productSearchNorm,
    products,
    qtyByProductId,
    refSelectKey,
    refusalReasonPolkiOptions,
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
    setApplyDiscount,
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
    setPriceType: applyPriceType,
    clearOldPrices,
    setProductSearch,
    setQtyByProductId,
    setRefSelectKey,
    setRequestTypeRef,
    setSelectedCategoryIds,
    setSelectionNotice,
    setWarehouseId,
    showOrderPaymentMethodSelector,
    stockByProduct,
    stockProductIdsKey,
    stockQ,
    tableProductGroups,
    tenantShowPaymentMethodSelector,
    totalVolumeM3,
    uiPrefsQ,
    useSplitOrderCatalog,
    userShowPaymentMethodSelector,
    users,
    warehouseId,
    warehouseIdSet,
    warehouses,
    deepLinkClientId,
    deepLinkSourceOrderId,
    reportLocalError,
    editSourceWarehouseId,
    editReservedQtyByProduct,
    buildOrdinarySubmit,
    buildExchangeSubmit,
    collectBonusPreviewItems,
    setErrorTarget,
    /** ADR public: edit hydrate is effect-driven in draft-data when editOrderQ succeeds. */
    hydrateEdit: () => {
      /* no-op: use-order-create-draft-data hydrates on editOrderQ */
    },
    /** ADR public: batch header setters. */
    setHeader: (patch: {
      clientId?: string;
      warehouseId?: string;
      agentId?: string;
      priceType?: string;
      orderComment?: string;
    }) => {
      if (patch.clientId != null) setClientId(patch.clientId);
      if (patch.warehouseId != null) setWarehouseId(patch.warehouseId);
      if (patch.agentId != null) setAgentId(patch.agentId);
      if (patch.priceType != null) applyPriceType(patch.priceType);
      if (patch.orderComment != null) setOrderComment(patch.orderComment);
    },
    setQty: setQtyByProductId,
    canSubmitOrdinaryBase,
    canSubmitExchangeBase
  } as const;
}


export type OrderCreateDraftVm = ReturnType<typeof useOrderCreateDraft>;
