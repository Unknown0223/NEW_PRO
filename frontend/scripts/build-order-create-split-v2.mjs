#!/usr/bin/env node
/**
 * order-create-workspace.tsx → use-order-create.ts + order-create-view.tsx + thin barrel.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "components/orders/order-create/order-create-workspace.tsx");
const src = readFileSync(srcPath, "utf8").split(/\r?\n/);

const fnLine = src.findIndex((l) => l.startsWith("export function OrderCreateWorkspace"));
if (fnLine < 0) throw new Error("OrderCreateWorkspace not found");

const header = src.slice(0, fnLine).join("\n");
const bodyStart = fnLine + 1;
const noTenantIdx = src.findIndex((l, i) => i > fnLine && l.trim() === "if (!tenantSlug) {");
const mainReturnIdx = src.findIndex(
  (l, i) =>
    i > noTenantIdx &&
    l.trim() === "return (" &&
    src[i + 1]?.trim() === "<PageShell>" &&
    src.slice(i, i + 5).some((ln) => ln.includes("<PageHeader"))
);
if (noTenantIdx < 0 || mainReturnIdx < 0) throw new Error("markers not found");

const hookBody = src.slice(bodyStart, noTenantIdx).join("\n");
let viewJsx = src.slice(mainReturnIdx).join("\n");
viewJsx = viewJsx.replace(/\n\}\s*$/, "\n");

const hookImports = `"use client";

import { api } from "@/lib/api";
import { ORDER_TYPE_VALUES } from "@/lib/order-types";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, isApiUnreachable, withApiSupportLine } from "@/lib/error-utils";
import type { ClientRow } from "@/lib/client-types";
import type { ProductRow } from "@/lib/product-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AxiosError } from "axios";
import { STALE } from "@/lib/query-stale";
import {
  orderAgentFilterOption,
  orderClientPickerDisplayName,
  orderExpeditorFilterOption
} from "@/lib/order-picker-labels";
import {
  activeRefSelectOptions,
  refEntryLabelByStored
} from "@/lib/profile-ref-entries";
import {
  buildExchangeCreateBody,
  buildExchangePairRows
} from "@/components/orders/exchange-order-create-panel";
import type {
  OrderCreateProps,
  PolkiOrderPickRow,
  PolkiPairRowModel,
  PolkiClientItem,
  PolkiOrderGroup
} from "../types";
import { MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from "../constants";
import {
  parsePriceAmount,
  parseStockQty,
  availableOrderQty,
  formatQtyState,
  orderStatusLabelRu,
  currentMonthEndIsoDate,
  unitPriceForType,
  buildPolkiPairRows,
  polkiSplitTotal,
  isPolkiShelfSourceOrder,
  isPolkiReturnByOrderPickable,
  polkiOrderRowHasBonus
} from "../utils";

export function useOrderCreate({ tenantSlug, onCreated, onCancel, orderType }: OrderCreateProps) {
${hookBody}
  return {
    tenantSlug,
    onCreated,
    onCancel,
    orderType,
    qc,
    normalizedType,
    isExchangeFlow,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    requiresAgentForProductCatalog,
    clientId,
    setClientId,
    warehouseId,
    setWarehouseId,
    agentId,
    setAgentId,
    applyBonus,
    setApplyBonus,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    qtyByProductId,
    setQtyByProductId,
    blockByProductId,
    setBlockByProductId,
    localError,
    setLocalError,
    selectionNotice,
    setSelectionNotice,
    expeditorUserId,
    setExpeditorUserId,
    priceType,
    setPriceType,
    orderComment,
    setOrderComment,
    requestTypeRef,
    setRequestTypeRef,
    orderNotePreset,
    setOrderNotePreset,
    refSelectKey,
    setRefSelectKey,
    productSearch,
    setProductSearch,
    orderOpenedAt,
    polkiDateFrom,
    setPolkiDateFrom,
    polkiDateTo,
    setPolkiDateTo,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    setPolkiRangeOpen,
    polkiOrderIds,
    setPolkiOrderIds,
    polkiTotalQty,
    setPolkiTotalQty,
    polkiBonusToBalance,
    setPolkiBonusToBalance,
    polkiBonusCash,
    setPolkiBonusCash,
    refusalReasonRefPolki,
    setRefusalReasonRefPolki,
    polkiHeaderDate,
    setPolkiHeaderDate,
    polkiTradeDirection,
    setPolkiTradeDirection,
    polkiSkidkaType,
    setPolkiSkidkaType,
    orderIsConsignment,
    setOrderIsConsignment,
    consignmentDueDate,
    setConsignmentDueDate,
    consignmentDueOpen,
    setConsignmentDueOpen,
    consignmentDueAnchorRef,
    paymentMethodRef,
    setPaymentMethodRef,
    exchangeSourceOrderIds,
    setExchangeSourceOrderIds,
    exMinusKey,
    setExMinusKey,
    exMinusQty,
    setExMinusQty,
    exPlusProductId,
    setExPlusProductId,
    exPlusQty,
    setExPlusQty,
    resetFlowAfterClientChange,
    selectedClientIdNum,
    selectedAgentIdNum,
    hasAgentSelected,
    agentCatalogReady,
    selectedWarehouseIdNum,
    selectedExpeditorIdNum,
    debugOrderCreate,
    polkiOrderIdsSortedKey,
    polkiOrderIdSet,
    createCtxQ,
    stockQ,
    polkiOrdersPickQ,
    exchangeReturnsQ,
    polkiContextQ,
    clientSummaryQ,
    uiPrefsQ,
    mutation,
    canSubmit,
    polkiSubmitBlockedReason,
    useSplitOrderCatalog,
    stockProductIdsKey,
    catalogProducts,
    displayProducts,
    productCategoriesForChips,
    warehouses,
    warehouseIdSet,
    agents,
    agentIdSet,
    expeditors,
    priceTypes,
    ctxProfile,
    selectedClientRow,
    selectedClientExpeditorIds,
    selectedClientExpeditorIdSet,
    polkiSelectedClientLabel,
    polkiRowsAll,
    polkiOrderGroups,
    polkiFilteredRowsAll,
    exchangePairRows,
    exchangePayloadCheck,
    stockReadyForLines,
    hasQtyOverStock,
    hasMissingPriceForSelected,
    missingPriceProductNames,
    selectedItemsCount,
    selectedTotalQty,
    estimatedSum,
    totalVolumeM3,
    hasClient,
    hasWarehouse,
    canPickWarehouse,
    canPickPricingAndExpeditor,
    canPickProducts,
    canShowOrderCatalog,
    loadingLists,
    canShowPolkiGrid,
    canUseCategoryChips,
    polkiTotalReturnQtySum,
    polkiVolumeM3,
    polkiEstimatedSum,
    polkiDebtHintSum,
    polkiTotalBonusCashSum,
    hasPolkiQtyOverMax,
    hasPolkiBonusCashOverMax,
    requiresAgentAndPayment,
    requiresPaymentMethodForSubmit,
    categoryIssueCountById,
    polkiOrdersPickRows,
    polkiOrdersFiltered,
    exchangeSourceOrders,
    exchangeMinusOptions,
    exchangePlusOptions,
    clientIdNum
  } as const;
}

export type OrderCreateVm = ReturnType<typeof useOrderCreate>;
`;

const viewImports = `"use client";

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
import { fieldClass, MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from "../constants";
import {
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
    normalizedType,
    isExchangeFlow,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    requiresAgentForProductCatalog,
    clientId,
    setClientId,
    warehouseId,
    setWarehouseId,
    agentId,
    setAgentId,
    applyBonus,
    setApplyBonus,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    qtyByProductId,
    setQtyByProductId,
    blockByProductId,
    setBlockByProductId,
    localError,
    setLocalError,
    selectionNotice,
    setSelectionNotice,
    expeditorUserId,
    setExpeditorUserId,
    priceType,
    setPriceType,
    orderComment,
    setOrderComment,
    requestTypeRef,
    setRequestTypeRef,
    orderNotePreset,
    setOrderNotePreset,
    refSelectKey,
    setRefSelectKey,
    productSearch,
    setProductSearch,
    polkiDateFrom,
    setPolkiDateFrom,
    polkiDateTo,
    setPolkiDateTo,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    setPolkiRangeOpen,
    polkiOrderIds,
    setPolkiOrderIds,
    polkiTotalQty,
    setPolkiTotalQty,
    polkiBonusToBalance,
    setPolkiBonusToBalance,
    polkiBonusCash,
    setPolkiBonusCash,
    refusalReasonRefPolki,
    setRefusalReasonRefPolki,
    polkiHeaderDate,
    setPolkiHeaderDate,
    polkiTradeDirection,
    setPolkiTradeDirection,
    polkiSkidkaType,
    setPolkiSkidkaType,
    orderIsConsignment,
    setOrderIsConsignment,
    consignmentDueDate,
    setConsignmentDueDate,
    consignmentDueOpen,
    setConsignmentDueOpen,
    consignmentDueAnchorRef,
    paymentMethodRef,
    setPaymentMethodRef,
    exchangeSourceOrderIds,
    setExchangeSourceOrderIds,
    exMinusKey,
    setExMinusKey,
    exMinusQty,
    setExMinusQty,
    exPlusProductId,
    setExPlusProductId,
    exPlusQty,
    setExPlusQty,
    resetFlowAfterClientChange,
    selectedClientIdNum,
    selectedAgentIdNum,
    hasAgentSelected,
    agentCatalogReady,
    debugOrderCreate,
    polkiOrderIdsSortedKey,
    polkiOrderIdSet,
    createCtxQ,
    stockQ,
    polkiOrdersPickQ,
    exchangeReturnsQ,
    polkiContextQ,
    clientSummaryQ,
    uiPrefsQ,
    mutation,
    canSubmit,
    polkiSubmitBlockedReason,
    useSplitOrderCatalog,
    catalogProducts,
    displayProducts,
    productCategoriesForChips,
    warehouses,
    agents,
    expeditors,
    priceTypes,
    ctxProfile,
    selectedClientRow,
    polkiSelectedClientLabel,
    polkiRowsAll,
    polkiOrderGroups,
    exchangePairRows,
    exchangePayloadCheck,
    stockReadyForLines,
    hasQtyOverStock,
    hasMissingPriceForSelected,
    missingPriceProductNames,
    selectedItemsCount,
    selectedTotalQty,
    estimatedSum,
    totalVolumeM3,
    hasClient,
    hasWarehouse,
    canPickWarehouse,
    canPickPricingAndExpeditor,
    canPickProducts,
    canShowOrderCatalog,
    loadingLists,
    canShowPolkiGrid,
    canUseCategoryChips,
    polkiTotalReturnQtySum,
    polkiVolumeM3,
    polkiEstimatedSum,
    polkiDebtHintSum,
    polkiTotalBonusCashSum,
    hasPolkiQtyOverMax,
    hasPolkiBonusCashOverMax,
    requiresAgentAndPayment,
    requiresPaymentMethodForSubmit,
    categoryIssueCountById,
    polkiOrdersPickRows,
    polkiOrdersFiltered,
    exchangeSourceOrders,
    exchangeMinusOptions,
    exchangePlusOptions
  } = vm;

${viewJsx}
}
`;

const hooksDir = path.join(root, "components/orders/order-create/hooks");
const viewDir = path.join(root, "components/orders/order-create/view");
mkdirSync(hooksDir, { recursive: true });
mkdirSync(viewDir, { recursive: true });

writeFileSync(path.join(hooksDir, "use-order-create.ts"), hookImports, "utf8");
writeFileSync(path.join(viewDir, "order-create-view.tsx"), viewImports, "utf8");

writeFileSync(
  path.join(root, "components/orders/order-create/order-create-workspace.tsx"),
  `"use client";

import type { OrderCreateProps } from "./types";
import { useOrderCreate } from "./hooks/use-order-create";
import { OrderCreateView } from "./view/order-create-view";
import { PageShell } from "@/components/dashboard/page-shell";
import Link from "next/link";

export function OrderCreateWorkspace(props: OrderCreateProps) {
  const vm = useOrderCreate(props);
  if (!vm.tenantSlug) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      </PageShell>
    );
  }
  return <OrderCreateView vm={vm} />;
}
`,
  "utf8"
);

console.log(
  "hook lines",
  hookImports.split("\n").length,
  "view lines",
  viewImports.split("\n").length,
  "workspace thin"
);
