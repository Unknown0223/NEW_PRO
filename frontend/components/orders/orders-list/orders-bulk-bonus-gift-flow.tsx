"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import {
  OrderEditBonusConfirmModal
} from "@/components/orders/order-create/order-edit-bonus-confirm-modal";
import type {
  BonusGiftLinePayload,
  BonusStrategySelectionPayload,
  OrderBonusPreviewResponse
} from "@/components/orders/order-create/order-edit-bonus-confirm.logic";
import { api } from "@/lib/api";
import { applyOrderDetailToListCaches } from "@/lib/orders-list-cache";
import { getUserFacingError } from "@/lib/error-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

function paidItemsFromDetail(d: OrderDetailRow): { product_id: number; qty: number }[] {
  return (d.items ?? [])
    .filter((i) => !i.is_bonus)
    .map((i) => ({
      product_id: i.product_id,
      qty: Number.parseFloat(String(i.qty).replace(",", ".")) || 0
    }))
    .filter((i) => i.qty > 0);
}

export async function openBonusPickerForOrder(
  tenantSlug: string,
  orderId: number
): Promise<{
  detail: OrderDetailRow;
  preview: OrderBonusPreviewResponse;
  items: { product_id: number; qty: number }[];
}> {
  const { data: detail } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`);
  const items = paidItemsFromDetail(detail);
  const cid = detail.client_id;
  const wid = detail.warehouse_id;
  const agentId = detail.agent_id;
  if (!cid || !wid || !agentId) {
    throw new Error("В заказе не указан клиент, склад или агент.");
  }
  const { data: preview } = await api.post<OrderBonusPreviewResponse>(
    `/api/${tenantSlug}/orders/bonus-preview`,
    {
      client_id: cid,
      warehouse_id: wid,
      agent_id: agentId,
      price_type: detail.price_type?.trim() || "retail",
      items,
      is_consignment: Boolean(detail.is_consignment),
      exclude_order_id: orderId
    }
  );
  return { detail, preview, items };
}

export function useBulkBonusGiftPicker(tenantSlug: string | null) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrderBonusPreviewResponse | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [items, setItems] = useState<{ product_id: number; qty: number }[]>([]);

  const start = useCallback(
    async (id: number) => {
      if (!tenantSlug) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      setPreview(null);
      setOrderId(id);
      try {
        const packed = await openBonusPickerForOrder(tenantSlug, id);
        setPreview(packed.preview);
        setItems(packed.items);
      } catch (e) {
        setError(getUserFacingError(e, "Не удалось получить предпросмотр бонуса."));
      } finally {
        setLoading(false);
      }
    },
    [tenantSlug]
  );

  const confirm = useCallback(
    async (payload: {
      bonus_gift_lines: BonusGiftLinePayload[];
      bonus_strategy_selections: BonusStrategySelectionPayload[];
    }) => {
      if (!tenantSlug || orderId == null) return;
      setSaving(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          apply_bonus: true,
          apply_discount: true,
          items
        };
        if (payload.bonus_gift_lines.length) body.bonus_gift_lines = payload.bonus_gift_lines;
        if (payload.bonus_strategy_selections.length) {
          body.bonus_strategy_selections = payload.bonus_strategy_selections;
        }
        const { data } = await api.patch<OrderDetailRow>(
          `/api/${tenantSlug}/orders/${orderId}`,
          body
        );
        applyOrderDetailToListCaches(qc, tenantSlug, data);
        void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
        void qc.invalidateQueries({ queryKey: ["order", tenantSlug, orderId] });
        setOpen(false);
      } catch (e) {
        setError(getUserFacingError(e, "Не удалось сохранить бонус."));
      } finally {
        setSaving(false);
      }
    },
    [tenantSlug, orderId, items, qc]
  );

  const modal = (
    <OrderEditBonusConfirmModal
      open={open}
      onOpenChange={(v) => {
        if (!saving) setOpen(v);
      }}
      loading={loading}
      error={error}
      preview={preview}
      saving={saving}
      onConfirm={(p) => void confirm(p)}
    />
  );

  return { start, modal, busy: loading || saving };
}