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
import { api, apiBaseURL, resolveApiOrigin } from "@/lib/api";
import { ORDER_TYPE_VALUES } from "@/lib/order-types";
import { getUserFacingError, isApiUnreachable } from "@/lib/error-utils";
import { Fragment, useId } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import {
  orderAgentFilterOption,
  orderExpeditorFilterOption
} from "@/lib/order-picker-labels";
import { activeRefSelectOptions, refEntryLabelByStored } from "@/lib/profile-ref-entries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Check, ChevronDown, Gift, Search } from "lucide-react";
import { ExchangeOrderCreatePanel } from "@/components/orders/exchange-order-create-panel";
import { OrderCreateAgentLockHint } from "@/components/orders/order-create-agent-lock-hint";
import { fieldClass, MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS, POLKI_PRICE_TYPE_LABEL_RU } from "../constants";
import {
  parseStockQty,
  parsePriceAmount,
  availableOrderQty,
  formatQtyState,
  orderStatusLabelRu,
  unitPriceForType,
  isPolkiShelfSourceOrder,
  isPolkiReturnByOrderPickable,
  polkiOrderRowHasBonus
} from "../utils";
import { CategoryIssueCountBadge } from "../category-issue-badge";
import { PolkiReturnLinesTable } from "../polki-return-lines-table";
import { PolkiClientSearchSelect } from "../polki-client-search-select";
import type { OrderCreateVm } from "../hooks/use-order-create";

