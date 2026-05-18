"use client";

import { Fragment } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PolkiLinesTableProps } from "./types";
import { MAX_POLKI_RETURN_QTY, POLKI_TABLE_COLS } from "./constants";
import { parsePriceAmount, formatQtyState, polkiSplitTotal } from "./utils";

export function PolkiReturnLinesTable({
  canShowPolkiGrid,
  isPolkiByOrder,
  isPolkiFree,
  polkiLoading,
  polkiError,
  polkiSuccess,
  polkiRowsAllLength,
  polkiOrderGroups,
  polkiTotalQty,
  setPolkiTotalQty,
  polkiBonusToBalance,
  setPolkiBonusToBalance,
  polkiBonusCash,
  setPolkiBonusCash,
  mutationPending,
  polkiTotalReturnQtySum,
  polkiVolumeM3,
  polkiEstimatedSum,
  polkiDebtHintSum
}: PolkiLinesTableProps) {
  const flatRowCount = polkiOrderGroups.reduce((a, g) => a + g.rows.length, 0);
  return (
    <div className="overflow-hidden rounded-lg border border-teal-800/20 bg-card shadow-sm dark:border-teal-800/35">
      <div className="max-h-[min(75vh,920px)] min-h-[220px] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="app-table-thead sticky top-0 z-[1] backdrop-blur-sm">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="min-w-[5rem] px-2 py-1.5">Заказ</th>
              <th className="min-w-[9rem] px-2 py-1.5">Товар</th>
              <th
                className="min-w-[13rem] px-2 py-1.5"
                title={`Введите общее количество по строке (макс. см. подсказку в ячейке). Автораспределение: сначала оплата, затем бонус. В одном документе суммарно не более ${MAX_POLKI_RETURN_QTY} шт на склад, считая и оплату, и бонус (если бонус возвращается на склад).`}
              >
                Дата · всего к возврату
              </th>
              <th className="min-w-[15rem] px-2 py-1.5">Бонус / баланс</th>
              <th className="min-w-[3.5rem] px-2 py-1.5 text-right">m³</th>
            </tr>
          </thead>
          <tbody>
            {!canShowPolkiGrid ? (
              <tr>
                <td
                  colSpan={POLKI_TABLE_COLS}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  Выберите клиента
                  {isPolkiByOrder ? " и заказ" : ""}
                  {isPolkiFree ? " (период опционально)" : ""}.
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiLoading ? (
              <tr>
                <td
                  colSpan={POLKI_TABLE_COLS}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  Загрузка контекста возврата…
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiError ? (
              <tr>
                <td
                  colSpan={POLKI_TABLE_COLS}
                  className="px-3 py-8 text-center text-sm text-destructive"
                >
                  Не удалось загрузить данные. Проверьте параметры и попробуйте снова.
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiSuccess && polkiRowsAllLength === 0 ? (
              <tr>
                <td
                  colSpan={POLKI_TABLE_COLS}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  Нет позиций для возврата за период / по заказу.
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiSuccess && polkiRowsAllLength > 0
              ? polkiOrderGroups.map((g) => (
                  <Fragment key={g.orderId}>
                    <tr className="border-b border-teal-800/20 bg-teal-950/10 dark:bg-teal-950/25">
                      <td
                        colSpan={POLKI_TABLE_COLS}
                        className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100/90"
                      >
                        Заказ {g.orderNumber} · {g.orderDate || "—"}
                      </td>
                    </tr>
                    {g.rows.map((r) => {
                      const pk = r.pair_key;
                      const totalRaw = polkiTotalQty[pk] ?? "";
                      const totalQ = Number.parseFloat(totalRaw.replace(",", "."));
                      const totalOver =
                        Boolean(totalRaw.trim()) &&
                        Number.isFinite(totalQ) &&
                        totalQ > r.max_paid + r.max_bonus;
                      const defer = Boolean(polkiBonusToBalance[pk]);
                      const { effPaid, effBonus } = polkiSplitTotal(
                        r,
                        Number.isFinite(totalQ) ? totalQ : 0
                      );
                      const physBonus = defer ? 0 : effBonus;
                      const volU =
                        r.volume_m3 != null ? Number.parseFloat(String(r.volume_m3)) : NaN;
                      const lineVol =
                        Number.isFinite(volU) && effPaid + physBonus > 0
                          ? (effPaid + physBonus) * volU
                          : 0;
                      const maxTot = r.max_paid + r.max_bonus;
                      const suggestedBonusCash = effBonus * r.unit_price_bonus;
                      const maxCashDefer =
                        r.max_bonus > 0 ? r.max_bonus * r.unit_price_bonus : 0;
                      const maxCashExtra =
                        r.max_bonus > 0
                          ? Math.max(0, (r.max_bonus - physBonus) * r.unit_price_bonus)
                          : 0;
                      const cashRaw = polkiBonusCash[pk] ?? "";
                      const cashParsed = parsePriceAmount(cashRaw);
                      const cashCap = defer ? maxCashDefer : maxCashExtra;
                      const debtLine =
                        defer && effBonus > 0
                          ? Math.max(0, suggestedBonusCash - Math.min(cashParsed, cashCap))
                          : 0;
                      return (
                        <tr
                          key={pk}
                          className="border-b border-border/80 last:border-0 hover:bg-muted/25"
                        >
                          <td className="px-2 py-1.5 align-top font-mono text-[11px] text-muted-foreground">
                            #{r.order_id}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <div className="font-medium leading-snug text-foreground text-[13px]">
                              {r.name}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {[r.sku, r.unit].filter(Boolean).join(" · ")}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <div className="mb-1 text-[11px] text-muted-foreground">
                              Продажа: <span className="font-medium text-foreground">{g.orderDate}</span>
                              {r.unit_price_paid > 0 ? (
                                <span className="ml-1 tabular-nums">
                                  · {formatNumberGrouped(r.unit_price_paid, { maxFractionDigits: 2 })}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              макс всего {formatNumberGrouped(maxTot, { maxFractionDigits: 3 })} шт (опл.{" "}
                              {formatNumberGrouped(r.max_paid, { maxFractionDigits: 3 })} + бон.{" "}
                              {formatNumberGrouped(r.max_bonus, { maxFractionDigits: 3 })})
                            </div>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="0"
                              data-testid="oc-polki-total-qty"
                              data-oc-product-id={r.product_id}
                              className={cn(
                                "mt-1 h-8 w-full max-w-[7rem] tabular-nums text-sm",
                                totalOver && "border-destructive"
                              )}
                              value={totalRaw}
                              onChange={(e) =>
                                setPolkiTotalQty((prev) => ({ ...prev, [pk]: e.target.value }))
                              }
                              onBlur={() => {
                                if (!totalRaw.trim()) return;
                                const n = Number.parseFloat(totalRaw.replace(",", "."));
                                if (!Number.isFinite(n) || n <= 0) return;
                                if (n > maxTot) {
                                  setPolkiTotalQty((prev) => ({
                                    ...prev,
                                    [pk]: formatQtyState(maxTot)
                                  }));
                                }
                              }}
                              disabled={mutationPending || maxTot <= 0}
                            />
                            {Number.isFinite(totalQ) && totalQ > 0 ? (
                              <p className="mt-1 text-[10px] leading-snug text-teal-800 dark:text-teal-200/90">
                                Авто: опл.{" "}
                                <span className="font-semibold tabular-nums">{effPaid}</span>
                                {" · "}
                                бон.{" "}
                                <span className="font-semibold tabular-nums">{effBonus}</span>
                                {defer ? (
                                  <span className="text-muted-foreground"> (бонус → баланс)</span>
                                ) : null}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {r.max_bonus > 0 ? (
                              <>
                                <div className="font-medium leading-snug text-[13px] text-amber-700 dark:text-amber-400">
                                  {r.name} <span className="text-[10px] font-normal">(бонус)</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  макс {formatNumberGrouped(r.max_bonus, { maxFractionDigits: 3 })} шт
                                  {r.unit_price_bonus > 0 ? (
                                    <span className="ml-1 tabular-nums">
                                      · {formatNumberGrouped(r.unit_price_bonus, { maxFractionDigits: 2 })}
                                    </span>
                                  ) : null}
                                </div>
                                <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] leading-tight text-foreground">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input"
                                    checked={defer}
                                    disabled={mutationPending}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setPolkiBonusToBalance((prev) => ({ ...prev, [pk]: on }));
                                      if (on) {
                                        const t = Number.parseFloat(
                                          (polkiTotalQty[pk] ?? "").replace(",", ".")
                                        );
                                        const sp = polkiSplitTotal(
                                          r,
                                          Number.isFinite(t) ? t : 0
                                        );
                                        const sug = sp.effBonus * r.unit_price_bonus;
                                        if (sug > 0) {
                                          setPolkiBonusCash((prev) => ({
                                            ...prev,
                                            [pk]: String(Math.round(sug))
                                          }));
                                        }
                                      }
                                    }}
                                  />
                                  <span>
                                    Бонус не на склад (сумма на баланс / без возврата бонуса)
                                  </span>
                                </label>
                              </>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">Нет бонуса по строке</p>
                            )}
                            <div className="mt-2 border-t border-border/60 pt-2">
                              <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                                {defer
                                  ? `Сумма на баланс (компенсация бонуса), макс ${formatNumberGrouped(maxCashDefer, { maxFractionDigits: 0 })}`
                                  : `Доп. вместо бонуса (баланс), макс ≈ ${formatNumberGrouped(maxCashExtra, { maxFractionDigits: 0 })}`}
                              </p>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                placeholder="0"
                                className="h-8 w-full max-w-[8rem] tabular-nums text-sm"
                                value={cashRaw}
                                onChange={(e) =>
                                  setPolkiBonusCash((prev) => ({ ...prev, [pk]: e.target.value }))
                                }
                                disabled={mutationPending || r.max_bonus <= 0}
                              />
                              {defer && effBonus > 0 && suggestedBonusCash > 0 ? (
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  По бонусу: {effBonus} шт ≈{" "}
                                  {formatNumberGrouped(suggestedBonusCash, { maxFractionDigits: 0 })}{" "}
                                  сум
                                </p>
                              ) : null}
                              {debtLine > 0 ? (
                                <p className="mt-1 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                  К долгу (оценка):{" "}
                                  {formatNumberGrouped(debtLine, { maxFractionDigits: 0 })} — учтите
                                  вручную, если компенсация не внесена.
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground align-middle text-[13px]">
                            {lineVol > 0
                              ? formatNumberGrouped(lineVol, { maxFractionDigits: 4 })
                              : "0"}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              : null}
            {canShowPolkiGrid &&
            polkiSuccess &&
            polkiRowsAllLength > 0 &&
            flatRowCount === 0 ? (
              <tr>
                <td
                  colSpan={POLKI_TABLE_COLS}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  По поиску ничего не найдено.
                </td>
              </tr>
            ) : null}
          </tbody>
          {canShowPolkiGrid && polkiSuccess && !polkiLoading && flatRowCount > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-2 py-2 text-foreground text-sm" colSpan={3}>
                  Итого (на склад, шт · m³ · сумма на баланс)
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-foreground text-sm">
                  {formatNumberGrouped(polkiTotalReturnQtySum, { maxFractionDigits: 3 })}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground text-sm">
                  {formatNumberGrouped(polkiVolumeM3, { maxFractionDigits: 4 })}
                  <span className="ml-3 inline-block tabular-nums text-teal-800 dark:text-teal-200">
                    {polkiEstimatedSum > 0
                      ? formatNumberGrouped(polkiEstimatedSum, { maxFractionDigits: 0 })
                      : "—"}
                  </span>
                </td>
              </tr>
              {polkiDebtHintSum > 0 ? (
                <tr className="border-t border-border bg-amber-500/10 text-[11px] text-amber-950 dark:text-amber-100">
                  <td colSpan={POLKI_TABLE_COLS} className="px-2 py-1.5 font-medium">
                    Суммарно «к долгу» по бонусу (компенсация меньше расчёта):{" "}
                    <span className="tabular-nums">
                      {formatNumberGrouped(polkiDebtHintSum, { maxFractionDigits: 0 })}
                    </span>{" "}
                    — оформите в карточке клиента / оплатах при необходимости.
                  </td>
                </tr>
              ) : null}
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
