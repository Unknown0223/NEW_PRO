"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { api } from "@/lib/api";
import { downloadOrdersNakladnoyXlsx } from "@/lib/order-nakladnoy";
import type { OrdersListCacheBody } from "@/lib/orders-list-cache";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  buildPaymentPrefillFromSelection,
  ordersMutationFeedback,
  rowStatusPatchError,
  type BulkExpeditorResponse,
  type BulkOrderStatusResponse
} from "./types";
import type { OrdersListPagePart1 } from "./use-orders-list-page.part1";

export function useOrdersListPagePart2(p1: OrdersListPagePart1) {
  const {
    tenantSlug,
    qc,
    rows,
    selectedOrderIds,
    setSelectedOrderIds,
    setBulkFeedback,
    setBulkTargetStatus,
    setNakladnoyFeedback,
    setBulkExpFeedback,
    setBulkExpeditorChoice,
    statusRowError,
    setStatusRowError,
    nakladnoyTemplate,
    nakladnoyPrefs,
    patchOrderInOrdersListCaches,
    applyOrderDetailToListCaches
  } = p1;

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedOrderIds.has(r.id)),
    [rows, selectedOrderIds]
  );

  const selectionTotals = useMemo(() => {
    let qty = 0;
    let total = 0;
    let discount = 0;
    let bonusQty = 0;
    let debt = 0;
    for (const r of selectedRows) {
      qty += Number.parseFloat(String(r.qty).replace(/\s/g, "").replace(",", ".")) || 0;
      total += Number.parseFloat(String(r.total_sum).replace(/\s/g, "").replace(",", ".")) || 0;
      discount += Number.parseFloat(String(r.discount_sum ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
      bonusQty += Number.parseFloat(String(r.bonus_qty ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
      if (r.debt != null && r.debt !== "") {
        debt += Number.parseFloat(String(r.debt).replace(/\s/g, "").replace(",", ".")) || 0;
      }
    }
    return { count: selectedRows.length, qty, total, discount, bonusQty, debt };
  }, [selectedRows]);

  const paymentPrefill = useMemo(
    () => buildPaymentPrefillFromSelection(rows, selectedOrderIds),
    [rows, selectedOrderIds]
  );

  const rowStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { data } = await api.patch<OrderDetailRow>(`/api/${tenantSlug}/orders/${id}/status`, {
        status
      });
      return data;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["orders", tenantSlug] });
      const snapshots = qc.getQueriesData<OrdersListCacheBody>({ queryKey: ["orders", tenantSlug] });
      patchOrderInOrdersListCaches(qc, tenantSlug, id, (r) => ({ ...r, status }));
      return { snapshots };
    },
    onSuccess: (detail) => {
      applyOrderDetailToListCaches(qc, tenantSlug, detail);
      setStatusRowError((prev) => {
        const n = { ...prev };
        delete n[detail.id];
        return n;
      });
    },
    onError: (err: unknown, { id }, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      setStatusRowError((prev) => ({ ...prev, [id]: rowStatusPatchError(err) }));
    },
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries({ queryKey: ["order", tenantSlug, id] });
    }
  });

  const nakladnoyMut = useMutation({
    mutationFn: async (payload: {
      template: typeof nakladnoyTemplate;
      prefs: typeof nakladnoyPrefs;
      format?: "xlsx" | "pdf";
    }) => {
      await downloadOrdersNakladnoyXlsx({
        tenantSlug: tenantSlug!,
        orderIds: Array.from(selectedOrderIds),
        template: payload.template,
        prefs: payload.prefs,
        format: payload.format ?? "xlsx"
      });
    },
    onSuccess: (_data, vars) => {
      setNakladnoyFeedback(vars.format === "pdf" ? "PDF fayl yuklab olindi." : "Excel fayl yuklab olindi.");
    },
    onError: (err: unknown) => {
      setNakladnoyFeedback(ordersMutationFeedback(err, "Nakladnoyni yuklab bo‘lmadi."));
    }
  });

  const bulkExpeditorMut = useMutation({
    mutationFn: async (payload: { order_ids: number[]; expeditor_user_id: number | null }) => {
      const { data } = await api.post<BulkExpeditorResponse>(
        `/api/${tenantSlug}/orders/bulk/expeditor`,
        payload
      );
      return data;
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      const n = res.failed.length;
      setBulkExpFeedback(
        n === 0
          ? `${res.updated.length} ta zakaz yangilandi.`
          : `${res.updated.length} ta OK, ${n} ta xato.`
      );
      setBulkExpeditorChoice("");
    },
    onError: (err: unknown) => {
      setBulkExpFeedback(ordersMutationFeedback(err, "Ekspeditorni yangilab bo‘lmadi."));
    }
  });

  const bulkStatusMut = useMutation({
    mutationFn: async (payload: { order_ids: number[]; status: string }) => {
      const { data } = await api.post<BulkOrderStatusResponse>(
        `/api/${tenantSlug}/orders/bulk/status`,
        payload
      );
      return data;
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      setSelectedOrderIds(new Set());
      setBulkTargetStatus("");
      if (res.failed.length > 0) {
        setBulkFeedback(
          `Yangilandi: ${res.updated.length}. O‘tmadi: ${res.failed.length} (ID: ${res.failed
            .slice(0, 8)
            .map((f) => f.id)
            .join(", ")}${res.failed.length > 8 ? "…" : ""})`
        );
      } else {
        setBulkFeedback(null);
      }
    },
    onError: (err: unknown) => {
      setBulkFeedback(ordersMutationFeedback(err, "Guruh holatini o‘zgartirib bo‘lmadi."));
    }
  });

  const allOnPageSelected = rows.length > 0 && rows.every((o) => selectedOrderIds.has(o.id));

  const toggleOrderSelect = useCallback(
    (id: number) => {
      setSelectedOrderIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      setBulkFeedback(null);
      setNakladnoyFeedback(null);
    },
    [setBulkFeedback, setNakladnoyFeedback, setSelectedOrderIds]
  );

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedOrderIds((prev) => {
      const n = new Set(prev);
      const ids = rows.map((o) => o.id);
      if (allOnPageSelected) {
        ids.forEach((id) => n.delete(id));
      } else {
        ids.forEach((id) => n.add(id));
      }
      return n;
    });
    setBulkFeedback(null);
    setNakladnoyFeedback(null);
  }, [allOnPageSelected, rows, setBulkFeedback, setNakladnoyFeedback, setSelectedOrderIds]);

  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
    setBulkTargetStatus("");
    setBulkFeedback(null);
    setBulkExpeditorChoice("");
    setBulkExpFeedback(null);
    p1.setDownloadsOpen(false);
    p1.setNakladnoySettingsOpen(false);
    setNakladnoyFeedback(null);
  }, [p1, setBulkExpFeedback, setBulkExpeditorChoice, setBulkFeedback, setBulkTargetStatus, setNakladnoyFeedback, setSelectedOrderIds]);

  return {
    selectedRows,
    selectionTotals,
    paymentPrefill,
    rowStatusMut,
    nakladnoyMut,
    bulkExpeditorMut,
    bulkStatusMut,
    allOnPageSelected,
    toggleOrderSelect,
    toggleSelectAllOnPage,
    clearSelection,
    statusRowError
  };
}
