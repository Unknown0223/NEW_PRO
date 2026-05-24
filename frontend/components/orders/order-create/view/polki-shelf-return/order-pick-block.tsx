"use client";

import { Gift } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { orderStatusLabelRu, parsePriceAmount, parseStockQty, polkiOrderRowHasBonus } from "../../utils";

export function OrderPickBlock({ vm }: { vm: OrderCreateVm }) {
  const {
    canPickWarehouse,
    isPolkiByOrder,
    polkiOrderIdSet,
    polkiOrderIds,
    polkiOrderPickHalfLists,
    polkiOrdersForPick,
    polkiOrdersPickQ,
    polkiOrdersPickRawCount,
    selectPolkiOrder
  } = vm;

  if (!isPolkiByOrder) return null;

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium">Заказ для возврата</Label>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Только статус{" "}
            <span className="font-medium text-foreground">«{orderStatusLabelRu("delivered")}»</span>; выберите один
            заказ.
          </p>
        </div>
      </div>
      <div className="mt-1.5 overflow-x-auto rounded border border-border/80 bg-background">
        {!canPickWarehouse ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">Сначала клиент.</p>
        ) : polkiOrdersPickQ.isLoading ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">Загрузка…</p>
        ) : polkiOrdersForPick.length === 0 ? (
          polkiOrdersPickRawCount > 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">
              Нет заказов со статусом «{orderStatusLabelRu("delivered")}». Возврат с полки по заказу возможен только
              после доставки (сейчас у клиента есть заказы в статусах вроде «{orderStatusLabelRu("new")}», «
              {orderStatusLabelRu("confirmed")}» и т.д.).
            </p>
          ) : (
            <p className="px-2 py-2 text-[11px] text-destructive/90">Нет заказов у клиента.</p>
          )
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {polkiOrderPickHalfLists
              .filter((chunk) => chunk.length > 0)
              .map((chunk, colIdx) => (
                <div key={colIdx} className="min-w-0 overflow-x-auto">
                  <div className="max-h-[min(48vh,24rem)] overflow-y-auto rounded border border-border/60 bg-background/80">
                    <table className="w-full min-w-[280px] border-collapse text-left text-[11px]">
                      <thead className="sticky top-0 z-[1] border-b border-border/80 bg-muted/40 backdrop-blur-sm">
                        <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="w-8 px-1 py-1 text-center" title="Выбор">
                            ✓
                          </th>
                          <th className="px-1.5 py-1">Номер</th>
                          <th className="px-1.5 py-1">Дата</th>
                          <th className="min-w-[5rem] px-1.5 py-1">Склад</th>
                          <th className="px-1.5 py-1 text-right tabular-nums">Кол-во</th>
                          <th className="px-1.5 py-1 text-right tabular-nums">Сумма</th>
                          <th className="w-10 px-1 py-1 text-center" title="Бонус">
                            Бон.
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((o) => {
                          const dateStr = o.created_at ? String(o.created_at).slice(0, 10) : "—";
                          const hasBonus = polkiOrderRowHasBonus(o);
                          const rowSelected = polkiOrderIdSet.has(o.id);
                          const qtyDisp =
                            o.qty != null && String(o.qty).trim() !== ""
                              ? formatNumberGrouped(parseStockQty(o.qty), { maxFractionDigits: 3 })
                              : "—";
                          const sumDisp =
                            o.total_sum != null && String(o.total_sum).trim() !== ""
                              ? formatNumberGrouped(parsePriceAmount(o.total_sum), { maxFractionDigits: 0 })
                              : "—";

                          return (
                            <tr
                              key={o.id}
                              tabIndex={0}
                              aria-selected={rowSelected}
                              aria-label={`Заказ ${o.number}, ${rowSelected ? "выбран" : "не выбран"}, нажмите Enter для переключения`}
                              data-selected={rowSelected ? "true" : undefined}
                              className={cn(
                                "border-b border-border/50 last:border-0 bg-transparent outline-none transition-[background-color,box-shadow] duration-150 select-none",
                                rowSelected
                                  ? "cursor-pointer bg-teal-100/85 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.35)] hover:bg-teal-100 dark:bg-teal-950/50 dark:shadow-[inset_0_0_0_1px_rgba(45,212,191,0.28)] dark:hover:bg-teal-950/60"
                                  : "cursor-pointer hover:bg-muted/50"
                              )}
                              onClick={() => selectPolkiOrder(o.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  selectPolkiOrder(o.id);
                                }
                              }}
                            >
                              <td className="px-1 py-0.5 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="radio"
                                  name="polki-order-pick-inline"
                                  className="border-input"
                                  checked={rowSelected}
                                  onChange={() => selectPolkiOrder(o.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Заказ ${o.number}`}
                                />
                              </td>
                              <td className="px-1.5 py-0.5 align-middle font-mono font-medium">{o.number}</td>
                              <td className="px-1.5 py-0.5 align-middle tabular-nums text-muted-foreground">{dateStr}</td>
                              <td
                                className="max-w-[7rem] truncate px-1.5 py-0.5 align-middle text-muted-foreground"
                                title={o.warehouse_name?.trim() ? o.warehouse_name : undefined}
                              >
                                {o.warehouse_name?.trim() ? o.warehouse_name : "—"}
                              </td>
                              <td className="px-1.5 py-0.5 align-middle text-right tabular-nums">{qtyDisp}</td>
                              <td className="px-1.5 py-0.5 align-middle text-right tabular-nums">{sumDisp}</td>
                              <td className="px-1 py-0.5 align-middle text-center">
                                {hasBonus ? (
                                  <span
                                    className="inline-flex items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 p-0.5 text-amber-900 dark:text-amber-100"
                                    title="В заказе есть бонусные позиции"
                                  >
                                    <Gift className="size-3.5 shrink-0" aria-hidden />
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      {polkiOrdersForPick.length > 0 && polkiOrderIds.length === 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Клик по строке или по флажку — отметить заказ; в возврат попадут только отмеченные.
        </p>
      ) : null}
      {polkiOrderIds.length > 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Выбрано заказов: {polkiOrderIds.length}. Состав возврата и проведение — только по этим заказам (можно одну
          или несколько строк в таблице).
        </p>
      ) : null}
    </div>
  );
}