export function OrderCreateView({ vm }: { vm: OrderCreateVm }) {
  const {
    tenantSlug,
    onCreated,
    onCancel,
    orderType,
    ORDER_CREATE_DEBUG,
    activeCatalogCategoryId,
    agentCatalogReady,
    agentFilterOptions,
    agentId,
    agentUserIdSet,
    agentUsers,
    applyBonus,
    blockByProductId,
    canPickPricingAndExpeditor,
    canPickProducts,
    canPickWarehouse,
    canShowOrderCatalog,
    canShowPolkiGrid,
    canSubmit,
    canUseCategoryChips,
    catalogProducts,
    catalogTabMode,
    categories,
    categoriesWithWarehouseSellableStock,
    categoryFilterActive,
    categoryFilterSet,
    categoryIdsWithPositiveStock,
    clientAssignmentsForLock,
    clientId,
    clientIdNum,
    clientSummaryQ,
    clients,
    consignmentDueAnchorRef,
    consignmentDueDate,
    consignmentDueOpen,
    createCtxQ,
    ctxProfile,
    debugOrderCreate,
    displayProductGroups,
    displayProducts,
    eligibleClientById,
    eligibleClientIdSet,
    eligibleClients,
    estimatedSum,
    exMinusKey,
    exMinusQty,
    exPlusProductId,
    exPlusQty,
    exchangeOrderIdsSortedKey,
    exchangePairRows,
    exchangePayloadCheck,
    exchangeReturnsQ,
    exchangeSourceOrderIds,
    expeditorFilterOptions,
    expeditorUserId,
    filteredExpeditors,
    hasAgentSelected,
    hasClient,
    hasMissingPriceForSelected,
    hasPolkiBonusCashOverMax,
    hasPolkiQtyOverMax,
    hasQtyOverStock,
    hasWarehouse,
    isExchangeFlow,
    isPolkiByOrder,
    isPolkiFree,
    isPolkiSheet,
    lineProblemCountByCategoryId,
    loadingLists,
    localError,
    missingPriceProductNames,
    mutation,
    normalizedType,
    orderClientPickerScopeIds,
    orderComment,
    orderIsConsignment,
    orderNoteOptions,
    orderNotePreset,
    orderOpenedAt,
    paymentMethodRef,
    paymentMethodSelectOptions,
    polkiBonusCash,
    polkiBonusToBalance,
    polkiContextQ,
    polkiDateFrom,
    polkiDateTo,
    polkiDebtHintSum,
    polkiDisplayRows,
    polkiEstimatedSum,
    polkiHeaderDate,
    polkiLineKeySet,
    polkiOrderDateById,
    polkiOrderGroups,
    polkiOrderIdSet,
    polkiOrderIds,
    polkiOrderIdsSortedKey,
    polkiOrderPickHalfLists,
    polkiOrdersForPick,
    polkiOrdersPickQ,
    polkiOrdersPickRawCount,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    polkiRowsAll,
    polkiRowsFiltered,
    polkiSelectedClientLabel,
    polkiSelectedLinesCount,
    polkiSkidkaType,
    polkiSubmitBlockedReason,
    polkiTotalBonusCashSum,
    polkiTotalQty,
    polkiTotalReturnQtySum,
    polkiTradeDirection,
    polkiVolumeM3,
    priceType,
    productSearch,
    productSearchNorm,
    products,
    qc,
    qtyByProductId,
    refSelectKey,
    refusalReasonPolkiOptions,
    refusalReasonRefPolki,
    requestTypeOptions,
    requestTypeRef,
    requiresAgentAndPayment,
    requiresAgentForProductCatalog,
    requiresPaymentMethodForSubmit,
    resetFlowAfterClientChange,
    selectedAgentIdNum,
    selectedCategoryIds,
    selectedClientExpeditorIdSet,
    selectedClientExpeditorIds,
    selectedClientIdNum,
    selectedClientRow,
    selectedExpeditorIdNum,
    selectedItemsCount,
    selectedTotalQty,
    selectedWarehouseIdNum,
    selectionNotice,
    setActiveCatalogCategoryId,
    setAgentId,
    setApplyBonus,
    setBlockByProductId,
    setClientId,
    setConsignmentDueDate,
    setConsignmentDueOpen,
    setExMinusKey,
    setExMinusQty,
    setExPlusProductId,
    setExPlusQty,
    setExchangeSourceOrderIds,
    setExpeditorUserId,
    setLocalError,
    setOrderComment,
    setOrderIsConsignment,
    setOrderNotePreset,
    setPaymentMethodRef,
    setPolkiBonusCash,
    setPolkiBonusToBalance,
    setPolkiDateFrom,
    setPolkiDateTo,
    setPolkiHeaderDate,
    setPolkiOrderIds,
    setPolkiRangeOpen,
    setPolkiSkidkaType,
    setPolkiTotalQty,
    setPolkiTradeDirection,
    setPriceType,
    setProductSearch,
    setQtyByProductId,
    setRefSelectKey,
    setRefusalReasonRefPolki,
    setRequestTypeRef,
    setSelectedCategoryIds,
    setSelectionNotice,
    setWarehouseId,
    showOrderPaymentMethodSelector,
    stockByProduct,
    stockProductIdsKey,
    stockQ,
    stockReadyForLines,
    tableProductGroups,
    tenantShowPaymentMethodSelector,
    selectPolkiOrder,
    totalVolumeM3,
    uiPrefsQ,
    useSplitOrderCatalog,
    userShowPaymentMethodSelector,
    users,
    warehouseId,
    warehouseIdSet,
    warehouses,
  } = vm;

  return (
    <PageShell>
      <PageHeader
        title={
          isPolkiFree
            ? "Возврат с полки"
            : isPolkiByOrder
              ? "Возврат с полки по заказу"
              : isExchangeFlow
                ? "Обмен (связанный)"
                : "Yangi zakaz"
        }
        description={
          isPolkiSheet
            ? isPolkiByOrder
              ? "Параметры и состав; по заказу — только доставленные заказы, можно выбрать несколько."
              : "Компактные параметры и таблица состава возврата за период."
            : isExchangeFlow
              ? "Минус по доставленному заказу, плюс только из группы взаимозаменяемых."
              : "Klient, ombor va mahsulot miqdorlari — to‘liq sahifa."
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/orders">
              {isPolkiSheet ? "← Заказы" : "← Zakazlar ro‘yxati"}
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {isPolkiSheet ? "Отмена" : "Bekor"}
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="order-create-submit"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
              className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-700"
              title={
                isPolkiSheet
                  ? !hasClient
                    ? "Сначала выберите клиента"
                    : isPolkiByOrder && polkiOrderIds.length === 0
                      ? "Отметьте хотя бы один доставленный заказ"
                      : !hasWarehouse
                        ? "Выберите склад возврата"
                        : polkiTotalReturnQtySum <= 0 && polkiTotalBonusCashSum <= 0
                          ? "Укажите количество к возврату или компенсацию бонуса"
                          : polkiTotalReturnQtySum > MAX_POLKI_RETURN_QTY
                            ? `Не более ${MAX_POLKI_RETURN_QTY} шт на склад в одном документе`
                            : hasPolkiBonusCashOverMax
                              ? "Сумма компенсации вместо бонуса превышает допустимое"
                              : hasPolkiQtyOverMax
                              ? "Количество не больше проданного"
                              : !stockReadyForLines
                                ? "Загрузка данных…"
                                : undefined
                  : !hasClient
                    ? "Avval klientni tanlang"
                    : !hasWarehouse
                      ? "Avval omborni tanlang"
                      : requiresAgentAndPayment && !agentId.trim()
                        ? "Agentni tanlang (savdo zakazi)"
                      : requiresPaymentMethodForSubmit && !paymentMethodRef.trim()
                          ? "To‘lov usulini tanlang"
                          : isExchangeFlow
                            ? !agentId.trim()
                              ? "Agentni tanlang"
                              : exchangeReturnsQ.isLoading
                                ? "Загрузка строк заказа…"
                                : !exchangePayloadCheck.ok
                                  ? "Заполните минус/плюс и проверьте лимиты"
                                  : undefined
                            : selectedItemsCount === 0
                              ? "Kamida bitta mahsulot miqdorini kiriting"
                              : hasQtyOverStock
                                ? "Miqdor qoldiqdan oshmasin"
                                : hasMissingPriceForSelected
                                  ? "Tanlangan narx turi bo‘yicha narxi yo‘q mahsulotlar bor"
                                  : !stockReadyForLines
                                    ? "Qoldiqlar Загрузка…"
                                    : undefined
              }
            >
              {mutation.isPending
                ? isPolkiSheet
                  ? "Оформление…"
                  : "Saqlanmoqda…"
                : isPolkiSheet
                  ? "Возврат"
                  : isExchangeFlow
                    ? "Обмен"
                    : "Yaratish"}
            </Button>
          </div>
        }
      />

      <div
        className={cn(
          "flex w-full min-w-0 flex-col",
          isPolkiSheet ? "gap-4 pb-24" : "gap-6 pb-32"
        )}
      >
        {localError ? (
          <p className="text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}
        {selectionNotice ? (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            {selectionNotice}
          </p>
        ) : null}

        {createCtxQ.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
          >
            <p className="font-semibold text-destructive">API bilan aloqa yo‘q</p>
            <p className="mt-1 text-muted-foreground">
              {isApiUnreachable(createCtxQ.error) ? (
                <>
                  So‘rov manzili:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
                    {apiBaseURL || resolveApiOrigin()}
                  </code>{" "}
                  (devda ko‘pincha Next proxy orqali <code className="text-xs">/api</code>).
                  Klientlar va boshqa ro‘yxatlar backend ishlamaguncha bo‘sh ko‘rinadi. Loyiha ildizidan{" "}
                  <code className="rounded bg-muted px-1 text-xs text-foreground">npm run dev</code> (api+web)
                  yoki{" "}
                  <code className="rounded bg-muted px-1 text-xs text-foreground">
                    npm run dev --prefix backend
                  </code>{" "}
                  ni ishga tushiring (odatda port 18080). Boshqa portda bo‘lsa,{" "}
                  <code className="rounded bg-muted px-1 text-xs text-foreground">
                    NEXT_PUBLIC_API_URL
                  </code>{" "}
                  ni frontend <code className="rounded bg-muted px-1 text-xs text-foreground">.env.local</code>{" "}
                  da moslang.
                </>
              ) : (
                getUserFacingError(createCtxQ.error, "Zakaz formasi ma’lumotlari yuklanmadi.")
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void createCtxQ.refetch()}
            >
              Qayta urinish
            </Button>
          </div>
        ) : null}

        {!isPolkiSheet ? (
          isExchangeFlow ? (
            <div
              className="rounded-lg border border-dashed border-violet-500/40 bg-violet-500/5 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground"
              role="note"
            >
              <span className="font-medium text-foreground">Обмен: </span>
              минус списывается только в пределах остатка по доставленному заказу; плюс — только из группы
              взаимозаменяемых для выбранной позиции (тип цены должен быть разрешён в группе).
            </div>
          ) : (
          <div
            className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground"
            role="note"
          >
            <span className="font-medium text-foreground">Rejalashtirilmoqda: </span>
            buyurtma cheklovlari, taklif asosidagi zakaz, qator bo‘yicha skidka — alohida modul va API bilan
            ulanadi. Hozir «Skidka turi» faqat ko‘rinish; bonuslar serverdagi{" "}
            <span className="font-medium text-foreground">apply_bonus</span> bilan bog‘langan.
          </div>
          )
        ) : (
          <div
            className="rounded-lg border border-emerald-600/25 bg-emerald-600/5 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground"
            role="note"
          >
            <span className="font-medium text-foreground">Возврат с полки: </span>
            учитываются только продажи со статусом «{orderStatusLabelRu("delivered")}» (товар у клиента, возврат — на
            склад); после проведения — приход на{" "}
            <span className="font-medium text-foreground">склад возврата</span>, суммы и бонусы считает сервер.
            Повторный возврат по тому же заказу возможен, пока в строках остаётся количество к возврату (учтены
            уже проведённые возвраты).
          </div>
        )}

        <section
          className={cn(
            "rounded-xl border bg-card p-4 shadow-sm sm:p-5 lg:p-6",
            isPolkiSheet && "border-teal-800/20 dark:border-teal-800/35"
          )}
        >
          {!isPolkiSheet ? (
          <>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-sm font-semibold text-foreground">Buyurtma ma&apos;lumotlari</h2>
            <p className="text-xs text-muted-foreground">
              Tartib: klient → ombor → narx / bonus → mahsulotlar
            </p>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oc-client">Klient</Label>
              <PolkiClientSearchSelect
                id="oc-client"
                data-testid="order-create-client"
                tenantSlug={tenantSlug}
                value={clientId}
                selectedLabel={polkiSelectedClientLabel}
                eligibleClientIds={orderClientPickerScopeIds}
                placeholder="Klientni tanlang"
                className="w-full"
                disabled={mutation.isPending || loadingLists}
                onValueChange={(id) => {
                  resetFlowAfterClientChange();
                  setClientId(id);
                  if (isPolkiByOrder) setPolkiOrderIds([]);
                  if (isExchangeFlow) {
                    setExchangeSourceOrderIds([]);
                    setExMinusKey("");
                    setExMinusQty("");
                    setExPlusProductId("");
                    setExPlusQty("");
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oc-order-date">Buyurtma sanasi</Label>
              <Input
                id="oc-order-date"
                readOnly
                className={cn(fieldClass, "cursor-default bg-muted/40")}
                value={orderOpenedAt.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}
              />
              <p className="text-[11px] text-muted-foreground">
                Eski narxlar rejimi —{" "}
                <span className="font-medium text-foreground">rejalashtirilmoqda</span> (API yo‘q).
              </p>
            </div>
          </div>

          <div className="grid min-h-[520px] grid-cols-1 gap-6 xl:min-h-[calc(100vh-18rem)] xl:grid-cols-12 xl:gap-5">
            {/* Chap: zakaz maydonlari + narx turi */}
            <div className="space-y-4 xl:col-span-4 xl:border-r xl:border-border/70 xl:pr-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zakaz</p>
              <div className="space-y-2">
                <Label htmlFor="oc-warehouse">
                  {isPolkiSheet ? "Sklad qaytarish (qaytarish ombori)" : "Ombor"}
                </Label>
                <FilterSelect
                  id="oc-warehouse"
                  data-testid="order-create-warehouse"
                  className={fieldClass}
                  emptyLabel={isPolkiSheet ? "Qaytarish omborini tanlang" : "Omborni tanlang"}
                  aria-label={isPolkiSheet ? "Qaytarish ombori" : "Ombor"}
                  value={warehouseId}
                  onChange={(e) => {
                    setSelectionNotice(null);
                    setWarehouseId(e.target.value);
                  }}
                  disabled={mutation.isPending || loadingLists || !canPickWarehouse}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.name}
                      {w.stock_purpose === "return" ? " · return" : ""}
                    </option>
                  ))}
                </FilterSelect>
                {!canPickWarehouse ? (
                  <p className="text-[11px] text-muted-foreground">Avval klientni tanlang.</p>
                ) : null}
              </div>
              {isPolkiFree ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Davr</Label>
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      fieldClass,
                      "h-10 justify-start gap-2 font-normal",
                      polkiRangeOpen && "border-primary/60 bg-primary/5"
                    )}
                    aria-expanded={polkiRangeOpen}
                    aria-haspopup="dialog"
                    disabled={mutation.isPending || !canPickWarehouse}
                    onClick={(e) => {
                      polkiRangeAnchorRef.current = e.currentTarget;
                      setPolkiRangeOpen((o) => !o);
                    }}
                  >
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">
                      {formatDateRangeButton(polkiDateFrom, polkiDateTo)}
                    </span>
                  </button>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="oc-agent">Agent{requiresAgentAndPayment ? " *" : ""}</Label>
                <FilterSearchableSelect
                  id="oc-agent"
                  className={fieldClass}
                  emptyLabel={requiresAgentAndPayment ? "Agentni tanlang" : "Agent (ixtiyoriy)"}
                  value={agentId}
                  options={agentFilterOptions}
                  onValueChange={(v) => {
                    setSelectionNotice(null);
                    setAgentId(v);
                  }}
                  disabled={mutation.isPending || loadingLists || !canPickWarehouse}
                  searchPlaceholder="Qidiruv: login, ism"
                  emptyMessage="Mos agent topilmadi"
                  minPopoverWidth={320}
                  includeEmptyOption={!requiresAgentAndPayment || !agentId.trim()}
                />
                {clientId.trim() ? (
                  <OrderCreateAgentLockHint
                    assignments={clientAssignmentsForLock}
                    selectedAgentId={
                      Number.isFinite(selectedAgentIdNum) && selectedAgentIdNum > 0
                        ? selectedAgentIdNum
                        : null
                    }
                  />
                ) : null}
              </div>
              {requiresAgentAndPayment && showOrderPaymentMethodSelector ? (
                <div className="space-y-2">
                  <Label htmlFor="oc-pay-method">To‘lov usuli</Label>
                  <FilterSelect
                    id="oc-pay-method"
                    data-testid="order-create-payment-method"
                    className={fieldClass}
                    emptyLabel="Usulni tanlang"
                    aria-label="To‘lov usuli"
                    value={paymentMethodRef}
                    onChange={(e) => setPaymentMethodRef(e.target.value)}
                    disabled={mutation.isPending || loadingLists || !canPickWarehouse}
                  >
                    {paymentMethodSelectOptions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </FilterSelect>
                  {paymentMethodSelectOptions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Sozlamalarda «To‘lov usullari» bo‘sh —{" "}
                      <Link className="underline" href="/settings">
                        sozlamalar
                      </Link>{" "}
                      bo‘limida usullarni qo‘shing.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!isPolkiSheet ? (
                <div className="space-y-2">
                  <Label htmlFor="oc-exp">Ekspeditor</Label>
                  <FilterSearchableSelect
                    id="oc-exp"
                    className={fieldClass}
                    emptyLabel="Avtobog‘lash"
                    value={expeditorUserId}
                    options={expeditorFilterOptions}
                    onValueChange={(v) => {
                      setSelectionNotice(null);
                      setExpeditorUserId(v);
                    }}
                    disabled={mutation.isPending || createCtxQ.isPending || !canPickPricingAndExpeditor}
                    searchPlaceholder="Qidiruv: ID, login, FIO"
                    emptyMessage="Topilmadi"
                    minPopoverWidth={280}
                  />
                  {!canPickPricingAndExpeditor ? (
                    <p className="text-[11px] text-muted-foreground">Ombor tanlang — keyin ochiladi.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Narx turi</p>
                <div
                  className={cn(
                    "max-h-[min(52vh,420px)] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/10 p-3",
                    !canPickPricingAndExpeditor && "opacity-60"
                  )}
                  role="radiogroup"
                  aria-label="Narx turi"
                >
                  {(createCtxQ.data?.price_types?.length ? createCtxQ.data.price_types : ["retail"]).map((t) => (
                    <label
                      key={t}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:bg-muted/60",
                        priceType === t && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <input
                        type="radio"
                        name="oc-price-type"
                        className="size-4 border-input"
                        checked={priceType === t}
                        onChange={() => setPriceType(t)}
                        disabled={
                          mutation.isPending || createCtxQ.isPending || !canPickPricingAndExpeditor
                        }
                      />
                      <span className="font-medium capitalize">{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              {!isPolkiSheet ? (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-input"
                      checked={orderIsConsignment}
                      onChange={(e) => setOrderIsConsignment(e.target.checked)}
                      disabled={mutation.isPending}
                    />
                    <span>
                      Konsignatsiya zakazi
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Agent limiti va «Консигнация» sozlamalariga bog‘liq. Agent majburiy.
                      </span>
                    </span>
                  </label>
                  {orderIsConsignment ? (
                    <div className="space-y-1 pl-6">
                      <Label className="text-xs text-muted-foreground">To‘lash muddati (ixtiyoriy)</Label>
                      <button
                        ref={consignmentDueAnchorRef}
                        type="button"
                        disabled={mutation.isPending}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-10 w-full max-w-xs justify-start gap-2 font-normal",
                          consignmentDueOpen && "border-primary/60 bg-primary/5"
                        )}
                        aria-expanded={consignmentDueOpen}
                        aria-haspopup="dialog"
                        onClick={() => setConsignmentDueOpen((o) => !o)}
                      >
                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">
                          {formatRuDateButton(consignmentDueDate) || "kk.oo.yyyy"}
                        </span>
                      </button>
                      <DatePickerPopover
                        open={consignmentDueOpen}
                        onOpenChange={setConsignmentDueOpen}
                        anchorRef={consignmentDueAnchorRef}
                        value={consignmentDueDate}
                        onChange={setConsignmentDueDate}
                        footerLabels={{ clear: "Tozalash", today: "Bugun", close: "Yopish" }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isPolkiSheet ? (
                <div className="space-y-2">
                  <Label htmlFor="oc-bonus-mode">Bonus turi</Label>
                  <select
                    id="oc-bonus-mode"
                    className={fieldClass}
                    value={applyBonus ? "auto" : "off"}
                    onChange={(e) => setApplyBonus(e.target.value === "auto")}
                    disabled={mutation.isPending || !canPickPricingAndExpeditor}
                  >
                    <option value="auto">Avto (bonus qoidalarini qo‘llash)</option>
                    <option value="off">O‘chirilgan</option>
                  </select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="oc-discount-mode">Skidka turi</Label>
                <select id="oc-discount-mode" className={fieldClass} disabled title="API — keyinroq">
                  <option value="auto">Avto</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {isPolkiSheet
                    ? "Skidka turi — namunadagi kabi joy; API keyin ulashadi."
                    : "Chiziq / foiz skidkalari keyin ulashadi; hozir narx turi va bonus holati ishlatiladi."}
                </p>
              </div>
            </div>

            {/* O‘ng: mahsulot kategoriyasi filtri */}
            <div className="min-w-0 space-y-3 xl:col-span-8 xl:border-l xl:border-border/70 xl:pl-5 xl:flex xl:flex-col">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mahsulot kategoriyalari
              </p>
              <div
                className={cn(
                  // Avval juda kichik edi; o‘ng panel bo‘sh joyidan foydalanib kattaroq qilamiz.
                  "min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-muted/15 p-3",
                  !canUseCategoryChips && "pointer-events-none opacity-50"
                )}
              >
                {!canUseCategoryChips ? (
                  <p className="text-xs text-muted-foreground">
                    {useSplitOrderCatalog && canPickProducts && createCtxQ.isError ? (
                      <span className="text-destructive">
                        Katalog yuklanmadi. Sahifani yangilang yoki qayta urinib ko‘ring.
                      </span>
                    ) : useSplitOrderCatalog &&
                      canPickProducts &&
                      (createCtxQ.isPlaceholderData || (createCtxQ.isPending && !createCtxQ.data)) ? (
                      "Katalog agent bo‘yicha yangilanmoqda…"
                    ) : isPolkiSheet ? (
                      !canPickProducts
                        ? "Avval klientni tanlang (va zakaz rejimida zakazni ham)."
                        : "Klient va ombordan keyin davr yoki zakazni tanlang — keyin kategoriyalar."
                    ) : !canPickProducts ? (
                      "Avval klient va omborni tanlang."
                    ) : (
                      "Avval agentni tanlang — shu agentga bog‘langan mahsulot kategoriyalari paydo bo‘ladi."
                    )}
                  </p>
                ) : categoriesWithWarehouseSellableStock == null ? (
                  <p className="text-xs text-muted-foreground">Ombor qoldiqlari (Fakt, Bron) yuklanmoqda…</p>
                ) : categoriesWithWarehouseSellableStock.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {stockQ.isError
                      ? "Qoldiqlarni yuklab bo‘lmadi — kategoriya ro‘yxini filtrlash mumkin emas."
                      : "Bu omborda katalog bo‘yicha Mavjud (fakt − bron) miqdori 0 dan yuqori bo‘lgan mahsulot yo‘q."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryIds([])}
                      disabled={mutation.isPending}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        !categoryFilterActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      )}
                    >
                      {!categoryFilterActive ? <Check className="size-3 shrink-0" aria-hidden /> : null}
                      Barchasi
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
                            "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
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
          </div>
          </>
          ) : (
          <>
            <div className="mb-3 rounded-lg border border-teal-800/25 bg-gradient-to-br from-teal-50/90 via-card to-card p-3 dark:from-teal-950/35 dark:via-card">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,16rem)] lg:items-end">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="oc-polki-doc-date"
                    className="text-[11px] font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-200/90"
                  >
                    Дата заявки
                  </Label>
                  <Input
                    id="oc-polki-doc-date"
                    type="date"
                    className={fieldClass}
                    value={polkiHeaderDate}
                    onChange={(e) => setPolkiHeaderDate(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label
                    htmlFor="oc-client-polki"
                    className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Клиент
                  </Label>
                  <PolkiClientSearchSelect
                    id="oc-client-polki"
                    data-testid="order-create-client"
                    tenantSlug={tenantSlug}
                    value={clientId}
                    selectedLabel={polkiSelectedClientLabel}
                    placeholder="Выберите клиента"
                    disabled={mutation.isPending || loadingLists}
                    onValueChange={(id) => {
                      resetFlowAfterClientChange();
                      setClientId(id);
                      if (isPolkiByOrder) setPolkiOrderIds([]);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Тип цены
                  </p>
                  <div className="flex max-h-[5.5rem] flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                    {(createCtxQ.data?.price_types?.length ? createCtxQ.data.price_types : ["retail"]).map((t) => (
                      <label
                        key={t}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          priceType === t
                            ? "border-teal-600 bg-teal-600 text-white shadow-sm dark:border-teal-500 dark:bg-teal-600"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
                        )}
                      >
                        <input
                          type="radio"
                          name="oc-polki-price-type"
                          className="sr-only"
                          checked={priceType === t}
                          onChange={() => setPriceType(t)}
                          disabled={mutation.isPending || createCtxQ.isPending}
                        />
                        <span>{POLKI_PRICE_TYPE_LABEL_RU[t] ?? t}</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex cursor-not-allowed items-center gap-2 text-[11px] text-muted-foreground opacity-60">
                    <input type="checkbox" disabled className="size-3.5 rounded border-input" />
                    Старые цены (скоро)
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/15 p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Параметры возврата
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-1 sm:col-span-2 xl:col-span-2">
                  <Label htmlFor="oc-warehouse-p" className="text-xs">
                    Склад возврата
                  </Label>
                  <FilterSelect
                    id="oc-warehouse-p"
                    data-testid="order-create-warehouse"
                    className={cn(fieldClass, "h-9")}
                    emptyLabel="Склад…"
                    aria-label="Склад возврата"
                    value={warehouseId}
                    onChange={(e) => {
                      setSelectionNotice(null);
                      setWarehouseId(e.target.value);
                    }}
                    disabled={mutation.isPending || loadingLists || !canPickWarehouse}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.name}
                        {w.stock_purpose === "return" ? " · возврат" : ""}
                      </option>
                    ))}
                  </FilterSelect>
                  {!canPickWarehouse ? (
                    <p className="text-[10px] text-muted-foreground">Сначала клиент.</p>
                  ) : null}
                </div>
                {isPolkiFree ? (
                  <div className="space-y-1 sm:col-span-2 xl:col-span-2">
                    <Label className="text-xs text-muted-foreground">Период</Label>
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        fieldClass,
                        "h-9 justify-start gap-2 font-normal",
                        polkiRangeOpen && "border-primary/60 bg-primary/5"
                      )}
                      aria-expanded={polkiRangeOpen}
                      aria-haspopup="dialog"
                      disabled={mutation.isPending || !canPickWarehouse}
                      onClick={(e) => {
                        polkiRangeAnchorRef.current = e.currentTarget;
                        setPolkiRangeOpen((o) => !o);
                      }}
                    >
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-xs">
                        {formatDateRangeButton(polkiDateFrom, polkiDateTo)}
                      </span>
                    </button>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label htmlFor="oc-agent-p" className="text-xs">
                    Агент
                  </Label>
                  <FilterSearchableSelect
                    id="oc-agent-p"
                    className={cn(fieldClass, "h-9")}
                    emptyLabel="—"
                    value={agentId}
                    options={agentFilterOptions}
                    onValueChange={(v) => {
                      setSelectionNotice(null);
                      setAgentId(v);
                    }}
                    disabled={mutation.isPending || loadingLists || !canPickWarehouse}
                    searchPlaceholder="Поиск: логин, имя"
                    emptyMessage="Нет совпадений"
                    minPopoverWidth={280}
                    includeEmptyOption={!agentId.trim()}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="oc-polki-trade" className="text-xs">
                    Направление
                  </Label>
                  <select
                    id="oc-polki-trade"
                    className={cn(fieldClass, "h-9 text-sm")}
                    value={polkiTradeDirection}
                    onChange={(e) => setPolkiTradeDirection(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {POLKI_TRADE_DIRECTION_OPTS.map((o) => (
                      <option key={o.value || "__empty"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="oc-polki-skidka" className="text-xs">
                    Скидка
                  </Label>
                  <select
                    id="oc-polki-skidka"
                    className={cn(fieldClass, "h-9 text-sm")}
                    value={polkiSkidkaType}
                    onChange={(e) => setPolkiSkidkaType(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {POLKI_SKIDKA_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {isPolkiByOrder ? (
                <div className="mt-3 border-t border-border/70 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-medium">Заказы (можно несколько)</Label>
                      <p className="text-[10px] leading-snug text-muted-foreground">
                        Только статус{" "}
                        <span className="font-medium text-foreground">
                          «{orderStatusLabelRu("delivered")}»
                        </span>
                        ; остальные не показываются.
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
                          Нет заказов со статусом «{orderStatusLabelRu("delivered")}». Возврат с полки по заказу
                          возможен только после доставки (сейчас у клиента есть заказы в статусах вроде «
                          {orderStatusLabelRu("new")}», «{orderStatusLabelRu("confirmed")}» и т.д.).
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
                                    const dateStr = o.created_at
                                      ? String(o.created_at).slice(0, 10)
                                      : "—";
                                    const hasBonus = polkiOrderRowHasBonus(o);
                                    const rowSelected = polkiOrderIdSet.has(o.id);
                                    const qtyDisp =
                                      o.qty != null && String(o.qty).trim() !== ""
                                        ? formatNumberGrouped(parseStockQty(o.qty), {
                                            maxFractionDigits: 3
                                          })
                                        : "—";
                                    const sumDisp =
                                      o.total_sum != null && String(o.total_sum).trim() !== ""
                                        ? formatNumberGrouped(parsePriceAmount(o.total_sum), {
                                            maxFractionDigits: 0
                                          })
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
                                        <td
                                          className="px-1 py-0.5 align-middle text-center"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="radio"
                                            name="polki-order-pick-monolith"
                                            className="border-input"
                                            checked={rowSelected}
                                            onChange={() => selectPolkiOrder(o.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`Заказ ${o.number}`}
                                          />
                                        </td>
                                        <td className="px-1.5 py-0.5 align-middle font-mono font-medium">
                                          {o.number}
                                        </td>
                                        <td className="px-1.5 py-0.5 align-middle tabular-nums text-muted-foreground">
                                          {dateStr}
                                        </td>
                                        <td
                                          className="max-w-[7rem] truncate px-1.5 py-0.5 align-middle text-muted-foreground"
                                          title={o.warehouse_name?.trim() ? o.warehouse_name : undefined}
                                        >
                                          {o.warehouse_name?.trim() ? o.warehouse_name : "—"}
                                        </td>
                                        <td className="px-1.5 py-0.5 align-middle text-right tabular-nums">
                                          {qtyDisp}
                                        </td>
                                        <td className="px-1.5 py-0.5 align-middle text-right tabular-nums">
                                          {sumDisp}
                                        </td>
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
                      Выбрано заказов: {polkiOrderIds.length}. Состав возврата и проведение — только по этим
                      заказам (можно одну или несколько строк в таблице).
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

          </>
          )}

          {!isPolkiSheet ? (
          <div className="mt-6 space-y-4 border-t border-border/70 pt-5">
            <p className="text-xs text-muted-foreground">
              Spravochniklar:{" "}
              <Link href="/settings/reasons/request-types" className="text-primary underline-offset-2 hover:underline">
                причины заявок
              </Link>
              ,{" "}
              <Link href="/settings/reasons/order-notes" className="text-primary underline-offset-2 hover:underline">
                примечание к заказу
              </Link>
              .
            </p>
            {requestTypeOptions.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Заявка / yetkazib berish turi</Label>
                <Select
                  key={`rt-${refSelectKey}`}
                  value={requestTypeRef || undefined}
                  onValueChange={(v) => setRequestTypeRef(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="oc-request-type" className="max-w-md">
                    <SelectValue placeholder="Tanlash ixtiyoriy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {requestTypeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {orderNoteOptions.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Tayyor izoh shabloni</Label>
                <Select
                  key={`on-${refSelectKey}`}
                  value={orderNotePreset || undefined}
                  onValueChange={(v) => setOrderNotePreset(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="oc-order-note-preset" className="max-w-md">
                    <SelectValue placeholder="Shablon tanlang (ixtiyoriy)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {orderNoteOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Label htmlFor="oc-comment">Izoh (ichki)</Label>
            <textarea
              id="oc-comment"
              rows={3}
              className={cn(
                fieldClass,
                "min-h-[5.5rem] resize-y py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              )}
              value={orderComment}
              onChange={(e) => setOrderComment(e.target.value)}
              disabled={mutation.isPending || !canPickPricingAndExpeditor}
              placeholder="Buyurtma bo‘yicha eslatma…"
              maxLength={4000}
            />
          </div>
          ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
            {refusalReasonPolkiOptions.length > 0 ? (
              <div className="space-y-1">
                <Label htmlFor="oc-polki-refusal-foot" className="text-xs">
                  Причина отказа
                </Label>
                <select
                  id="oc-polki-refusal-foot"
                  className={cn(fieldClass, "h-9 text-sm")}
                  value={refusalReasonRefPolki}
                  onChange={(e) => setRefusalReasonRefPolki(e.target.value)}
                  disabled={mutation.isPending}
                >
                  <option value="">—</option>
                  {refusalReasonPolkiOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {orderNoteOptions.length > 0 ? (
              <div className="space-y-1">
                <Label className="text-xs">Шаблон примечания</Label>
                <Select
                  key={`on-polki-${refSelectKey}`}
                  value={orderNotePreset || undefined}
                  onValueChange={(v) => setOrderNotePreset(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="oc-order-note-polki" className="h-9 text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {orderNoteOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="oc-comment-polki" className="text-xs">
                Комментарий
              </Label>
              <textarea
                id="oc-comment-polki"
                rows={2}
                className={cn(
                  fieldClass,
                  "min-h-[4rem] resize-y py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                )}
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                disabled={mutation.isPending}
                placeholder="Дополнительно (необязательно)…"
                maxLength={4000}
              />
            </div>
          </div>
          )}

          {clientSummaryQ.data ? (
            <div className="mt-4 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {isPolkiSheet ? (
                <>
                  <span className="font-medium text-foreground">Финансы клиента: </span>
                  баланс{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatNumberGrouped(clientSummaryQ.data.account_balance, { maxFractionDigits: 2 })}
                  </span>
                  {" · "}кредитный лимит{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatNumberGrouped(clientSummaryQ.data.credit_limit, { maxFractionDigits: 2 })}
                  </span>
                  {" · "}открытые заказы{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatNumberGrouped(clientSummaryQ.data.open_orders_total, { maxFractionDigits: 2 })}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">Mijoz moliyasi: </span>
                  balans{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatNumberGrouped(clientSummaryQ.data.account_balance, { maxFractionDigits: 2 })}
                  </span>
                  {" · "}kredit limiti{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatNumberGrouped(clientSummaryQ.data.credit_limit, { maxFractionDigits: 2 })}
                  </span>
                  {" · "}ochiq zakazlar{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatNumberGrouped(clientSummaryQ.data.open_orders_total, { maxFractionDigits: 2 })}
                  </span>
                </>
              )}
            </div>
          ) : null}
          {isPolkiSheet && polkiContextQ.data ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Макс. к возврату (оценка): </span>
              <span className="tabular-nums font-medium text-amber-800 dark:text-amber-200">
                {formatNumberGrouped(polkiContextQ.data.max_returnable_value, { maxFractionDigits: 2 })}
              </span>
              {" · "}
              <span className="font-medium text-foreground">Лимит позиций в документе: </span>
              {MAX_POLKI_RETURN_QTY} шт
            </div>
          ) : null}
        </section>

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
                задаёт сервер. Суммы в таблице и карточках — оценка по ценам продажи. В одном документе — не
                более {MAX_POLKI_RETURN_QTY} шт на склад за раз: в счёт входят и оплата, и бонус, если обе
                части физически возвращаются на склад (как в строке «Авторасп: … опл … бон»). При большем
                объёме оформите несколько возвратов.
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
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          {isPolkiSheet && !canSubmit && polkiSubmitBlockedReason ? (
            <p
              role="status"
              className="min-w-0 flex-1 text-xs leading-snug text-destructive sm:max-w-[min(100%,42rem)] sm:pr-2"
            >
              {polkiSubmitBlockedReason}
            </p>
          ) : null}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-auto">
            <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
              {isPolkiSheet ? "Отмена" : "Bekor"}
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
              className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-700"
            >
              {mutation.isPending
                ? isPolkiSheet
                  ? "Оформление…"
                  : "Saqlanmoqda…"
                : isPolkiSheet
                  ? "Возврат"
                  : isExchangeFlow
                    ? "Обмен"
                    : "Yaratish"}
            </Button>
          </div>
        </div>
      </div>
      {isPolkiFree ? (
        <DateRangePopover
          open={polkiRangeOpen}
          onOpenChange={setPolkiRangeOpen}
          anchorRef={polkiRangeAnchorRef}
          dateFrom={polkiDateFrom}
          dateTo={polkiDateTo}
          onApply={({ dateFrom, dateTo }) => {
            setPolkiDateFrom(dateFrom);
            setPolkiDateTo(dateTo);
          }}
        />
      ) : null}
    </PageShell>
  );

}
