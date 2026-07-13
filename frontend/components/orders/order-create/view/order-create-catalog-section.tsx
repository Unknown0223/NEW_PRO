"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { DatePickerPopover, formatRuDateButton } from "@/components/ui/date-picker-popover";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { apiBaseURL, resolveApiOrigin } from "@/lib/api";
import { getUserFacingError, isApiUnreachable } from "@/lib/error-utils";
import { Fragment } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Check, Gift, Search } from "lucide-react";
import { ExchangeOrderCreatePanel } from "@/components/orders/exchange-order-create-panel";
import { OrderCreateAgentLockHint } from "@/components/orders/order-create-agent-lock-hint";
import { fieldClass, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS, POLKI_PRICE_TYPE_LABEL_RU } from "../constants";
import {
  parseStockQty,
  parsePriceAmount,
  availableOrderQty,
  formatQtyState,
  orderStatusLabelRu,
  unitPriceForType,
  polkiOrderRowHasBonus
} from "../utils";
import { CategoryIssueCountBadge } from "../category-issue-badge";
import { PolkiReturnLinesTable } from "../polki-return-lines-table";
import { PolkiClientSearchSelect } from "../polki-client-search-select";
import type { OrderCreateVm } from "../hooks/use-order-create";

import type { OrderCreateVm } from "../hooks/use-order-create";

