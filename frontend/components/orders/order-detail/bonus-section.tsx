"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function OrderBonusSection({
  data,
  itemAggregates,
  canEditOrderLines,
  editingLines,
  bonusGiftError,
  bonusGiftPending,
  onBonusGiftChange
}: {
  data: OrderDetailRow;
  itemAggregates: {
    paidQty: number;
    paidTotal: number;
    bonusQty: number;
    bonusTotal: number;
  };
  canEditOrderLines: boolean;
  editingLines: boolean;
  bonusGiftError: string | null;
  bonusGiftPending: boolean;
  onBonusGiftChange: (ruleId: number, productId: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<"summary" | "bonuses">("summary");
  const paidItems = data.items.filter((i) => !i.is_bonus);
  const bonusItems = data.items.filter((i) => i.is_bonus);
  const discountDisplay =
    Number(data.discount_sum ?? 0) > 0
      ? formatNumberGrouped(data.discount_sum, { maxFractionDigits: 0 })
      : "0.00%";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "summary"
              ? "bg-teal-600 text-white"
              : "bg-card text-foreground hover:bg-muted/50"
          )}
        >
          Итог по заказом
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bonuses")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "bonuses"
              ? "bg-teal-600 text-white"
              : "bg-card text-foreground hover:bg-muted/50"
          )}
        >
          Бонусы
        </button>
      </div>

      {data.apply_bonus ? (
        <div className="border-b border-border/60 bg-emerald-50 px-4 py-2 dark:bg-emerald-950/30">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            ✓ Авто бонус включен
          </span>
        </div>
      ) : null}

      <div className="p-4">
        {activeTab === "summary" ? (
          <div className="space-y-3">
            {paidItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Нет платных позиций</p>
            ) : (
              paidItems.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"
                >
                  <span className="mr-2 min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {i.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                      {formatNumberGrouped(i.qty, { maxFractionDigits: 3 })} шт
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatNumberGrouped(i.total, { maxFractionDigits: 2 })} So&apos;m
                    </span>
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center justify-between border-t border-border/60 py-2 font-medium">
              <span className="text-sm text-foreground">Итого</span>
              <div className="flex items-center gap-4">
                <span className="rounded bg-teal-600 px-2 py-0.5 text-xs font-medium text-white">
                  {formatNumberGrouped(String(itemAggregates.paidQty), { maxFractionDigits: 3 })}
                </span>
                <span className="rounded bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                  {formatNumberGrouped(String(itemAggregates.paidTotal), { maxFractionDigits: 2 })} So&apos;m
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Скидка</span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {discountDisplay}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {canEditOrderLines && (data.bonus_gift_swap_options?.length ?? 0) > 0 && !editingLines ? (
              <div className="mb-4 space-y-3 rounded-lg border border-emerald-500/35 bg-emerald-500/[0.04] p-3">
                <p className="text-sm font-semibold">Замена бонус-подарка</p>
                {bonusGiftError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {bonusGiftError}
                  </p>
                ) : null}
                {(data.bonus_gift_swap_options ?? []).map((opt) => (
                  <div key={opt.bonus_rule_id} className="space-y-1">
                    <p className="text-xs font-medium">{opt.rule_name}</p>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={String(opt.chosen_product_id)}
                      disabled={bonusGiftPending}
                      onChange={(e) => {
                        const pid = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(pid) && pid > 0) {
                          onBonusGiftChange(opt.bonus_rule_id, pid);
                        }
                      }}
                    >
                      {opt.products.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}

            {bonusItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Бонусные позиции отсутствуют</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
                  <span>Название</span>
                  <span>Кол-во</span>
                  <span>Сумма</span>
                </div>
                {bonusItems.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
                      {formatNumberGrouped(i.qty, { maxFractionDigits: 3 })}
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatNumberGrouped(i.total, { maxFractionDigits: 2 })} So&apos;m
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-sm font-semibold">Итоги</span>
                  <div className="flex items-center gap-4">
                    <span className="rounded bg-teal-600 px-2 py-0.5 text-xs font-medium text-white">
                      {formatNumberGrouped(String(itemAggregates.bonusQty), { maxFractionDigits: 3 })}
                    </span>
                    <span className="rounded bg-teal-600 px-3 py-1 text-xs font-medium text-white">
                      {formatNumberGrouped(String(itemAggregates.bonusTotal), { maxFractionDigits: 2 })} So&apos;m
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
