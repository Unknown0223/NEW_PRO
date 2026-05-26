"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import {
  DEFAULT_NAKLADNOY_EXPORT_PREFS,
  loadNakladnoyExportPrefs,
  type NakladnoyExportPrefs,
  type NakladnoyTemplateId
} from "@/lib/order-nakladnoy";
import {
  applyOrderDetailToListCaches,
  patchOrderInOrdersListCaches,
  type OrdersListCacheBody
} from "@/lib/orders-list-cache";
import {
  ORDER_LIST_COLUMN_IDS,
  ORDER_LIST_DEFAULT_HIDDEN_COLUMN_IDS,
  ORDERS_LIST_TABLE_ID
} from "@/lib/orders-list-columns";
import { STALE } from "@/lib/query-stale";
import { useOrdersListReferenceData } from "./use-orders-list-reference-data";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildOrdersSearchParams,
  DEFAULT_ORDERS_FILTER_VISIBILITY,
  ORDERS_FILTER_VISIBILITY_STORAGE_KEY,
  parseNumField,
  parseOrdersUrl,
  type OrdersFilterVisibility,
  type OrdersResponse,
  type OrdersUrlFilters
} from "./types";

export function useOrdersListPagePart1() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const filters = useMemo(() => parseOrdersUrl(searchParams), [searchParams]);
  const clientIdFromUrl = filters.client_id;

  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const effectiveRole = useEffectiveRole();
  const qc = useQueryClient();

  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(() => new Set());
  const [bulkTargetStatus, setBulkTargetStatus] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [nakladnoyTemplate, setNakladnoyTemplate] = useState<NakladnoyTemplateId>("nakladnoy_warehouse");
  const [nakladnoyPrefs, setNakladnoyPrefs] = useState<NakladnoyExportPrefs>(DEFAULT_NAKLADNOY_EXPORT_PREFS);
  const [nakladnoySettingsOpen, setNakladnoySettingsOpen] = useState(false);
  const [nakladnoyFeedback, setNakladnoyFeedback] = useState<string | null>(null);
  const [statusRowError, setStatusRowError] = useState<Record<number, string>>({});
  const [totalsPanelOpen, setTotalsPanelOpen] = useState(false);
  const [bulkExpeditorChoice, setBulkExpeditorChoice] = useState<string>("");
  const [bulkExpFeedback, setBulkExpFeedback] = useState<string | null>(null);
  const [bulkConsignmentFeedback, setBulkConsignmentFeedback] = useState<string | null>(null);
  const [filterVisibilityOpen, setFilterVisibilityOpen] = useState(false);
  const [filterVisibility, setFilterVisibility] = useState<OrdersFilterVisibility>(
    DEFAULT_ORDERS_FILTER_VISIBILITY
  );
  const ordersDateRangeAnchorRef = useRef<HTMLButtonElement>(null);
  const [ordersDateRangeOpen, setOrdersDateRangeOpen] = useState(false);
  const [ordersViewMode, setOrdersViewMode] = useState<"list" | "expeditor-summary">("list");
  const [filterDraft, setFilterDraft] = useState<OrdersUrlFilters>(filters);

  useEffect(() => {
    setFilterDraft(filters);
  }, [filters]);

  useEffect(() => {
    setNakladnoyPrefs(loadNakladnoyExportPrefs());
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ORDERS_FILTER_VISIBILITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OrdersFilterVisibility>;
      const { clientId: _omitClientId, ...parsedRest } = parsed as OrdersFilterVisibility & {
        clientId?: boolean;
      };
      setFilterVisibility({
        ...DEFAULT_ORDERS_FILTER_VISIBILITY,
        ...parsedRest,
        paymentLinkedType:
          parsed.paymentLinkedType ?? DEFAULT_ORDERS_FILTER_VISIBILITY.paymentLinkedType
      });
    } catch {
      setFilterVisibility(DEFAULT_ORDERS_FILTER_VISIBILITY);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ORDERS_FILTER_VISIBILITY_STORAGE_KEY,
        JSON.stringify(filterVisibility)
      );
    } catch {
      // noop: localStorage unavailable
    }
  }, [filterVisibility]);

  const {
    canBulkCatalog,
    warehousesQ,
    agentsQ,
    expeditorsQ,
    productsFilterQ,
    productCategoriesQ,
    ordersProfileRefsQ,
    clientCategoryFilterOpts,
    tradeDirectionFilterOpts,
    priceTypeFilterOpts,
    buildTerritoryCascade,
    paymentMethodFilterOpts,
    paymentTypeFilterOpts,
    nakladnoyTypeFilterOpts
  } = useOrdersListReferenceData(tenantSlug, effectiveRole, filterDraft);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: ORDERS_LIST_TABLE_ID,
    defaultColumnOrder: [...ORDER_LIST_COLUMN_IDS],
    defaultHiddenColumnIds: ORDER_LIST_DEFAULT_HIDDEN_COLUMN_IDS,
    defaultPageSize: 15,
    allowedPageSizes: [10, 15, 20, 30, 50, 100]
  });

  const replaceOrdersQuery = useCallback(
    (patch: Partial<OrdersUrlFilters>) => {
      const cur = parseOrdersUrl(searchParams);
      const next: OrdersUrlFilters = {
        status: patch.status !== undefined ? patch.status : cur.status,
        order_type: patch.order_type !== undefined ? patch.order_type : cur.order_type,
        page: patch.page !== undefined ? patch.page : cur.page,
        search: patch.search !== undefined ? patch.search : cur.search,
        warehouse_id: patch.warehouse_id !== undefined ? patch.warehouse_id : cur.warehouse_id,
        agent_id: patch.agent_id !== undefined ? patch.agent_id : cur.agent_id,
        expeditor_id: patch.expeditor_id !== undefined ? patch.expeditor_id : cur.expeditor_id,
        date_from: patch.date_from !== undefined ? patch.date_from : cur.date_from,
        date_to: patch.date_to !== undefined ? patch.date_to : cur.date_to,
        client_id: patch.client_id !== undefined ? patch.client_id : cur.client_id,
        product_id: patch.product_id !== undefined ? patch.product_id : cur.product_id,
        client_category:
          patch.client_category !== undefined ? patch.client_category : cur.client_category,
        client_region: patch.client_region !== undefined ? patch.client_region : cur.client_region,
        client_city: patch.client_city !== undefined ? patch.client_city : cur.client_city,
        client_zone: patch.client_zone !== undefined ? patch.client_zone : cur.client_zone,
        trade_direction:
          patch.trade_direction !== undefined ? patch.trade_direction : cur.trade_direction,
        date_mode: patch.date_mode !== undefined ? patch.date_mode : cur.date_mode,
        is_consignment: patch.is_consignment !== undefined ? patch.is_consignment : cur.is_consignment,
        product_category_id:
          patch.product_category_id !== undefined ? patch.product_category_id : cur.product_category_id,
        payment_type: patch.payment_type !== undefined ? patch.payment_type : cur.payment_type,
        payment_method_ref:
          patch.payment_method_ref !== undefined ? patch.payment_method_ref : cur.payment_method_ref,
        request_type_ref:
          patch.request_type_ref !== undefined ? patch.request_type_ref : cur.request_type_ref,
        visit_weekday: patch.visit_weekday !== undefined ? patch.visit_weekday : cur.visit_weekday,
        price_type: patch.price_type !== undefined ? patch.price_type : cur.price_type
      };
      const qs = buildOrdersSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const applyFilterDraft = useCallback(() => {
    const qs = buildOrdersSearchParams({ ...filterDraft, page: 1 }).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filterDraft, pathname, router]);

  const resetFilterDraft = useCallback(() => {
    const empty: OrdersUrlFilters = {
      status: "",
      order_type: "",
      page: 1,
      search: "",
      warehouse_id: "",
      agent_id: "",
      expeditor_id: "",
      date_from: "",
      date_to: "",
      client_id: "",
      product_id: "",
      client_category: "",
      client_region: "",
      client_city: "",
      client_zone: "",
      trade_direction: "",
      date_mode: "order",
      is_consignment: "",
      product_category_id: "",
      payment_type: "",
      payment_method_ref: "",
      request_type_ref: "",
      visit_weekday: "",
      price_type: ""
    };
    setFilterDraft(empty);
    replaceOrdersQuery(empty);
  }, [replaceOrdersQuery]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "orders",
      tenantSlug,
      filters.page,
      filters.search,
      filters.status,
      filters.order_type,
      filters.client_id,
      filters.warehouse_id,
      filters.agent_id,
      filters.expeditor_id,
      filters.date_from,
      filters.date_to,
      filters.date_mode,
      filters.is_consignment,
      filters.product_category_id,
      filters.payment_type,
      filters.payment_method_ref,
      filters.request_type_ref,
      filters.product_id,
      filters.client_category,
      filters.client_region,
      filters.client_city,
      filters.client_zone,
      filters.trade_direction,
      filters.visit_weekday,
      filters.price_type,
      tablePrefs.pageSize
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(tablePrefs.pageSize)
      });
      if (filters.search.trim()) params.set("q", filters.search.trim());
      if (filters.status.trim()) params.set("status", filters.status.trim());
      if (filters.order_type) params.set("order_type", filters.order_type);
      if (filters.client_id) params.set("client_id", filters.client_id);
      if (filters.warehouse_id) params.set("warehouse_id", filters.warehouse_id);
      if (filters.agent_id) params.set("agent_id", filters.agent_id);
      if (filters.expeditor_id) params.set("expeditor_id", filters.expeditor_id);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      if (filters.product_id) params.set("product_id", filters.product_id);
      if (filters.client_category) params.set("client_category", filters.client_category);
      if (filters.client_region) params.set("client_region", filters.client_region);
      if (filters.client_city) params.set("client_city", filters.client_city);
      if (filters.client_zone) params.set("client_zone", filters.client_zone);
      if (filters.trade_direction) params.set("trade_direction", filters.trade_direction);
      if (filters.visit_weekday) params.set("visit_weekday", filters.visit_weekday);
      if (filters.price_type) params.set("price_type", filters.price_type);
      if (filters.date_mode) params.set("date_mode", filters.date_mode);
      if (filters.is_consignment === "true") params.set("is_consignment", "true");
      if (filters.is_consignment === "false") params.set("is_consignment", "false");
      if (filters.product_category_id) params.set("product_category_id", filters.product_category_id);
      if (filters.payment_type.trim()) params.set("payment_type", filters.payment_type.trim());
      if (filters.payment_method_ref.trim()) {
        params.set("payment_method_ref", filters.payment_method_ref.trim());
      }
      if (filters.request_type_ref.trim()) {
        params.set("request_type_ref", filters.request_type_ref.trim());
      }
      const { data: body } = await api.get<OrdersResponse>(
        `/api/${tenantSlug}/orders?${params.toString()}`
      );
      return body;
    }
  });

  const rows = data?.data ?? [];

  const expeditorSummaryRows = useMemo(() => {
    const map = new Map<
      string,
      { expeditor: string; orders: number; qty: number; total: number; delivered: number; delivering: number }
    >();
    for (const r of rows) {
      const exp = (r.expeditor_display ?? r.expeditors ?? "—").trim() || "—";
      const cur = map.get(exp) ?? {
        expeditor: exp,
        orders: 0,
        qty: 0,
        total: 0,
        delivered: 0,
        delivering: 0
      };
      cur.orders += 1;
      cur.qty += parseNumField(r.qty);
      cur.total += parseNumField(r.total_sum);
      if (r.status === "delivered") cur.delivered += 1;
      if (r.status === "delivering") cur.delivering += 1;
      map.set(exp, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.orders - a.orders || a.expeditor.localeCompare(b.expeditor, "ru")
    );
  }, [rows]);

  const orderListTotalPages = useMemo(() => {
    if (!data) return 1;
    const lim = data.limit > 0 ? data.limit : tablePrefs.pageSize;
    return Math.max(1, Math.ceil(data.total / lim));
  }, [data, tablePrefs.pageSize]);

  const prefetchOrderDetail = useCallback(
    (orderId: number) => {
      if (!tenantSlug) return;
      void qc.prefetchQuery({
        queryKey: ["order", tenantSlug, orderId],
        staleTime: STALE.detail,
        queryFn: async () => {
          const { data: body } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`);
          return body;
        }
      });
    },
    [qc, tenantSlug]
  );

  return {
    searchParams,
    pathname,
    router,
    filters,
    filterDraft,
    setFilterDraft,
    clientIdFromUrl,
    tenantSlug,
    authHydrated,
    effectiveRole,
    qc,
    columnDialogOpen,
    setColumnDialogOpen,
    selectedOrderIds,
    setSelectedOrderIds,
    bulkTargetStatus,
    setBulkTargetStatus,
    bulkFeedback,
    setBulkFeedback,
    downloadsOpen,
    setDownloadsOpen,
    nakladnoyTemplate,
    setNakladnoyTemplate,
    nakladnoyPrefs,
    setNakladnoyPrefs,
    nakladnoySettingsOpen,
    setNakladnoySettingsOpen,
    nakladnoyFeedback,
    setNakladnoyFeedback,
    statusRowError,
    setStatusRowError,
    totalsPanelOpen,
    setTotalsPanelOpen,
    bulkExpeditorChoice,
    setBulkExpeditorChoice,
    bulkExpFeedback,
    setBulkExpFeedback,
    bulkConsignmentFeedback,
    setBulkConsignmentFeedback,
    filterVisibilityOpen,
    setFilterVisibilityOpen,
    filterVisibility,
    setFilterVisibility,
    ordersDateRangeAnchorRef,
    ordersDateRangeOpen,
    setOrdersDateRangeOpen,
    ordersViewMode,
    setOrdersViewMode,
    canBulkCatalog,
    tablePrefs,
    replaceOrdersQuery,
    applyFilterDraft,
    resetFilterDraft,
    data,
    isLoading,
    isError,
    error,
    refetch,
    rows,
    expeditorSummaryRows,
    orderListTotalPages,
    warehousesQ,
    agentsQ,
    expeditorsQ,
    productsFilterQ,
    productCategoriesQ,
    ordersProfileRefsQ,
    clientCategoryFilterOpts,
    tradeDirectionFilterOpts,
    priceTypeFilterOpts,
    buildTerritoryCascade,
    paymentMethodFilterOpts,
    paymentTypeFilterOpts,
    nakladnoyTypeFilterOpts,
    prefetchOrderDetail,
    patchOrderInOrdersListCaches,
    applyOrderDetailToListCaches
  };
}

export type OrdersListPagePart1 = ReturnType<typeof useOrdersListPagePart1>;
