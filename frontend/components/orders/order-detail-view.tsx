"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { refEntryLabelByStored } from "@/lib/profile-ref-entries";
import type { ProductRow } from "@/lib/product-types";
import { OrderPrintView } from "./order-print-view";
import { QueryErrorState } from "@/components/common/query-error-state";
import axios, { type AxiosError } from "axios";
import { useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole, isOperatorLikeWebRole } from "@/lib/distribution-roles";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Copy, Hash, Package, Scale, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-3 sm:py-1.5">
      <div className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-sm leading-snug">{children}</div>
    </div>
  );
}

function parseDec(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number.parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="h-64 rounded-2xl border border-border/60 bg-muted/30 xl:col-span-5" />
        <div className="h-64 rounded-2xl border border-border/60 bg-muted/30 xl:col-span-4" />
        <div className="h-64 rounded-2xl border border-border/60 bg-muted/30 xl:col-span-3" />
      </div>
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3 xl:col-span-8">
          <div className="h-4 w-1/3 rounded bg-muted/50" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-2 border-b border-border/40 py-2 last:border-0">
              <div className="h-3 flex-1 rounded bg-muted/40" />
              <div className="h-3 w-16 rounded bg-muted/40" />
              <div className="h-3 w-20 rounded bg-muted/40" />
            </div>
          ))}
        </div>
        <div className="h-40 rounded-2xl border border-border/60 bg-muted/30 xl:col-span-4" />
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-base font-semibold tabular-nums leading-tight text-foreground">{value}</div>
    </div>
  );
}

