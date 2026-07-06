"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { DailyReturnWaybillPrintView } from "./daily-return-waybill-print-view";

export type DailyWaybillRef = {
  courier_id: number;
  courier_name: string | null;
  date: string;
  status: "pending" | "posted" | "cancelled";
};

type Detail = {
  courier_id: number;
  courier_name: string | null;
  creation_channel: "web" | "mobile";
  date: string;
  created_at: string;
  warehouse_name: string;
  status: "pending" | "posted" | "cancelled";
  pending_count: number;
  accepted_at: string | null;
  total_qty: number;
  refund_total: string;
  lines: {
    product_id: number;
    sku: string;
    name: string;
    qty: string;
    category_id: number | null;
    category_name: string | null;
  }[];
  returns: {
    id: number;
    number: string;
    status: string;
    client_name: string | null;
    order_number: string | null;
    qty: string;
    refund_amount: string | null;
  }[];
};

function fmtQty(n: string | number): string {
  const v = typeof n === "number" ? n : Number.parseFloat(n);
  if (!Number.isFinite(v)) return String(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает приёмки",
  posted: "Принят",
  cancelled: "Отклонён"
};

export function DailyReturnWaybillModal({
  slug,
  waybill,
  canAccept,
  startInConfirm = false,
  onClose
}: {
  slug: string;
  waybill: DailyWaybillRef;
  canAccept: boolean;
  startInConfirm?: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [printing, setPrinting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(startInConfirm);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const detailQ = useQuery({
    queryKey: ["daily-return-waybill", slug, waybill.courier_id, waybill.date],
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await api.get<Detail>(
        `/api/${slug}/returns/daily-waybills/${waybill.courier_id}/${waybill.date}`
      );
      return data;
    }
  });

  const acceptMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(
        `/api/${slug}/returns/daily-waybills/${waybill.courier_id}/${waybill.date}/accept`,
        {}
      );
      return data as { accepted_count: number };
    },
    onSuccess: () => {
      setError(null);
      setConfirmStep(false);
      void queryClient.invalidateQueries({ queryKey: ["return-invoices"] });
      void queryClient.invalidateQueries({
        queryKey: ["daily-return-waybill", slug, waybill.courier_id, waybill.date]
      });
    },
    onError: (e) => setError(getUserFacingError(e, "Не удалось принять накладную."))
  });

  const detail = detailQ.data;

  const grouped = useMemo(() => {
    if (!detail) return [] as { key: string; name: string; lines: Detail["lines"]; qty: number }[];
    const map = new Map<string, { key: string; name: string; lines: Detail["lines"]; qty: number }>();
    for (const l of detail.lines) {
      const key = l.category_id != null ? `c${l.category_id}` : "none";
      const name = l.category_name ?? "Без категории";
      const g = map.get(key) ?? { key, name, lines: [], qty: 0 };
      g.lines.push(l);
      g.qty += Number.parseFloat(l.qty) || 0;
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [detail]);

  const allCollapsed = grouped.length > 0 && grouped.every((g) => collapsed.has(g.key));
  const toggleAll = () => {
    setCollapsed(allCollapsed ? new Set() : new Set(grouped.map((g) => g.key)));
  };
  const toggleCat = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const status = detail?.status ?? waybill.status;
  const isPending = status === "pending";
  const dateLabel = new Date(`${waybill.date}T00:00:00`).toLocaleDateString("ru-RU");

  if (printing && detail) {
    return (
      <DailyReturnWaybillPrintView
        detail={{
          courier_name: detail.courier_name,
          date: detail.date,
          warehouse_name: detail.warehouse_name,
          total_qty: detail.total_qty,
          return_count: detail.returns.length,
          lines: detail.lines
        }}
        onClose={() => setPrinting(false)}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent
        showCloseButton={!confirmStep}
        overlayClassName="bg-black/40"
        className="z-[10101] flex max-h-[92vh] w-[min(96vw,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b bg-muted/40 px-5 py-4">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">
              Возвратная накладная · {waybill.courier_name ?? "—"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {dateLabel} ·{" "}
              <span
                className={
                  status === "posted"
                    ? "text-emerald-600"
                    : status === "cancelled"
                      ? "text-rose-600"
                      : "text-amber-600"
                }
              >
                {STATUS_LABELS[status] ?? status}
              </span>
            </p>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!detail}
              onClick={() => setPrinting(true)}
            >
              <Printer className="mr-1 h-3.5 w-3.5" /> Печать / PDF
            </Button>
            {canAccept && isPending && !confirmStep && (
              <Button
                size="sm"
                className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!detail}
                onClick={() => {
                  setError(null);
                  setConfirmStep(true);
                }}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Подтвердить
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {detailQ.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Загрузка…</p>
          ) : detailQ.isError || !detail ? (
            <p className="py-8 text-center text-sm text-rose-600">Не удалось загрузить накладную.</p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-4">
                <Field label="Экспедитор" value={detail.courier_name ?? "—"} />
                <Field
                  label="Источник"
                  value={detail.creation_channel === "mobile" ? "Мобильное" : "Веб"}
                />
                <Field label="Склад" value={detail.warehouse_name || "—"} />
                <Field
                  label="Создано"
                  value={new Date(detail.created_at).toLocaleString("ru-RU")}
                />
              </div>

              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Товары к возврату — по категориям
                </span>
                {grouped.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={toggleAll}
                  >
                    {allCollapsed ? "Развернуть все" : "Свернуть все"}
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border">
                {grouped.map((g) => {
                  const isCollapsed = collapsed.has(g.key);
                  return (
                    <div key={g.key} className="border-b last:border-0">
                      <button
                        type="button"
                        onClick={() => toggleCat(g.key)}
                        className="flex w-full items-center gap-2 bg-muted/50 px-3 py-2 text-left hover:bg-muted"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1 text-sm font-medium">{g.name}</span>
                        <span className="text-xs text-muted-foreground">{g.lines.length} наим.</span>
                        <span className="min-w-[60px] text-right text-sm font-semibold tabular-nums">
                          {fmtQty(g.qty)}
                        </span>
                      </button>
                      {!isCollapsed && (
                        <table className="w-full border-collapse text-sm">
                          <tbody>
                            {g.lines.map((l, i) => (
                              <tr key={l.product_id} className="border-t border-border/60">
                                <td className="w-10 px-2 py-1.5 text-center text-xs text-muted-foreground">
                                  {i + 1}
                                </td>
                                <td className="w-28 px-2 py-1.5 font-mono text-xs">{l.sku}</td>
                                <td className="px-2 py-1.5">{l.name}</td>
                                <td className="w-24 px-2 py-1.5 text-right font-semibold tabular-nums">
                                  {fmtQty(l.qty)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t-2 border-foreground/20 bg-muted/30 px-3 py-2 text-sm font-semibold">
                  <span>ИТОГО</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {detail.lines.length} наим. · {grouped.length} катег.
                  </span>
                  <span className="tabular-nums">{fmtQty(detail.total_qty)}</span>
                </div>
              </div>

              {detail.returns.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Документы в составе ({detail.returns.length})
                  </div>
                  <div className="space-y-1">
                    {detail.returns.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded border border-border/70 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-mono">{r.number}</span>
                        <span className="text-muted-foreground">
                          {[r.client_name, r.order_number ? `Заказ ${r.order_number}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                        <span className="font-semibold tabular-nums">{fmtQty(r.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Irreversible double-confirm step */}
        {confirmStep && (
          <div className="shrink-0 border-t bg-amber-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Подтвердите приёмку возврата
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  После подтверждения товары будут оприходованы на склад, баланс клиента и бонусы
                  обновлены. Дата приёмки — сегодня; дата создания не меняется.
                  <strong> Это действие необратимо и не может быть отменено.</strong>
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={acceptMut.isPending}
                    onClick={() => acceptMut.mutate()}
                  >
                    {acceptMut.isPending ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3.5 w-3.5" />
                    )}
                    Да, подтвердить приёмку
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={acceptMut.isPending}
                    onClick={() => setConfirmStep(false)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium text-foreground">{value}</div>
    </div>
  );
}
