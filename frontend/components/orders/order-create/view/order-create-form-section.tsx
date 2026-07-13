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

export function OrderCreateFormSection({ vm }: { vm: OrderCreateVm }) {
  const {
    isPolkiByOrder,
    tenantSlug,
    polkiOrdersForPick,
    polkiOrdersPickRawCount,
    isPolkiSheet,
    isPolkiFree,
    polkiDateFrom,
    polkiDateTo,
    polkiOrderIds,
    clientId,
    selectedAgentIdNum,
    expeditorUserId,
    categoryFilterActive,
    priceType,
    warehouseId,
    agentId,
    applyBonus,
    orderComment,
    requestTypeRef,
    orderNotePreset,
    polkiHeaderDate,
    polkiTradeDirection,
    polkiSkidkaType,
    refusalReasonRefPolki,
    agentFilterOptions,
    canPickPricingAndExpeditor,
    canPickProducts,
    canPickWarehouse,
    canUseCategoryChips,
    categoriesWithWarehouseSellableStock,
    categoryFilterSet,
    clientAssignmentsForLock,
    clientSummaryQ,
    consignmentDueAnchorRef,
    consignmentDueDate,
    consignmentDueOpen,
    createCtxQ,
    expeditorFilterOptions,
    isExchangeFlow,
    loadingLists,
    mutation,
    orderClientPickerScopeIds,
    orderIsConsignment,
    orderNoteOptions,
    orderOpenedAt,
    paymentMethodRef,
    paymentMethodSelectOptions,
    polkiContextQ,
    polkiOrderIdSet,
    polkiOrderPickHalfLists,
    polkiOrdersPickQ,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    polkiSelectedClientLabel,
    refSelectKey,
    refusalReasonPolkiOptions,
    requestTypeOptions,
    requiresAgentAndPayment,
    resetFlowAfterClientChange,
    setAgentId,
    setApplyBonus,
    setClientId,
    setConsignmentDueDate,
    setConsignmentDueOpen,
    setExMinusKey,
    setExMinusQty,
    setExPlusProductId,
    setExPlusQty,
    setExchangeSourceOrderIds,
    setExpeditorUserId,
    setOrderComment,
    setOrderIsConsignment,
    setOrderNotePreset,
    setPaymentMethodRef,
    setPolkiHeaderDate,
    setPolkiOrderIds,
    setPolkiRangeOpen,
    setPolkiSkidkaType,
    setPolkiTradeDirection,
    setPriceType,
    setRefusalReasonRefPolki,
    setRequestTypeRef,
    setSelectedCategoryIds,
    setSelectionNotice,
    setWarehouseId,
    showOrderPaymentMethodSelector,
    stockQ,
    selectPolkiOrder,
    useSplitOrderCatalog,
    warehouses,
  } = vm;

  return (
    <>
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
                            : "border-border bg-card text-slate-700 hover:bg-muted dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
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
            </div>
          ) : null}
        </section>
    </>
  );
}
