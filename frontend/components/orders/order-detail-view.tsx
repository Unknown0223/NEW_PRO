"use client";

import { QueryErrorState } from "@/components/common/query-error-state";
import { rowStatusPatchError } from "@/components/orders/orders-list/types";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole, isOperatorLikeWebRole } from "@/lib/distribution-roles";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { refEntryLabelByStored } from "@/lib/profile-ref-entries";
import type { ProductRow } from "@/lib/product-types";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios, { type AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { OrderBonusSection } from "./order-detail/bonus-section";
import { ClientInfoCard } from "./order-detail/client-info-card";
import { OrderInfoCard } from "./order-detail/order-info-card";
import { OrderDetailSkeleton } from "./order-detail/order-detail-skeleton";
import { OrderSummaryTiles } from "./order-detail/order-summary-tiles";
import { OrderProductsTable } from "./order-detail/products-table";
import { OrderDetailStatusSection } from "./order-detail/status-section";
import { OrderApprovalPanel } from "./order-detail/order-approval-panel";
import { OrderPrintView } from "./order-print-view";

function parseDec(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number.parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export type OrderListRow = {
  id: number;
  number: string;
  order_type: string | null;
  client_id: number;
  client_name: string;
  client_code?: string | null;
  client_legal_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  agent_name: string | null;
  agent_code: string | null;
  expeditors: string | null;
  expeditor_id: number | null;
  expeditor_display: string | null;
  region: string | null;
  city: string | null;
  zone: string | null;
  consignment: boolean | null;
  /** Konsignatsiya zakazi (order.is_consignment). */
  is_consignment?: boolean;
  day: string | null;
  created_by: string | null;
  created_by_role: string | null;
  expected_ship_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  status: string;
  /** Buyurtma tasdiqlash zanjiri holati (null — zanjir yo‘q). */
  approval_status?: string | null;
  qty: string;
  total_sum: string;
  /** Bonus mahsulotlar jami donasi (API yangilangach doim keladi) */
  bonus_qty?: string;
  /** Foizli chegirma summasi */
  discount_sum?: string;
  /** Skidka kutilgan, lekin qo‘llanmagan */
  discount_alert?: string | null;
  /** Bonus yetarli emas */
  bonus_alert?: string | null;
  /** Bonus qatorlarining narxlangan qiymati */
  bonus_sum: string;
  balance: string | null;
  debt: string | null;
  price_type: string | null;
  comment: string | null;
  /** «Причины заявок» kod/nom */
  request_type_ref?: string | null;
  client_phone?: string | null;
  client_inn?: string | null;
  client_address?: string | null;
  order_location?: string | null;
  sales_channel?: string | null;
  agent_trade_direction?: string | null;
  volume_m3?: string | null;
  cumulative_bonus?: string | null;
  consignment_due_date?: string | null;
  source_order_numbers?: string[];
  source_order_ids?: number[];
  returned_at?: string | null;
  creation_channel?: "web" | "mobile";
  created_at: string;
  list_created_at?: string | null;
  /** Skladchi yig‘ish bloki (bitta доставщик maydoni). */
  warehouse_block_id?: number | null;
  warehouse_block_name?: string | null;
  /** Ro‘yxat API dan; tafsilotda bo‘lmasa bo‘sh. */
  allowed_next_statuses?: string[];
};

export type OrderItemRow = {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  qty: string;
  price: string;
  total: string;
  is_bonus: boolean;
  volume_m3?: string | null;
  weight_kg?: string | null;
  line_volume_m3?: string | null;
  line_weight_kg?: string | null;
  discount_pct?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  bonus_product_name?: string | null;
  bonus_product_qty?: string | null;
  bonus_trigger_label?: string | null;
};

export type OrderStatusLogRow = {
  id: number;
  from_status: string;
  to_status: string;
  user_login: string | null;
  created_at: string;
};

export type OrderChangeLogRow = {
  id: number;
  action: string;
  payload: unknown;
  user_login: string | null;
  created_at: string;
};

export type BonusGiftSwapOptionRow = {
  bonus_rule_id: number;
  rule_name: string;
  allowed_product_ids: number[];
  chosen_product_id: number;
  products: Array<{ id: number; name: string; sku: string }>;
};

export type OrderDetailRow = OrderListRow & {
  agent_id: number | null;
  warehouse_name: string | null;
  agent_display: string | null;
  agent_trade_direction?: string | null;
  consignment_due_date?: string | null;
  apply_bonus: boolean;
  items: OrderItemRow[];
  allowed_next_statuses: string[];
  status_logs: OrderStatusLogRow[];
  change_logs: OrderChangeLogRow[];
  bonus_gift_selections?: Record<string, number>;
  bonus_gift_swap_options?: BonusGiftSwapOptionRow[];
  applied_bonus_rules_snapshot?: import("@/components/orders/order-bonus-snapshot-types").AppliedBonusRuleSnapshot[];
  client_finance?: {
    account_balance: string;
    credit_limit: string;
    outstanding: string;
    headroom: string;
  };
  client_gps_text?: string | null;
  client_latitude?: string | null;
  client_longitude?: string | null;
  client_category?: string | null;
  client_responsible_person?: string | null;
  payment_method_label?: string | null;
};

type Props = {
  tenantSlug: string | null;
  orderId: number;
  showPrintView?: boolean;
};

type Line = { key: string; productId: string; qty: string };

function newLine(): Line {
  return { key: crypto.randomUUID(), productId: "", qty: "1" };
}

function paidItemsToLines(items: OrderItemRow[]): Line[] {
  const paid = items.filter((i) => !i.is_bonus);
  if (paid.length === 0) return [newLine()];
  return paid.map((i) => ({
    key: crypto.randomUUID(),
    productId: String(i.product_id),
    qty: i.qty
  }));
}

const ORDER_LINES_EDITABLE_STATUSES = new Set(["new", "confirmed"]);

function patchOrderLinesErrorMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const ax = err as AxiosError<{
    error?: string;
    product_id?: number;
    credit_limit?: string;
    outstanding?: string;
    order_total?: string;
  }>;
  const code = ax.response?.data?.error;
  const d = ax.response?.data;
  if (code === "OrderNotEditable") {
    return withApiSupportLine("Bu holatda qatorlarni tahrirlab bo‘lmaydi (faqat «Новый» yoki «Подтверждён»).", err);
  }
  if (code === "ForbiddenOperatorOrderLinesEdit") {
    return withApiSupportLine("To‘lov qatorlarini tahrirlash faqat admin uchun.", err);
  }
  if (code === "NoRetailPrice" || code === "NoPrice") {
    const id = d?.product_id;
    const pt = (d as { price_type?: string } | undefined)?.price_type ?? "retail";
    return withApiSupportLine(
      id != null
        ? `Mahsulot #${id} uchun «${pt}» narxi yo‘q.`
        : `Narx yo‘q («${pt}»).`,
      err
    );
  }
  if (code === "BadClient") return withApiSupportLine("Klient (zakaz) topilmadi yoki faol emas.", err);
  if (code === "BadProduct") return withApiSupportLine("Mahsulot topilmadi yoki faol emas.", err);
  if (code === "BadQty") return withApiSupportLine("Miqdor noto‘g‘ri.", err);
  if (code === "DuplicateProduct") return withApiSupportLine("Bir xil mahsulotni bir nechta qatorga qo‘shib bo‘lmaydi.", err);
  if (code === "EmptyItems") return withApiSupportLine("Kamida bitta to‘lov qatori kerak.", err);
  if (code === "CreditLimitExceeded" && d) {
    return withApiSupportLine(
      `Kredit limiti yetmaydi. Limit: ${d.credit_limit ?? "—"}, boshqa zakazlar: ${d.outstanding ?? "—"}, bu zakaz to‘lovi: ${d.order_total ?? "—"}.`,
      err
    );
  }
  if (ax.response?.status === 403) {
    return withApiSupportLine("Tahrirlash huquqi yo‘q (faqat admin / operator).", err);
  }
  return null;
}

export function OrderDetailView({ tenantSlug, orderId, showPrintView = false }: Props) {
  const qc = useQueryClient();
  const role = useEffectiveRole();
  const canOperate = isAdminOrOperatorLikeRole(role);
  const [editingLines, setEditingLines] = useState(false);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [editError, setEditError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaveError, setCommentSaveError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    setEditingLines(false);
    setEditError(null);
    setLines([newLine()]);
    setCommentDraft("");
    setCommentSaveError(null);
    setStatusError(null);
  }, [orderId]);

  const enabled = Boolean(tenantSlug) && orderId > 0;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["order", tenantSlug, orderId],
    enabled,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data: body } = await api.get<OrderDetailRow>(
        `/api/${tenantSlug}/orders/${orderId}`
      );
      return body;
    }
  });

  const profileRefsQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "order-detail-refs"],
    enabled: Boolean(tenantSlug) && enabled,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<{
        references: { request_type_entries?: unknown };
      }>(`/api/${tenantSlug}/settings/profile`);
      return body;
    }
  });

  useEffect(() => {
    if (!data) return;
    setCommentDraft(data.comment ?? "");
    setCommentSaveError(null);
  }, [data]);

  const metaMut = useMutation({
    mutationFn: async (payload: { comment?: string | null }) => {
      const { data: body } = await api.patch<OrderDetailRow>(
        `/api/${tenantSlug}/orders/${orderId}/meta`,
        payload
      );
      return body;
    },
    onSuccess: (body) => {
      void qc.setQueryData(["order", tenantSlug, orderId], body);
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      setCommentSaveError(null);
    },
    onError: (e: Error) => {
      setCommentSaveError(getUserFacingError(e, "Izohni saqlab bo‘lmadi."));
    }
  });

  const canEditOrderLines =
    role === "admin" && data != null && ORDER_LINES_EDITABLE_STATUSES.has(data.status);

  const productsQ = useQuery({
    queryKey: ["products", tenantSlug, "order-edit"],
    enabled: enabled && editingLines && canEditOrderLines,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: ProductRow[] }>(
        `/api/${tenantSlug}/products?page=1&limit=200&is_active=true`
      );
      return body.data;
    }
  });

  const patchLinesMut = useMutation({
    mutationFn: async (items: { product_id: number; qty: number }[]) => {
      const { data: body } = await api.patch<OrderDetailRow>(
        `/api/${tenantSlug}/orders/${orderId}`,
        { items }
      );
      return body;
    },
    onSuccess: (body) => {
      void qc.setQueryData(["order", tenantSlug, orderId], body);
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      setEditingLines(false);
      setEditError(null);
    },
    onError: (e: Error) => {
      const msg = patchOrderLinesErrorMessage(e);
      if (msg) {
        setEditError(msg);
        return;
      }
      setEditError(getUserFacingError(e, "Saqlab bo‘lmadi."));
    }
  });

  const [bonusGiftError, setBonusGiftError] = useState<string | null>(null);

  const statusMut = useMutation({
    mutationFn: async ({ status, occurred_at }: { status: string; occurred_at?: string }) => {
      const { data: body } = await api.patch<OrderDetailRow>(
        `/api/${tenantSlug}/orders/${orderId}/status`,
        { status, ...(occurred_at ? { occurred_at } : {}) }
      );
      return body;
    },
    onSuccess: (body) => {
      void qc.setQueryData(["order", tenantSlug, orderId], body);
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      setStatusError(null);
    },
    onError: (err: unknown) => {
      setStatusError(rowStatusPatchError(err));
    }
  });

  const bonusGiftMut = useMutation({
    mutationFn: async (payload: { ruleId: number; productId: number }) => {
      const cur = qc.getQueryData<OrderDetailRow>(["order", tenantSlug, orderId]);
      if (!cur) throw new Error("no data");
      const items = cur.items
        .filter((i) => !i.is_bonus)
        .map((i) => ({
          product_id: i.product_id,
          qty: Number.parseFloat(String(i.qty).replace(",", "."))
        }))
        .filter((l) => Number.isFinite(l.qty) && l.qty > 0);
      const { data: body } = await api.patch<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`, {
        items,
        bonus_gift_overrides: [{ bonus_rule_id: payload.ruleId, bonus_product_id: payload.productId }]
      });
      return body;
    },
    onSuccess: (body) => {
      void qc.setQueryData(["order", tenantSlug, orderId], body);
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      setBonusGiftError(null);
    },
    onError: (e: Error) => {
      if (axios.isAxiosError(e)) {
        const code = (e.response?.data as { error?: string } | undefined)?.error;
        if (code === "BadBonusGiftOverride") {
          setBonusGiftError(withApiSupportLine("Tanlov qoidadagi ro‘yxatga mos kelmaydi.", e));
          return;
        }
        if (code === "InsufficientStock") {
          setBonusGiftError(withApiSupportLine("Tanlangan bonus uchun omborda qoldiq yetarli emas.", e));
          return;
        }
      }
      setBonusGiftError(getUserFacingError(e, "Saqlab bo‘lmadi."));
    }
  });

  function updateLine(key: string, patch: Partial<Pick<Line, "productId" | "qty">>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function startEditLines() {
    if (!data) return;
    setLines(paidItemsToLines(data.items));
    setEditError(null);
    setEditingLines(true);
  }

  function cancelEditLines() {
    setEditingLines(false);
    setEditError(null);
  }

  const products = productsQ.data ?? [];
  const loadingProducts = productsQ.isLoading;

  const saveLines = () => {
    setEditError(null);
    const items: { product_id: number; qty: number }[] = [];
    const selected = new Set<number>();
    for (const line of lines) {
      const pid = Number.parseInt(line.productId, 10);
      const q = Number.parseFloat(line.qty.replace(",", "."));
      if (!Number.isFinite(pid) || pid < 1) continue;
      if (selected.has(pid)) {
        setEditError("Bir xil mahsulotni bir nechta qatorga qo‘shib bo‘lmaydi.");
        return;
      }
      selected.add(pid);
      if (!Number.isFinite(q) || q <= 0) {
        setEditError("Barcha qatorlarda miqdor musbat bo‘lsin.");
        return;
      }
      items.push({ product_id: pid, qty: q });
    }
    if (items.length === 0) {
      setEditError("Kamida bitta to‘liq qator (mahsulot + miqdor) kerak.");
      return;
    }
    patchLinesMut.mutate(items);
  };

  const itemAggregates = useMemo(() => {
    if (!data?.items) {
      return {
        vol: 0,
        wgt: 0,
        paidQty: 0,
        paidTotal: 0,
        bonusQty: 0,
        bonusTotal: 0,
        weightedDiscountPct: null as string | null
      };
    }
    let vol = 0;
    let wgt = 0;
    let paidQty = 0;
    let paidTotal = 0;
    let bonusQty = 0;
    let bonusTotal = 0;
    let discW = 0;
    let discSum = 0;
    for (const i of data.items) {
      vol += parseDec(i.line_volume_m3);
      wgt += parseDec(i.line_weight_kg);
      const q = parseDec(i.qty);
      const t = parseDec(i.total);
      if (i.is_bonus) {
        bonusQty += q;
        bonusTotal += t;
      } else {
        paidQty += q;
        paidTotal += t;
        if (i.discount_pct != null && i.discount_pct !== "") {
          discW += q;
          discSum += q * parseDec(i.discount_pct);
        }
      }
    }
    const weightedDiscountPct =
      discW > 0 ? (discSum / discW).toFixed(2) : null;
    return { vol, wgt, paidQty, paidTotal, bonusQty, bonusTotal, weightedDiscountPct };
  }, [data?.items]);

  if (!tenantSlug) {
    return <p className="text-sm text-destructive">Tenant aniqlanmadi.</p>;
  }

  // Print view — render only when user clicks print button
  if (showPrintView && data) {
    return (
      <OrderPrintView
        order={{
          id: data.id,
          number: data.number,
          status: data.status,
          total_sum: data.total_sum,
          bonus_sum: data.bonus_sum ?? "0",
          comment: data.comment,
          created_at: data.created_at,
          client_name: data.client_name,
          client_address: null,
          client_phone: null,
          client_inn: null,
          warehouse_name: data.warehouse_name,
          agent_name: data.agent_name
        }}
        items={(data.items ?? []).map((item) => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          unit: "dona",
          qty: item.qty,
          price: item.price,
          total: item.total,
          is_bonus: item.is_bonus
        }))}
      />
    );
  }

  if (!enabled) {
    return <p className="text-sm text-destructive">Noto’g’ri zakaz identifikatori.</p>;
  }

  const requestTypeLabel = data?.request_type_ref?.trim()
    ? refEntryLabelByStored(
        profileRefsQ.data?.references?.request_type_entries,
        data.request_type_ref
      ) ?? data.request_type_ref
    : null;

  return (
    <div className="text-sm">
      {isLoading ? (
        <OrderDetailSkeleton />
      ) : isError || !data ? (
        <Card className="overflow-hidden rounded-xl border border-border">
          <CardContent className="py-8">
            <QueryErrorState
              message={getUserFacingError(error, "Yuklab bo‘lmadi yoki zakaz topilmadi.")}
              onRetry={() => void refetch()}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <OrderInfoCard
              data={data}
              requestTypeLabel={requestTypeLabel}
              canOperate={canOperate}
              commentDraft={commentDraft}
              onCommentChange={setCommentDraft}
              onCommentSave={() => metaMut.mutate({ comment: commentDraft.trim() || null })}
              commentSaving={metaMut.isPending}
              commentSaveError={commentSaveError}
            />
            <ClientInfoCard data={data} />
            <OrderProductsTable
              data={data}
              canEditOrderLines={canEditOrderLines}
              isOperatorHint={isOperatorLikeWebRole(role) && ORDER_LINES_EDITABLE_STATUSES.has(data.status)}
              editingLines={editingLines}
              onStartEdit={startEditLines}
              lines={lines}
              products={products}
              loadingProducts={loadingProducts}
              editError={editError}
              patchPending={patchLinesMut.isPending}
              onUpdateLine={updateLine}
              onAddLine={addLine}
              onRemoveLine={removeLine}
              onSave={saveLines}
              onCancel={cancelEditLines}
              itemAggregates={itemAggregates}
            />
          </div>
          <div className="space-y-4">
            <OrderDetailStatusSection
              data={data}
              tenantSlug={tenantSlug}
              effectiveRole={role}
              statusPending={statusMut.isPending}
              statusError={statusError ?? undefined}
              onStatusChange={(id, status) => statusMut.mutate({ status })}
            />
            <OrderApprovalPanel
              tenantSlug={tenantSlug}
              orderId={orderId}
              orderStatus={data.status}
              approvalStatus={data.approval_status}
            />
            <OrderSummaryTiles
              volumeM3={itemAggregates.vol}
              weightKg={itemAggregates.wgt}
              quantity={data.qty}
              totalSum={data.total_sum}
            />
            <OrderBonusSection
              data={data}
              itemAggregates={itemAggregates}
              canEditOrderLines={canEditOrderLines}
              editingLines={editingLines}
              bonusGiftError={bonusGiftError}
              bonusGiftPending={bonusGiftMut.isPending}
              onBonusGiftChange={(ruleId, productId) =>
                bonusGiftMut.mutate({ ruleId, productId })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