export type OrderListRow = {
  id: number;
  number: string;
  order_type: string | null;
  client_id: number;
  client_name: string;
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
  qty: string;
  total_sum: string;
  /** Bonus mahsulotlar jami donasi (API yangilangach doim keladi) */
  bonus_qty?: string;
  /** Foizli chegirma summasi */
  discount_sum?: string;
  /** Bonus qatorlarining narxlangan qiymati */
  bonus_sum: string;
  balance: string | null;
  debt: string | null;
  price_type: string | null;
  comment: string | null;
  /** «Причины заявок» kod/nom */
  request_type_ref?: string | null;
  created_at: string;
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
  const [summaryTab, setSummaryTab] = useState<string | null>("total");

  useEffect(() => {
    setEditingLines(false);
    setEditError(null);
    setLines([newLine()]);
    setCommentDraft("");
    setCommentSaveError(null);
    setSummaryTab("total");
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

  const readOnlyHint =
    "Faqat to‘lov qatorlari tahrirlanadi; bonuslar qayta hisoblanadi (avtomatik qoidalar bo‘yicha).";

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

  return (
    <div className="flex flex-col gap-4 text-sm">
      {isLoading ? (
        <OrderDetailSkeleton />
      ) : isError || !data ? (
        <Card className="overflow-hidden rounded-2xl border border-border/80">
          <CardContent className="py-8">
            <QueryErrorState
              message={getUserFacingError(error, "Yuklab bo‘lmadi yoki zakaz topilmadi.")}
              onRetry={() => void refetch()}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-sm xl:col-span-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold tracking-tight">Информация о заявке</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 pb-3 pt-0 sm:px-4">
                <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-6">
                  <div className="divide-y divide-border/50">
                    <DetailField label="Agent">{data.agent_display ?? "—"}</DetailField>
                    <DetailField label="Ekspeditor">{data.expeditor_display ?? data.expeditors ?? "—"}</DetailField>
                    <DetailField label="Ombor">{data.warehouse_name ?? "—"}</DetailField>
                    <DetailField label="Yig‘ish bloki">
                      {data.warehouse_block_name?.trim() ? data.warehouse_block_name : "—"}
                    </DetailField>
                    <DetailField label="Savdo yo‘nalishi">
                      {data.agent_trade_direction?.trim() ? (
                        <Badge variant="secondary" className="font-normal">
                          {data.agent_trade_direction}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label="Narx turi">
                      {data.payment_method_label?.trim() ? (
                        <Badge variant="outline" className="font-normal">
                          {data.payment_method_label}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label="Chegirma">
                      {Number(data.discount_sum ?? 0) > 0 ? (
                        <Badge variant="secondary" className="font-normal">
                          Avto
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DetailField>
                    <DetailField label="Bonus">
                      <Badge variant="secondary" className="font-normal">
                        {data.apply_bonus ? "Avto" : "Yo‘q"}
                      </Badge>
                    </DetailField>
                  </div>
                  <div className="divide-y divide-border/50">
                    <DetailField label="Yaratilgan">
                      {new Date(data.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short"
                      })}
                    </DetailField>
                    <DetailField label="Kim yaratgan">
                      {data.created_by?.trim() || data.created_by_role?.trim()
                        ? [data.created_by, data.created_by_role].filter((x) => x?.trim()).join(" · ")
                        : "—"}
                    </DetailField>
                    <DetailField label="Jo‘natish (reja)">
                      {data.expected_ship_date
                        ? new Date(data.expected_ship_date).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short"
                          })
                        : "—"}
                    </DetailField>
                    <DetailField label="Jo‘natilgan">
                      {data.shipped_at
                        ? new Date(data.shipped_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short"
                          })
                        : "—"}
                    </DetailField>
                    <DetailField label="Qaytgan / yetkazilgan">
                      {data.delivered_at
                        ? new Date(data.delivered_at).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short"
                          })
                        : "—"}
                    </DetailField>
                    <DetailField label="Konsignatsiya">
                      {data.is_consignment ? (
                        <span>
                          <Badge className="font-normal">Ha</Badge>
                          {data.consignment_due_date ? (
                            <span className="ml-2 text-muted-foreground">
                              muddat:{" "}
                              {new Date(data.consignment_due_date).toLocaleDateString(undefined, {
                                dateStyle: "short"
                              })}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label="Lokatsiya">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {data.client_gps_text?.trim() ||
                            (data.client_latitude != null && data.client_longitude != null
                              ? `${data.client_latitude}, ${data.client_longitude}`
                              : "—")}
                        </span>
                        {(data.client_gps_text?.trim() ||
                          (data.client_latitude != null && data.client_longitude != null)) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Nusxa"
                            onClick={() => {
                              const t =
                                data.client_gps_text?.trim() ||
                                `${data.client_latitude ?? ""}, ${data.client_longitude ?? ""}`;
                              void navigator.clipboard.writeText(t);
                            }}
                          >
                            <Copy className="size-3.5" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </DetailField>
                  </div>
                </div>
                {data.request_type_ref?.trim() ? (
                  <DetailField label="Заявка turi">
                    <span className="text-muted-foreground">
                      {refEntryLabelByStored(
                        profileRefsQ.data?.references?.request_type_entries,
                        data.request_type_ref
                      ) ?? data.request_type_ref}
                    </span>
                  </DetailField>
                ) : null}
                {canOperate && data.status !== "cancelled" ? (
                  <div className="rounded-lg border border-border/60 bg-muted/15 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Izoh</p>
                    <textarea
                      className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={commentDraft}
                      onChange={(e) => {
                        setCommentDraft(e.target.value);
                        if (commentSaveError) setCommentSaveError(null);
                      }}
                      maxLength={4000}
                      disabled={metaMut.isPending}
                      placeholder="Ichki izoh…"
                    />
                    {commentSaveError ? (
                      <p className="mt-1.5 text-xs text-destructive" role="alert">
                        {commentSaveError}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 h-9 w-fit"
                      disabled={metaMut.isPending}
                      onClick={() => metaMut.mutate({ comment: commentDraft.trim() || null })}
                    >
                      {metaMut.isPending ? "Saqlanmoqda…" : "Izohni saqlash"}
                    </Button>
                  </div>
                ) : (
                  <DetailField label="Izoh">
                    <span className="whitespace-pre-wrap text-muted-foreground">
                      {data.comment?.trim() ? data.comment : "—"}
                    </span>
                  </DetailField>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-sm xl:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold tracking-tight">Информация о клиенте</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 px-3 pb-3 pt-0 sm:flex-row sm:px-4">
                <div className="flex size-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 px-1 text-center text-[10px] text-muted-foreground">
                  <User className="size-8 opacity-50" aria-hidden />
                  <span className="leading-tight">Foto yo‘q</span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-lg font-bold leading-tight">
                      {tenantSlug ? (
                        <Link
                          href={`/clients/${data.client_id}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {data.client_name}
                        </Link>
                      ) : (
                        data.client_name
                      )}
                    </p>
                    {data.client_legal_name?.trim() ? (
                      <p className="text-xs text-muted-foreground">{data.client_legal_name}</p>
                    ) : null}
                    {tenantSlug ? (
                      <Link
                        href={`/clients/${data.client_id}`}
                        className="text-xs font-mono text-primary underline-offset-2 hover:underline"
                      >
                        id_{data.client_id}
                      </Link>
                    ) : null}
                  </div>
                  <DetailField label="Mas’ul / kontakt">
                    {data.client_responsible_person?.trim() ? data.client_responsible_person : "—"}
                  </DetailField>
                  <div className="flex flex-wrap gap-2">
                    {data.region?.trim() ? (
                      <Badge variant="outline" className="font-normal">
                        {data.region}
                      </Badge>
                    ) : null}
                    {data.city?.trim() ? (
                      <Badge variant="outline" className="font-normal">
                        {data.city}
                      </Badge>
                    ) : null}
                    {data.zone?.trim() ? (
                      <Badge variant="outline" className="font-normal">
                        {data.zone}
                      </Badge>
                    ) : null}
                    {data.client_category?.trim() ? (
                      <Badge variant="secondary" className="font-normal">
                        {data.client_category}
                      </Badge>
                    ) : null}
                  </div>
                  <DetailField label="Zakaz bo‘yicha qarz">
                    <span className="tabular-nums font-medium">{data.debt ?? "—"}</span>
                  </DetailField>
                  <DetailField label="Balans">
                    <span
                      className={cn(
                        "tabular-nums font-semibold",
                        data.balance != null && parseDec(data.balance) < 0 && "text-destructive",
                        data.balance != null && parseDec(data.balance) > 0 && "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {data.balance ?? "—"}
                    </span>
                  </DetailField>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-sm xl:col-span-3">
              <CardHeader className="space-y-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="shrink-0 font-normal">{ORDER_STATUS_LABELS[data.status] ?? data.status}</Badge>
                </div>
                <CardTitle className="text-xs font-medium text-muted-foreground">Сводка</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 px-3 pb-3 sm:px-4">
                <MetricTile
                  icon={<Package className="text-emerald-600 dark:text-emerald-400" aria-hidden />}
                  label="Hajm (m³)"
                  value={
                    itemAggregates.vol > 0
                      ? `${formatNumberGrouped(String(itemAggregates.vol), { maxFractionDigits: 4 })} m³`
                      : "0 m³"
                  }
                />
                <MetricTile
                  icon={<Scale className="text-rose-600 dark:text-rose-400" aria-hidden />}
                  label="Og‘irlik (kg)"
                  value={
                    itemAggregates.wgt > 0
                      ? `${formatNumberGrouped(String(itemAggregates.wgt), { maxFractionDigits: 2 })} kg`
                      : "—"
                  }
                />
                <MetricTile
                  icon={<Hash className="text-amber-600 dark:text-amber-400" aria-hidden />}
                  label="Miqdor"
                  value={`${formatNumberGrouped(data.qty, { maxFractionDigits: 3 })} dona`}
                />
                <MetricTile
                  icon={<Banknote className="text-teal-600 dark:text-teal-400" aria-hidden />}
                  label="Jami summa"
                  value={formatNumberGrouped(data.total_sum, { maxFractionDigits: 2 })}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-sm xl:col-span-8">
              <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base font-semibold tracking-tight">Товары</CardTitle>
                  <CardDescription className="text-[11px] leading-relaxed">{readOnlyHint}</CardDescription>
                  {isOperatorLikeWebRole(role) && ORDER_LINES_EDITABLE_STATUSES.has(data.status) ? (
                    <p className="text-[11px] text-amber-800 dark:text-amber-200/90">
                      Qatorlarni tahrirlash faqat admin.
                    </p>
                  ) : null}
                </div>
                {canEditOrderLines && !editingLines ? (
                  <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0 text-xs" onClick={startEditLines}>
                    Tahrirlash
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {canEditOrderLines && editingLines ? (
                  <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3">
                    {editError ? (
                      <p className="px-1 text-xs text-destructive" role="alert">
                        {editError}
                      </p>
                    ) : null}
                    {loadingProducts ? (
                      <p className="px-1 text-xs text-muted-foreground">Mahsulotlar yuklanmoqda…</p>
                    ) : null}
                    <div className="overflow-x-auto rounded-md border border-border/60 bg-background">
                      <table className="w-full table-auto border-collapse text-xs">
                        <thead className="app-table-thead">
                          <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Mahsulot</th>
                            <th className="w-28 px-3 py-2 font-medium">Miqdor</th>
                            <th className="w-24 px-3 py-2 text-right font-medium">Amallar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.key} className="border-b border-border last:border-0">
                              <td className="px-3 py-2 align-middle">
                                <select
                                  className="h-9 w-full max-w-xl rounded-md border border-input bg-background px-2 text-xs"
                                  value={line.productId}
                                  onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                                  disabled={patchLinesMut.isPending || loadingProducts}
                                >
                                  <option value="">— tanlang —</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={String(p.id)}>
                                      {p.sku} — {p.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 align-middle">
                                <Input
                                  type="number"
                                  min={0.001}
                                  step="any"
                                  className="h-9 text-xs"
                                  value={line.qty}
                                  onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                                  disabled={patchLinesMut.isPending}
                                />
                              </td>
                              <td className="px-3 py-2 align-middle text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 text-xs"
                                  disabled={patchLinesMut.isPending || lines.length <= 1}
                                  onClick={() => removeLine(line.key)}
                                >
                                  O‘chirish
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs"
                        onClick={addLine}
                        disabled={patchLinesMut.isPending}
                      >
                        + Qator
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 text-xs"
                        disabled={patchLinesMut.isPending || loadingProducts}
                        onClick={saveLines}
                      >
                        {patchLinesMut.isPending ? "Saqlanmoqda…" : "Saqlash"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs"
                        disabled={patchLinesMut.isPending}
                        onClick={cancelEditLines}
                      >
                        Bekor
                      </Button>
                    </div>
                  </div>
                ) : null}

                {data.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 py-8 text-center text-sm text-muted-foreground">
                    Товары отсутствуют
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
                      <colgroup>
                        <col style={{ width: `${(100 * 35) / 110}%` }} />
                        <col style={{ width: `${(100 * 15) / 110}%` }} />
                        <col style={{ width: `${(100 * 10) / 110}%` }} />
                        <col style={{ width: `${(100 * 10) / 110}%` }} />
                        <col style={{ width: `${(100 * 10) / 110}%` }} />
                        <col style={{ width: `${(100 * 10) / 110}%` }} />
                        <col style={{ width: `${(100 * 20) / 110}%` }} />
                      </colgroup>
                      <thead className="bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <tr className="border-b border-border/60">
                          <th className="px-2 py-2 sm:px-3">Ассортимент</th>
                          <th className="px-2 py-2 text-right sm:px-3">Цена</th>
                          <th className="px-2 py-2 sm:px-3">Блок</th>
                          <th className="px-2 py-2 text-right sm:px-3">Кол-во</th>
                          <th className="px-2 py-2 text-right sm:px-3">Объем</th>
                          <th className="px-2 py-2 text-right sm:px-3">Скидка</th>
                          <th className="px-2 py-2 text-right sm:px-3">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((i) => (
                          <tr
                            key={i.id}
                            className={cn(
                              "border-b border-border/50",
                              i.is_bonus && "bg-emerald-500/[0.06]"
                            )}
                          >
                            <td className="px-2 py-1.5 align-top sm:px-3 sm:py-2">
                              <span className="line-clamp-2 font-medium leading-snug">{i.name}</span>
                              <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{i.sku}</span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">
                              {formatNumberGrouped(i.price, { maxFractionDigits: 2 })}
                            </td>
                            <td className="truncate px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                              {data.warehouse_block_name?.trim() || "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">
                              {formatNumberGrouped(i.qty, { maxFractionDigits: 3 })}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground sm:px-3 sm:py-2">
                              {i.line_volume_m3 != null && i.line_volume_m3 !== ""
                                ? formatNumberGrouped(i.line_volume_m3, { maxFractionDigits: 4 })
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">
                              {i.discount_pct != null ? `${i.discount_pct}%` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-medium sm:px-3 sm:py-2">
                              {formatNumberGrouped(i.total, { maxFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-border bg-muted/30 text-[11px] font-semibold sm:text-xs">
                        <tr>
                          <td colSpan={3} className="px-2 py-2 sm:px-3">
                            Итого
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums sm:px-3">
                            {formatNumberGrouped(
                              String(
                                data.items.reduce((acc, i) => acc + parseDec(i.qty), 0)
                              ),
                              { maxFractionDigits: 3 }
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums sm:px-3">
                            {itemAggregates.vol > 0
                              ? formatNumberGrouped(String(itemAggregates.vol), { maxFractionDigits: 4 })
                              : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums sm:px-3">
                            {itemAggregates.weightedDiscountPct != null
                              ? `${itemAggregates.weightedDiscountPct}%`
                              : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums sm:px-3">
                            {formatNumberGrouped(
                              String(data.items.reduce((acc, i) => acc + parseDec(i.total), 0)),
                              { maxFractionDigits: 2 }
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-sm xl:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold tracking-tight">Итог / бонусы</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={summaryTab} onValueChange={setSummaryTab}>
                  <TabsList className="mb-3 h-auto w-full flex-wrap justify-start gap-1 p-1">
                    <TabsTrigger value="total" className="text-xs sm:text-sm">
                      Итог по заказам
                    </TabsTrigger>
                    <TabsTrigger value="bonus" className="text-xs sm:text-sm">
                      Бонусы
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="total" className="mt-0">
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full table-fixed border-collapse text-xs">
                        <colgroup>
                          <col style={{ width: "60%" }} />
                          <col style={{ width: "20%" }} />
                          <col style={{ width: "20%" }} />
                        </colgroup>
                        <thead className="bg-muted/40 text-left text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Название</th>
                            <th className="px-2 py-1.5 text-right font-medium">Кол-во</th>
                            <th className="px-2 py-1.5 text-right font-medium">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items
                            .filter((i) => !i.is_bonus)
                            .map((i) => (
                              <tr key={i.id} className="border-t border-border/50">
                                <td className="truncate px-2 py-1.5">{i.name}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">
                                  {formatNumberGrouped(i.qty, { maxFractionDigits: 3 })}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums">
                                  {formatNumberGrouped(i.total, { maxFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t border-border bg-muted/25 font-medium">
                          <tr>
                            <td className="px-2 py-1.5">Итого</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {formatNumberGrouped(String(itemAggregates.paidQty), { maxFractionDigits: 3 })}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {formatNumberGrouped(String(itemAggregates.paidTotal), { maxFractionDigits: 2 })}
                            </td>
                          </tr>
                          <tr className="border-t border-border/50 text-muted-foreground">
                            <td colSpan={2} className="px-2 py-1.5">
                              Chegirma (zakaz)
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {Number(data.discount_sum ?? 0) > 0
                                ? formatNumberGrouped(data.discount_sum, { maxFractionDigits: 0 })
                                : "—"}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </TabsContent>
                  <TabsContent value="bonus" className="mt-0 space-y-4">
                    {canEditOrderLines && (data.bonus_gift_swap_options?.length ?? 0) > 0 && !editingLines ? (
                      <div className="space-y-3 rounded-lg border border-emerald-500/35 bg-emerald-500/[0.04] p-3">
                        <p className="text-sm font-semibold text-foreground">Bonus sovg‘asini almashtirish</p>
                        {bonusGiftError ? (
                          <p className="text-xs text-destructive" role="alert">
                            {bonusGiftError}
                          </p>
                        ) : null}
                        <div className="space-y-3">
                          {(data.bonus_gift_swap_options ?? []).map((opt) => (
                            <div
                              key={opt.bonus_rule_id}
                              className="flex flex-col gap-2 rounded-md border border-border/80 bg-card p-3 sm:flex-row sm:items-end sm:justify-between"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-xs font-medium text-foreground">{opt.rule_name}</p>
                                <label className="block text-[11px] text-muted-foreground">
                                  Sovg‘a mahsuloti
                                  <select
                                    className="mt-1 h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm"
                                    value={String(opt.chosen_product_id)}
                                    disabled={bonusGiftMut.isPending}
                                    onChange={(e) => {
                                      const pid = Number.parseInt(e.target.value, 10);
                                      if (!Number.isFinite(pid) || pid < 1) return;
                                      bonusGiftMut.mutate({ ruleId: opt.bonus_rule_id, productId: pid });
                                    }}
                                  >
                                    {opt.products.map((p) => (
                                      <option key={p.id} value={String(p.id)}>
                                        {p.sku} — {p.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {data.items.filter((i) => i.is_bonus).length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">Бонусные позиции отсутствуют</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full table-fixed border-collapse text-xs">
                          <colgroup>
                            <col style={{ width: "60%" }} />
                            <col style={{ width: "20%" }} />
                            <col style={{ width: "20%" }} />
                          </colgroup>
                          <thead className="bg-muted/40 text-left text-muted-foreground">
                            <tr>
                              <th className="px-2 py-1.5 font-medium">Название</th>
                              <th className="px-2 py-1.5 text-right font-medium">Кол-во</th>
                              <th className="px-2 py-1.5 text-right font-medium">Сумма</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.items
                              .filter((i) => i.is_bonus)
                              .map((i) => (
                                <tr key={i.id} className="border-t border-border/50">
                                  <td className="truncate px-2 py-1.5">{i.name}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {formatNumberGrouped(i.qty, { maxFractionDigits: 3 })}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">
                                    {formatNumberGrouped(i.total, { maxFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                          <tfoot className="border-t border-border bg-muted/25 font-medium">
                            <tr>
                              <td className="px-2 py-1.5">Итого</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {formatNumberGrouped(String(itemAggregates.bonusQty), { maxFractionDigits: 3 })}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {formatNumberGrouped(String(itemAggregates.bonusTotal), { maxFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>


        </>
      )}
    </div>
  );

}
