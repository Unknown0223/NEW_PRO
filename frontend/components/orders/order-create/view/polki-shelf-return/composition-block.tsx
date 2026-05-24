"use client";

import { memo, useDeferredValue } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { PolkiReturnLinesTable } from "../../polki-return-lines-table";
import { CompositionSubmitRow } from "./composition-submit-row";
import { CompositionSummaryStrip } from "./composition-summary-strip";
import { ReturnCommentFields } from "./return-comment-fields";
import { TotalsPanel } from "./totals-panel";
import { polkiCard, polkiTab, polkiTabActive } from "./polki-return-ui";

function compositionHint(
  vm: OrderCreateVm,
  polkiRowsAllLength: number
): string {
  const {
    canShowPolkiGrid,
    hasClient,
    hasWarehouse,
    isPolkiByOrder,
    polkiOrderIds,
    polkiContextQ
  } = vm;
  if (canShowPolkiGrid) {
    if (polkiContextQ.isLoading) return "Загрузка доставленных продаж…";
    if (polkiContextQ.isError) return "Ошибка загрузки. Нажмите «Обновить» или проверьте API.";
    if (polkiContextQ.isSuccess && polkiRowsAllLength === 0) {
      return "Нет доставленных позиций для возврата. Оформите и доставьте заказ, затем обновите данные.";
    }
    return "Выберите категорию вкладкой ниже и введите количество к возврату по строкам.";
  }
  if (!hasClient) return "Сначала выберите клиента.";
  if (!hasWarehouse) return "Выберите склад возврата.";
  if (isPolkiByOrder && polkiOrderIds.length === 0) {
    return "Отметьте доставленные заказы в блоке «Выбор заказов» справа.";
  }
  return "Выберите клиента и склад возврата — состав загрузится по всем доставленным продажам.";
}