export function OrderCreateCatalogSection({ vm }: { vm: OrderCreateVm }) {
  const {
    isPolkiByOrder,
    tenantSlug,
    clientIdNum,
    polkiOrdersForPick,
    isPolkiSheet,
    isPolkiFree,
    polkiRowsAll,
    categoryFilterActive,
    activeCatalogCategoryId,
    priceType,
    selectedCategoryIds,
    polkiTotalQty,
    polkiBonusToBalance,
    polkiBonusCash,
    polkiTotalReturnQtySum,
    warehouseId,
    agentId,
    productSearch,
    qtyByProductId,
    blockByProductId,
    canPickProducts,
    canShowOrderCatalog,
    canShowPolkiGrid,
    catalogProducts,
    catalogTabMode,
    categories,
    categoriesWithWarehouseSellableStock,
    categoryFilterSet,
    displayProducts,
    estimatedSum,
    exMinusKey,
    exMinusQty,
    exPlusProductId,
    exPlusQty,
    exchangeSourceOrderIds,
    hasMissingPriceForSelected,
    isExchangeFlow,
    lineProblemCountByCategoryId,
    missingPriceProductNames,
    mutation,
    polkiContextQ,
    polkiDebtHintSum,
    polkiEstimatedSum,
    polkiOrderGroups,
    polkiVolumeM3,
    products,
    selectedTotalQty,
    setActiveCatalogCategoryId,
    setBlockByProductId,
    setExMinusKey,
    setExMinusQty,
    setExPlusProductId,
    setExPlusQty,
    setExchangeSourceOrderIds,
    setPolkiBonusCash,
    setPolkiBonusToBalance,
    setPolkiTotalQty,
    setProductSearch,
    setQtyByProductId,
    setSelectedCategoryIds,
    stockByProduct,
    stockQ,
    tableProductGroups,
    totalVolumeM3,
  } = vm;

  return (
    <>
        <section
          className={cn(
            "rounded-xl border bg-card p-4 shadow-sm sm:p-5 lg:p-6",
            (isPolkiSheet && !canPickProducts && !canShowPolkiGrid) || (!isPolkiSheet && !canShowOrderCatalog)
              ? "opacity-[0.88]"
              : undefined,
            isPolkiSheet && "border-teal-800/15 dark:border-teal-800/30"
          )}
        >
          {isPolkiSheet ? (
            <div className="mb-4 border-b border-border/80 pb-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Состав заявки</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {canShowPolkiGrid
                  ? "Один ввод на строку: общее количество возврата; система делит на оплату и бонус. Можно отметить «бонус не на склад» — тогда бонусная часть идёт суммой на баланс. Заказы выбирайте любые (не обязательно все). Поиск и категории ниже."
                  : "Сначала клиент, склад, период или заказ."}
              </p>
              <div className="mt-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">Категории</span>
                  <span className="text-[10px] text-muted-foreground">
                    {canShowPolkiGrid ? "фильтр таблицы" : "сначала контекст"}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-md border border-border/60 bg-muted/10 px-2 py-2",
                    !canShowPolkiGrid && "pointer-events-none opacity-50"
                  )}
                >
                  {!canShowPolkiGrid ? (
                    <p className="text-[11px] text-muted-foreground">
                      {isPolkiByOrder
                        ? "Клиент и хотя бы один заказ."
                        : "Сначала клиент (и период при необходимости)."}
                    </p>
                  ) : categoriesWithWarehouseSellableStock == null ? (
                    <p className="text-[11px] text-muted-foreground">Остатки склада (факт − брон) загружаются…</p>
                  ) : categoriesWithWarehouseSellableStock.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      {stockQ.isError
                        ? "Не удалось загрузить остатки."
                        : "Нет категорий с доступным количеством > 0 на этом складе."}
                    </p>
                  ) : (
                    <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryIds([])}
                        disabled={mutation.isPending}
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                          !categoryFilterActive
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >
                        {!categoryFilterActive ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                        Все
                      </button>
                      {categoriesWithWarehouseSellableStock.map((c) => {
                        const active = categoryFilterSet.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setSelectedCategoryIds((prev) =>
                                prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                              )
                            }
                            disabled={mutation.isPending}
                            className={cn(
                              "inline-flex max-w-[10rem] items-center gap-0.5 truncate rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                              active
                                ? "border-teal-600 bg-teal-600 text-white"
                                : "border-border bg-background hover:bg-muted"
                            )}
                            title={c.name}
                          >
                            {active ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {canShowPolkiGrid && selectedCategoryIds.length > 0 ? (
                <div className="mt-2 rounded-md border border-teal-800/20 bg-muted/15 px-1 pt-1 dark:border-teal-800/35">
                  <p className="mb-0.5 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Выбор категории
                  </p>
                  <div
                    role="tablist"
                    aria-label="Категории возврата"
                    className="flex flex-wrap gap-x-0.5 overflow-x-auto border-b border-border/70"
                  >
                    {selectedCategoryIds.map((cid) => {
                      const row = categories.find((c) => c.id === cid);
                      const label = row?.name ?? `#${cid}`;
                      const active = (activeCatalogCategoryId ?? selectedCategoryIds[0]) === cid;
                      const issueCount = lineProblemCountByCategoryId.get(cid) ?? 0;
                      return (
                        <button
                          key={cid}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          disabled={mutation.isPending}
                          className={cn(
                            "relative -mb-px shrink-0 rounded-t-md border-b-2 py-2 pl-2.5 pr-10 text-left text-[12px] font-medium transition-colors",
                            active
                              ? "border-teal-600 bg-background text-foreground dark:border-teal-500"
                              : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                          onClick={() => setActiveCatalogCategoryId(cid)}
                        >
                          <span className="block min-w-0 pr-0.5 leading-snug">{label}</span>
                          <CategoryIssueCountBadge count={issueCount} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Buyurtma tarkibi</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {canShowOrderCatalog
                    ? selectedCategoryIds.length > 0
                      ? "Kategoriyalar tepada tanlanadi; pastdagi yorliqdan birini tanlang — jadval faqat shu toifada. Miqdorni boshqa yorliqqa o‘tsangiz ham saqlanadi."
                      : "Miqdor kiriting. Jadvalda taxminiy summa tanlangan narx turiga qarab."
                    : canPickProducts
                      ? "Agentni tanlang — katalog shu agentga kaskadlangan mahsulotlar bo‘yicha ochiladi."
                      : "Klient va omborni tanlang."}
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-3xl lg:shrink-0">
                <div className="rounded-lg border border-emerald-600/25 bg-emerald-600/8 px-3 py-3 text-sm shadow-sm dark:bg-emerald-950/30">
                  <p className="text-xs font-medium text-emerald-800/90 dark:text-emerald-200/90">Jami hajm</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                    {formatNumberGrouped(totalVolumeM3, { maxFractionDigits: 3 })}{" "}
                    <span className="text-sm font-normal text-emerald-800/80 dark:text-emerald-300/80">m³</span>
                  </p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm shadow-sm dark:bg-amber-950/35">
                  <p className="text-xs font-medium text-amber-900/90 dark:text-amber-100/90">Jami miqdor</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-amber-950 dark:text-amber-50">
                    {formatNumberGrouped(Number(selectedTotalQty) || 0, { maxFractionDigits: 3 })}{" "}
                    <span className="text-sm font-normal text-amber-800/90 dark:text-amber-200/80">dona</span>
                  </p>
                </div>
                <div className="rounded-lg border border-teal-600/25 bg-teal-600/10 px-3 py-3 text-sm shadow-sm dark:bg-teal-950/35">
                  <p className="text-xs font-medium text-teal-900/90 dark:text-teal-100/90">Taxminiy summa</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-teal-900 dark:text-teal-100">
                    {estimatedSum > 0
                      ? formatNumberGrouped(estimatedSum, { maxFractionDigits: 0 })
                      : "0"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isExchangeFlow && tenantSlug ? (
            <div className="mb-4">
              <ExchangeOrderCreatePanel
                tenantSlug={tenantSlug}
                clientIdNum={clientIdNum}
                warehouseId={warehouseId}
                agentId={agentId}
                priceType={priceType}
                mutationPending={mutation.isPending}
                ordersForPick={polkiOrdersForPick}
                sourceOrderIds={exchangeSourceOrderIds}
                onSourceOrderIdsChange={setExchangeSourceOrderIds}
                minusKey={exMinusKey}
                onMinusKeyChange={setExMinusKey}
                minusQty={exMinusQty}
                onMinusQtyChange={setExMinusQty}
                plusProductId={exPlusProductId}
                onPlusProductIdChange={setExPlusProductId}
                plusQty={exPlusQty}
                onPlusQtyChange={setExPlusQty}
              />
            </div>
          ) : null}

          {!isPolkiSheet && !isExchangeFlow && canShowOrderCatalog && selectedCategoryIds.length > 0 ? (
            <div className="mb-3 rounded-lg border border-border bg-muted/20 px-2 pt-2">
              <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Tanlangan kategoriyalar
              </p>
              <div
                role="tablist"
                aria-label="Katalog kategoriyalari"
                className="flex flex-wrap gap-x-0.5 overflow-x-auto border-b border-border/80"
              >
                {selectedCategoryIds.map((cid) => {
                  const row = categories.find((c) => c.id === cid);
                  const label = row?.name ?? `#${cid}`;
                  const active = (activeCatalogCategoryId ?? selectedCategoryIds[0]) === cid;
                  const issueCount = lineProblemCountByCategoryId.get(cid) ?? 0;
                  return (
                    <button
                      key={cid}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={mutation.isPending}
                      className={cn(
                        "relative -mb-px min-h-[2.75rem] shrink-0 rounded-t-md border-b-2 py-2 pl-3 pr-11 text-left text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-card text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                      onClick={() => setActiveCatalogCategoryId(cid)}
                    >
                      <span className="block min-w-0 pr-0.5 leading-snug">{label}</span>
                      <CategoryIssueCountBadge count={issueCount} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative min-w-0 flex-1">
              {isPolkiSheet ? (
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
              <Input
                placeholder={isPolkiSheet ? "Поиск: название, SKU" : "Qidiruv: nom, SKU"}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                disabled={
                  mutation.isPending ||
                  (isPolkiSheet ? !canShowPolkiGrid : isExchangeFlow ? true : !canShowOrderCatalog)
                }
                className={cn("h-10", isPolkiSheet && "pl-9")}
              />
            </div>
          </div>

          {!isPolkiSheet && !isExchangeFlow ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="max-h-[min(60vh,720px)] overflow-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="app-table-thead sticky top-0 z-[1] backdrop-blur-sm">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="min-w-[12rem] px-3 py-2.5">Mahsulot</th>
                    <th className="min-w-[5.5rem] px-3 py-2.5 text-right">Narx</th>
                    <th
                      className="min-w-[5.5rem] px-3 py-2.5 text-center"
                      title="Qadoq / blok. Kartotekada blokdagi dona bo‘lsa, miqdor = blok × dona."
                    >
                      Blok
                    </th>
                    <th className="min-w-[5.5rem] px-3 py-2.5 text-center">Miqdor</th>
                    <th className="min-w-[4.5rem] px-3 py-2.5 text-right">Hajm m³</th>
                    <th className="min-w-[4.5rem] px-3 py-2.5 text-right" title="Fakt qoldiq (jami omborda)">
                      Fakt
                    </th>
                    <th className="min-w-[4.5rem] px-3 py-2.5 text-right" title="Band qilingan miqdor">
                      Bron
                    </th>
                    <th className="min-w-[5rem] px-3 py-2.5 text-right" title="Mavjud (fakt − bron)">
                      Mavjud
                    </th>
                    <th className="min-w-[6rem] px-3 py-2.5 text-right">Jami</th>
                  </tr>
                </thead>
                <tbody>
                  {canShowOrderCatalog && stockQ.isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        Ombor qoldiqlari Загрузка…
                      </td>
                    </tr>
                  ) : null}
                  {canShowOrderCatalog && stockQ.isError ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-sm text-destructive">
                        Qoldiqlarni yuklab bo‘lmadi. Internet yoki omborni tekshiring.
                      </td>
                    </tr>
                  ) : null}
                  {canShowOrderCatalog && !stockQ.isLoading && !stockQ.isError
                    ? tableProductGroups.map((group) => (
                        <Fragment key={group.key}>
                          {!catalogTabMode ? (
                            <tr className="border-b border-border/80 bg-muted/40">
                              <td
                                colSpan={9}
                                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                              >
                                {group.categoryName}
                                <span className="ml-2 font-normal normal-case text-foreground/80">
                                  ({group.products.length})
                                </span>
                              </td>
                            </tr>
                          ) : null}
                          {group.products.map((p) => {
                        const stock = stockByProduct.get(p.id);
                        const qtyTotal = stock?.qty ?? "0";
                        const reserved = stock?.reserved_qty ?? "0";
                        const availNum = availableOrderQty(stock);
                        const qpb = p.qty_per_block;
                        const unit = unitPriceForType(p, priceType);
                        const lineQtyRaw = qtyByProductId[p.id] ?? "";
                        const lineQ = Number.parseFloat(lineQtyRaw.replace(",", "."));
                        const blockRaw = blockByProductId[p.id] ?? "";
                        const blockN = Number.parseFloat(blockRaw.replace(",", "."));
                        let impliedFromBlock = NaN;
                        if (qpb != null && qpb > 0) {
                          if (Number.isFinite(blockN) && blockN > 0) impliedFromBlock = blockN * qpb;
                        } else if (Number.isFinite(blockN)) {
                          impliedFromBlock = blockN;
                        }
                        const qtyOver =
                          Boolean(lineQtyRaw.trim()) &&
                          Number.isFinite(lineQ) &&
                          lineQ > 0 &&
                          lineQ > availNum;
                        const blockOver =
                          Boolean(blockRaw.trim()) &&
                          Number.isFinite(impliedFromBlock) &&
                          impliedFromBlock > availNum;
                        const effQ =
                          Number.isFinite(lineQ) && lineQ > 0 ? Math.min(lineQ, availNum) : 0;
                        const volU = p.volume_m3 != null ? Number.parseFloat(p.volume_m3) : NaN;
                        const lineVolM3 =
                          Number.isFinite(volU) && effQ > 0 ? effQ * volU : 0;
                        const lineTotalMoney =
                          unit != null && effQ > 0 ? effQ * parsePriceAmount(unit) : null;
                        const maxLabel = formatNumberGrouped(availNum, { maxFractionDigits: 3 });
                        return (
                          <tr
                            key={`${group.key}-${p.id}`}
                            className="border-b border-border/80 last:border-0 hover:bg-muted/25"
                          >
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium leading-snug text-foreground">{p.name}</div>
                              {p.sku ? (
                                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                  {p.sku}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground align-middle">
                              {unit != null
                                ? formatNumberGrouped(parsePriceAmount(unit), { maxFractionDigits: 2 })
                                : "—"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="mx-auto flex max-w-[6.5rem] flex-col items-stretch">
                                {blockOver ? (
                                  <span className="mb-0.5 text-center text-[11px] font-semibold text-destructive">
                                    Maks: {maxLabel}
                                  </span>
                                ) : null}
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  placeholder="0"
                                  title={
                                    qpb != null && qpb > 0
                                      ? `1 blok = ${qpb} dona`
                                      : "Blok va miqdor bir xil (kartotekada blok/o‘lcham yo‘q)"
                                  }
                                  className={cn(
                                    "h-9 w-full tabular-nums text-center",
                                    blockOver && "border-destructive focus-visible:ring-destructive"
                                  )}
                                  value={blockRaw}
                                  onChange={(e) => {
                                    const blockStr = e.target.value;
                                    setBlockByProductId((prev) => ({ ...prev, [p.id]: blockStr }));
                                    const qpbN = p.qty_per_block;
                                    if (qpbN != null && qpbN > 0) {
                                      if (!blockStr.trim()) {
                                        setQtyByProductId((prev) => ({ ...prev, [p.id]: "" }));
                                        return;
                                      }
                                      const blocks = Number.parseFloat(blockStr.replace(",", "."));
                                      if (!Number.isFinite(blocks) || blocks <= 0) return;
                                      setQtyByProductId((prev) => ({
                                        ...prev,
                                        [p.id]: formatQtyState(blocks * qpbN)
                                      }));
                                      return;
                                    }
                                    setQtyByProductId((prev) => ({ ...prev, [p.id]: blockStr }));
                                  }}
                                  onBlur={() => {
                                    const br = blockByProductId[p.id];
                                    if (!br?.trim()) return;
                                    const blocks = Number.parseFloat(br.replace(",", "."));
                                    if (!Number.isFinite(blocks) || blocks <= 0) return;
                                    const qpbN = p.qty_per_block;
                                    if (qpbN != null && qpbN > 0) {
                                      let qtyVal = blocks * qpbN;
                                      if (qtyVal > availNum) {
                                        qtyVal = availNum;
                                        setBlockByProductId((prev) => ({
                                          ...prev,
                                          [p.id]: availNum > 0 ? formatQtyState(availNum / qpbN) : ""
                                        }));
                                        setQtyByProductId((prev) => ({
                                          ...prev,
                                          [p.id]: qtyVal > 0 ? formatQtyState(qtyVal) : ""
                                        }));
                                      }
                                      return;
                                    }
                                    if (blocks > availNum) {
                                      const cap = availNum > 0 ? String(availNum) : "";
                                      setBlockByProductId((prev) => ({ ...prev, [p.id]: cap }));
                                      setQtyByProductId((prev) => ({ ...prev, [p.id]: cap }));
                                    }
                                  }}
                                  disabled={mutation.isPending}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="mx-auto flex max-w-[6.5rem] flex-col items-stretch">
                                {qtyOver ? (
                                  <span className="mb-0.5 text-center text-[11px] font-semibold text-destructive">
                                    Maks: {maxLabel}
                                  </span>
                                ) : null}
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  placeholder="0"
                                  data-testid="oc-line-qty"
                                  data-oc-product-id={p.id}
                                  className={cn(
                                    "h-9 w-full tabular-nums text-center",
                                    qtyOver && "border-destructive focus-visible:ring-destructive"
                                  )}
                                  value={lineQtyRaw}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setQtyByProductId((prev) => ({ ...prev, [p.id]: v }));
                                    const qpbN = p.qty_per_block;
                                    if (qpbN != null && qpbN > 0) {
                                      const q = Number.parseFloat(v.replace(",", "."));
                                      if (!v.trim() || !Number.isFinite(q) || q <= 0) {
                                        setBlockByProductId((prev) => ({ ...prev, [p.id]: "" }));
                                      } else {
                                        setBlockByProductId((prev) => ({
                                          ...prev,
                                          [p.id]: formatQtyState(q / qpbN)
                                        }));
                                      }
                                    } else {
                                      setBlockByProductId((prev) => ({ ...prev, [p.id]: v }));
                                    }
                                  }}
                                  onBlur={() => {
                                    const raw = qtyByProductId[p.id];
                                    if (!raw?.trim()) return;
                                    const n = Number.parseFloat(raw.replace(",", "."));
                                    if (!Number.isFinite(n) || n <= 0) return;
                                    if (n > availNum) {
                                      const capped = availNum > 0 ? formatQtyState(availNum) : "";
                                      setQtyByProductId((prev) => ({ ...prev, [p.id]: capped }));
                                      const qpbN = p.qty_per_block;
                                      if (qpbN != null && qpbN > 0 && capped) {
                                        const q = Number.parseFloat(capped.replace(",", "."));
                                        if (Number.isFinite(q) && q > 0) {
                                          setBlockByProductId((prev) => ({
                                            ...prev,
                                            [p.id]: formatQtyState(q / qpbN)
                                          }));
                                        }
                                      } else {
                                        setBlockByProductId((prev) => ({ ...prev, [p.id]: capped }));
                                      }
                                    }
                                  }}
                                  disabled={mutation.isPending}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground align-middle">
                              {lineVolM3 > 0
                                ? formatNumberGrouped(lineVolM3, { maxFractionDigits: 4 })
                                : "0"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground align-middle">
                              {formatNumberGrouped(parseStockQty(qtyTotal), { maxFractionDigits: 3 })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-300 align-middle">
                              {formatNumberGrouped(parseStockQty(reserved), { maxFractionDigits: 3 })}
                            </td>
                            <td
                              className="px-3 py-2 text-right tabular-nums font-semibold text-foreground align-middle"
                              title={`Fakt: ${qtyTotal}, bron: ${reserved}`}
                            >
                              {formatNumberGrouped(availNum, { maxFractionDigits: 3 })}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground align-middle">
                              {lineTotalMoney != null && lineTotalMoney > 0
                                ? formatNumberGrouped(lineTotalMoney, { maxFractionDigits: 0 })
                                : "—"}
                            </td>
                          </tr>
                        );
                          })}
                        </Fragment>
                      ))
                    : null}
                  {canShowOrderCatalog &&
                  !stockQ.isLoading &&
                  !stockQ.isError &&
                  catalogTabMode &&
                  tableProductGroups.every((g) => g.products.length === 0) &&
                  catalogProducts.length > 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        Tanlangan yorliq bo‘yicha mahsulot yo‘q (qoldiq yoki qidiruv). Boshqa yorliqni tanlang.
                      </td>
                    </tr>
                  ) : null}
                  {canShowOrderCatalog &&
                  !stockQ.isLoading &&
                  !stockQ.isError &&
                  catalogProducts.length > 0 &&
                  displayProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        Qidiruv bo‘yicha mahsulot topilmadi.
                      </td>
                    </tr>
                  ) : null}
                  {canShowOrderCatalog &&
                  !stockQ.isLoading &&
                  !stockQ.isError &&
                  catalogProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        Bu kategoriya / ombor bo‘yicha noldan yuqori qoldiqli mahsulot yo‘q.
                      </td>
                    </tr>
                  ) : null}
                  {!canShowOrderCatalog ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">
                        {!canPickProducts
                          ? "Avval klient va omborni tanlang — keyin jadval ochiladi."
                          : "Avval agentni tanlang — jadval shu agentga bog‘langan mahsulotlar uchun ochiladi."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                {canShowOrderCatalog && !stockQ.isLoading && !stockQ.isError && displayProducts.length > 0 ? (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                      <td className="px-3 py-2.5 text-foreground" colSpan={3}>
                        Jami
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-foreground">
                        {formatNumberGrouped(selectedTotalQty, { maxFractionDigits: 3 })}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                        {formatNumberGrouped(totalVolumeM3, { maxFractionDigits: 4 })}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-teal-800 dark:text-teal-200">
                        {estimatedSum > 0
                          ? formatNumberGrouped(estimatedSum, { maxFractionDigits: 0 })
                          : "—"}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
          ) : (
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
              groupLinesByOrder={isPolkiByOrder}
            />
          )}

          {!isPolkiSheet && !isExchangeFlow && hasMissingPriceForSelected ? (
            <p className="mt-3 text-xs text-destructive">
              Tanlangan narx turi ({priceType}) bo‘yicha narxi yo‘q mahsulot bor:{" "}
              {missingPriceProductNames.join(", ")}
              {missingPriceProductNames.length >= 3 ? "..." : ""}. Narx turini almashtiring yoki mahsulot narxini
              kiriting.
            </p>
          ) : null}

          <p className="mt-3 text-xs text-muted-foreground">
            {isPolkiSheet ? (
              <>
                <span className="font-medium text-foreground">Возврат: </span>
                после проведения — приход на выбранный склад возврата; детали списания с продажного склада
                задаёт сервер. Суммы в таблице и карточках — оценка по ценам продажи. Количество в строке
                не больше остатка по заказу; список заказов ограничен настройками возврата (период и баланс 0).
              </>
            ) : isExchangeFlow ? (
              <>
                <span className="font-medium text-foreground">Обмен: </span>
                минус увеличивает факт на складе; плюс резервируется при создании и списывается при подтверждении.
                При отмене — возврат резерва и откат прихода минуса.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">Ombor: </span>
                yaratishda bloklangan miqdor oshadi; tasdiqlanganda qoldiq kamayadi. Bekor qilsangiz — blokdan
                qaytariladi.{" "}
                <span className="font-medium text-foreground">Taxminiy summa</span> bonus va yakuniy chegirmasiz.
              </>
            )}
          </p>
        </section>
    </>
  );
}
