"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PolkiLinesTableProps, PolkiPairRowModel } from "./types";
import { POLKI_TABLE_COLS } from "./constants";
import { formatPolkiPieceQty, polkiRowMaxReturnQty, polkiSplitTotal } from "./utils";
import { parsePolkiQty } from "./polki-bonus-balance.logic";
import { PolkiReturnBonusSummary } from "./polki-return-bonus-summary";
import { PolkiManualPeresortSelect } from "./view/polki-shelf-return/polki-manual-peresort-select";

export function PolkiReturnLinesTable({
  canShowPolkiGrid,
  isPolkiByOrder,
  isPolkiFree,
  groupLinesByOrder = true,
  polkiLoading,
  polkiError,
  polkiSuccess,
  polkiRowsAllLength,
  polkiOrderGroups,
  polkiTotalQty,
  setPolkiTotalQty,
  mutationPending,
  polkiTotalReturnQtySum,
  polkiVolumeM3,
  polkiEstimatedSum,
  polkiDebtHintSum,
  polkiExpandedOrderId = null,
  setPolkiExpandedOrderId,
  polkiPeresortByPairKey = {},
  setPolkiPeresortByPairKey,
  polkiPeresortOptionsByProductId,
  polkiAutoBonusExplicitByPairKey = {},
  polkiAutoBonusDebtByPairKey = {},
  polkiAutoBonusPreviewLinesByProductId,
  polkiAutoBonusPreviewPending = false,
  polkiAutoBonusPreviewError = false,
  polkiBonusCalcMode = "auto"
}: PolkiLinesTableProps) {
  const polkiUsesAutoBonus = isPolkiFree || isPolkiByOrder;
  const tableColCount = groupLinesByOrder ? POLKI_TABLE_COLS : POLKI_TABLE_COLS - 1;
  const flatRowCount = polkiOrderGroups.reduce((a, g) => a + g.rows.length, 0);

  const toggleOrderGroup = (orderId: number) => {
    if (!setPolkiExpandedOrderId) return;
    setPolkiExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-teal-800/20 bg-card shadow-sm dark:border-teal-800/35">
      <div className="max-h-[min(75vh,920px)] min-h-[220px] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="app-table-thead sticky top-0 z-[1] backdrop-blur-sm">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {groupLinesByOrder ? <th className="min-w-[5rem] px-2 py-1.5">Заказ</th> : null}
              <th className="min-w-[9rem] px-2 py-1.5">Товар</th>
              <th
                className="min-w-[13rem] px-2 py-1.5"
                title={
                  polkiUsesAutoBonus
                    ? "Введите «всего к возврату» по строке (не больше «макс. всего»). Система разделит оплату и бонус по заказу; недостающий бонус — долг на баланс клиента."
                    : "Введите общее количество по строке (не больше «макс. всего» по заказу)."
                }
              >
                Дата · всего к возврату
              </th>
              <th
                className="min-w-[18rem] px-2 py-1.5"
                title="Бонус на склад, пересорт или сумма на баланс клиента"
              >
                Бонус / баланс
              </th>
              <th className="min-w-[3.5rem] px-2 py-1.5 text-right">m³</th>
            </tr>
          </thead>
          <tbody>
            {!canShowPolkiGrid ? (
              <tr>
                <td
                  colSpan={tableColCount}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  Выберите клиента
                  {isPolkiByOrder ? " и отметьте заказы справа" : ""}.
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiLoading ? (
              <tr>
                <td
                  colSpan={tableColCount}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  Загрузка контекста возврата…
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiError ? (
              <tr>
                <td
                  colSpan={tableColCount}
                  className="px-3 py-8 text-center text-sm text-destructive"
                >
                  Не удалось загрузить данные. Проверьте параметры и попробуйте снова.
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiSuccess && polkiRowsAllLength === 0 ? (
              <tr>
                <td
                  colSpan={tableColCount}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  Нет позиций для возврата. Проверьте доставленные заказы клиента или снимите фильтр категории.
                </td>
              </tr>
            ) : null}
            {canShowPolkiGrid && polkiSuccess && polkiRowsAllLength > 0
              ? polkiOrderGroups.map((g) => {
                  const isOpen = groupLinesByOrder ? polkiExpandedOrderId === g.orderId : true;
                  const renderRow = (r: PolkiPairRowModel) => {
                      const pk = r.pair_key;
                      const totalRaw = polkiTotalQty[pk] ?? "";
                      const totalQ = parsePolkiQty(totalRaw);
                      const maxTot = polkiRowMaxReturnQty(r);
                      const totalOver = Boolean(totalRaw.trim()) && totalQ > maxTot;
                      const explicit = polkiUsesAutoBonus
                        ? polkiAutoBonusExplicitByPairKey[pk]
                        : undefined;
                      const previewLine = polkiUsesAutoBonus
                        ? polkiAutoBonusPreviewLinesByProductId?.get(r.product_id)
                        : undefined;
                      const { effPaid, effBonus } = explicit
                        ? { effPaid: explicit.paid, effBonus: explicit.bonus }
                        : polkiSplitTotal(r, totalQ);
                      const physBonus = effBonus;
                      const volU =
                        r.volume_m3 != null ? Number.parseFloat(String(r.volume_m3)) : NaN;
                      const lineVol =
                        Number.isFinite(volU) && effPaid + physBonus > 0
                          ? (effPaid + physBonus) * volU
                          : 0;
                      return (
                        <tr
                          key={pk}
                          className="border-b border-border/80 last:border-0 hover:bg-muted/25"
                        >
                          {groupLinesByOrder ? (
                            <td className="px-2 py-1.5 align-top font-mono text-[11px] text-muted-foreground">
                              #{r.order_id}
                            </td>
                          ) : null}
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
                              {groupLinesByOrder ? (
                                <>
                                  Продажа:{" "}
                                  <span className="font-medium text-foreground">{g.orderDate}</span>
                                </>
                              ) : null}
                              {r.unit_price_paid > 0 ? (
                                <span className="ml-1 tabular-nums">
                                  · {formatNumberGrouped(r.unit_price_paid, { maxFractionDigits: 2 })}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              макс всего {formatNumberGrouped(maxTot, { maxFractionDigits: 0 })} шт (опл.{" "}
                              {formatNumberGrouped(r.max_paid, { maxFractionDigits: 0 })} + бон.{" "}
                              {formatNumberGrouped(r.max_bonus, { maxFractionDigits: 0 })})
                            </div>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              placeholder="0"
                              data-testid="oc-polki-total-qty"
                              data-oc-product-id={r.product_id}
                              className={cn(
                                "mt-1 h-8 w-full max-w-[7rem] tabular-nums text-sm",
                                totalOver && "border-destructive"
                              )}
                              value={totalRaw}
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                if (!raw) {
                                  setPolkiTotalQty((prev) => ({ ...prev, [pk]: "" }));
                                  return;
                                }
                                const digitsOnly = raw.replace(/[^\d]/g, "");
                                if (!digitsOnly) {
                                  setPolkiTotalQty((prev) => ({ ...prev, [pk]: "" }));
                                  return;
                                }
                                const n = parsePolkiQty(digitsOnly);
                                if (n > maxTot) {
                                  setPolkiTotalQty((prev) => ({
                                    ...prev,
                                    [pk]: formatPolkiPieceQty(maxTot)
                                  }));
                                  return;
                                }
                                setPolkiTotalQty((prev) => ({ ...prev, [pk]: digitsOnly }));
                              }}
                              onBlur={() => {
                                if (!totalRaw.trim()) return;
                                const n = parsePolkiQty(totalRaw);
                                if (n <= 0) {
                                  setPolkiTotalQty((prev) => ({ ...prev, [pk]: "" }));
                                  return;
                                }
                                const capped = n > maxTot ? maxTot : n;
                                setPolkiTotalQty((prev) => ({
                                  ...prev,
                                  [pk]: formatPolkiPieceQty(capped)
                                }));
                              }}
                              disabled={mutationPending || maxTot <= 0}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {polkiUsesAutoBonus ? (
                              <>
                                <PolkiReturnBonusSummary
                                  row={r}
                                  pairKey={pk}
                                  polkiTotalQty={polkiTotalQty}
                                  explicit={explicit}
                                  previewLine={previewLine}
                                  previewDebtAmount={polkiAutoBonusDebtByPairKey[pk]}
                                  previewPending={polkiAutoBonusPreviewPending}
                                  previewError={polkiAutoBonusPreviewError}
                                />
                                {isPolkiByOrder &&
                                polkiBonusCalcMode === "manual" &&
                                setPolkiPeresortByPairKey ? (
                                  <PolkiManualPeresortSelect
                                    row={r}
                                    pairKey={pk}
                                    effBonus={effBonus}
                                    value={polkiPeresortByPairKey[pk]}
                                    disabled={mutationPending}
                                    optionsByProductId={polkiPeresortOptionsByProductId}
                                    onChange={(pkey, pid) =>
                                      setPolkiPeresortByPairKey((prev) => ({
                                        ...prev,
                                        [pkey]: pid
                                      }))
                                    }
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground align-middle text-[13px]">
                            {lineVol > 0
                              ? formatNumberGrouped(lineVol, { maxFractionDigits: 4 })
                              : "0"}
                          </td>
                        </tr>
                      );
                  };

                  return (
                    <Fragment key={groupLinesByOrder ? g.orderId : "flat"}>
                      {groupLinesByOrder ? (
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                          className={cn(
                            "border-b border-teal-800/20 bg-teal-950/10 dark:bg-teal-950/25",
                            "cursor-pointer select-none transition-colors hover:bg-teal-950/20 dark:hover:bg-teal-950/40"
                          )}
                          onClick={() => toggleOrderGroup(g.orderId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleOrderGroup(g.orderId);
                            }
                          }}
                        >
                          <td
                            colSpan={tableColCount}
                            className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100/90"
                          >
                            <span className="inline-flex items-center gap-2">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                              )}
                              <span>
                                Заказ {g.orderNumber} · {g.orderDate || "—"}
                              </span>
                              <span className="font-normal normal-case text-muted-foreground">
                                ({g.rows.length} поз.)
                              </span>
                            </span>
                          </td>
                        </tr>
                      ) : null}
                      {isOpen ? g.rows.map((row) => renderRow(row)) : null}
                    </Fragment>
                  );
                })
              : null}
            {canShowPolkiGrid &&
            polkiSuccess &&
            polkiRowsAllLength > 0 &&
            flatRowCount === 0 ? (
              <tr>
                <td
                  colSpan={tableColCount}
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
                <td
                  className="px-2 py-2 text-foreground text-sm"
                  colSpan={groupLinesByOrder ? 3 : 2}
                >
                  Итого (на склад, шт · m³ · сумма на баланс)
                </td>
                <td className="px-2 py-2 text-center tabular-nums text-foreground text-sm">
                  {formatNumberGrouped(polkiTotalReturnQtySum, { maxFractionDigits: 0 })}
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
                  <td colSpan={tableColCount} className="px-2 py-1.5 font-medium">
                    {isPolkiFree ? (
                      <>
                        Долг бонус (на баланс при оформлении):{" "}
                        <span className="tabular-nums">
                          {formatNumberGrouped(polkiDebtHintSum, { maxFractionDigits: 0 })}
                        </span>{" "}
                        сум
                      </>
                    ) : (
                      <>
                        Суммарно «к долгу» по бонусу (компенсация меньше расчёта):{" "}
                        <span className="tabular-nums">
                          {formatNumberGrouped(polkiDebtHintSum, { maxFractionDigits: 0 })}
                        </span>{" "}
                        — оформите в карточке клиента / оплатах при необходимости.
                      </>
                    )}
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