export const CompositionBlock = memo(function CompositionBlock({
  vm,
  submitTitle
}: {
  vm: OrderCreateVm;
  submitTitle: string | undefined;
}) {
  const {
    mutation,
    isPolkiByOrder,
    isPolkiFree,
    canShowPolkiGrid,
    categories,
    selectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    productSearch,
    setProductSearch,
    polkiContextQ,
    polkiRowsAll,
    polkiOrderGroups,
    polkiTotalQty,
    setPolkiTotalQty,
    polkiBonusToBalance,
    setPolkiBonusToBalance,
    polkiBonusCash,
    setPolkiBonusCash,
    polkiTotalReturnQtySum,
    polkiVolumeM3,
    polkiEstimatedSum,
    polkiDebtHintSum,
    polkiExpandedOrderId,
    setPolkiExpandedOrderId,
    polkiPeresortByPairKey,
    setPolkiPeresortByPairKey,
    polkiPeresortOptionsByProductId,
    polkiAutoBonusExplicitByPairKey,
    polkiAutoBonusDebtByPairKey,
    polkiAutoBonusPreviewLinesByProductId,
    polkiAutoBonusPreviewPending,
    polkiAutoBonusPreviewError
  } = vm;

  const deferredSearch = useDeferredValue(productSearch);
  const showTabs = canShowPolkiGrid && selectedCategoryIds.length > 0;
  const showTotals = canShowPolkiGrid && polkiContextQ.isSuccess && !polkiContextQ.isLoading;

  return (
    <div className="space-y-4">
      <div className={cn(polkiCard, "p-5")}>
        <h2 className="text-[15px] font-semibold text-slate-800">Состав заявки</h2>
        <p className="mt-1 text-xs text-slate-500">{compositionHint(vm, polkiRowsAll.length)}</p>

        {!canShowPolkiGrid ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Выберите клиента и склад. Если продаж для возврата нет — сначала доставьте заказ.
          </p>
        ) : selectedCategoryIds.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Отметьте категории справа или нажмите «Выбрать все» — затем выберите вкладку категории
            над таблицей.
          </p>
        ) : (
          <>
            {showTabs ? (
              <div
                role="tablist"
                aria-label="Категории возврата"
                className="mt-3 flex flex-wrap border-b border-slate-200"
              >
                {selectedCategoryIds.map((cid) => {
                  const row = categories.find((c) => c.id === cid);
                  const label = row?.name ?? `#${cid}`;
                  const active = (activeCatalogCategoryId ?? selectedCategoryIds[0]) === cid;
                  return (
                    <button
                      key={cid}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={mutation.isPending}
                      className={cn(polkiTab, active && polkiTabActive, "mr-6")}
                      onClick={() => setActiveCatalogCategoryId(cid)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 max-w-md flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  placeholder="Поиск по названию или артикулу"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  disabled={mutation.isPending}
                  className="h-10 pl-9 focus-visible:border-[#0a8f7e] focus-visible:ring-[#0a8f7e]/15"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                title="Сбросить поиск"
                disabled={!deferredSearch || mutation.isPending}
                onClick={() => setProductSearch("")}
              >
                <RotateCcw className="h-4 w-4 text-[#0a8f7e]" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
                disabled={mutation.isPending || polkiContextQ.isFetching}
                onClick={() => void polkiContextQ.refetch()}
              >
                {polkiContextQ.isFetching ? "Обновление…" : "Обновить"}
              </Button>
            </div>

            <div className="mt-4">
              <PolkiReturnLinesTable
                canShowPolkiGrid={canShowPolkiGrid}
                isPolkiByOrder={isPolkiByOrder}
                isPolkiFree={isPolkiFree}
                polkiLoading={polkiContextQ.isLoading}
                polkiError={polkiContextQ.isError}
                polkiSuccess={polkiContextQ.isSuccess}
                polkiRowsAllLength={polkiRowsAll.length}
                polkiOrderGroups={polkiOrderGroups}
                polkiTotalQty={polkiTotalQty}
                setPolkiTotalQty={setPolkiTotalQty}
                polkiBonusToBalance={polkiBonusToBalance}
                setPolkiBonusToBalance={setPolkiBonusToBalance}
                polkiBonusCash={polkiBonusCash}
                setPolkiBonusCash={setPolkiBonusCash}
                mutationPending={mutation.isPending}
                polkiTotalReturnQtySum={polkiTotalReturnQtySum}
                polkiVolumeM3={polkiVolumeM3}
                polkiEstimatedSum={polkiEstimatedSum}
                polkiDebtHintSum={polkiDebtHintSum}
                polkiExpandedOrderId={polkiExpandedOrderId}
                setPolkiExpandedOrderId={setPolkiExpandedOrderId}
                polkiPeresortByPairKey={polkiPeresortByPairKey}
                setPolkiPeresortByPairKey={setPolkiPeresortByPairKey}
                polkiPeresortOptionsByProductId={polkiPeresortOptionsByProductId}
                groupLinesByOrder={isPolkiByOrder}
                polkiAutoBonusExplicitByPairKey={polkiAutoBonusExplicitByPairKey}
                polkiAutoBonusDebtByPairKey={polkiAutoBonusDebtByPairKey}
                polkiAutoBonusPreviewLinesByProductId={polkiAutoBonusPreviewLinesByProductId}
                polkiAutoBonusPreviewPending={polkiAutoBonusPreviewPending}
                polkiAutoBonusPreviewError={polkiAutoBonusPreviewError}
                polkiBonusCalcMode={vm.polkiBonusCalcMode}
              />
            </div>

            <CompositionSummaryStrip vm={vm} />
          </>
        )}
      </div>

      {showTotals ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Итоги возврата
          </h3>
          <TotalsPanel vm={vm} />
        </div>
      ) : null}

      <ReturnCommentFields vm={vm} />
      <CompositionSubmitRow vm={vm} submitTitle={submitTitle} />
    </div>
  );
});
