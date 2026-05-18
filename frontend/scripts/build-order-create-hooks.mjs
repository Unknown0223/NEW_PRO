#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "components/orders/order-create-workspace.tsx"), "utf8").split(/\r?\n/);
const mod = path.join(root, "components/orders/order-create/hooks");
mkdirSync(mod, { recursive: true });

function slice(a, b) {
  return src.slice(a - 1, b).join("\n");
}

writeFileSync(
  path.join(mod, "use-order-create-state.ts"),
  `"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { currentMonthEndIsoDate } from "../utils";
import type { OrderCreateProps } from "../types";

export function useOrderCreateState(orderType: OrderCreateProps["orderType"]) {
  const normalizedType = (orderType ?? "order").trim();
  const isExchangeFlow = normalizedType === "exchange";
  const isPolkiFree = normalizedType === "return";
  const isPolkiByOrder = normalizedType === "return_by_order";
  const isPolkiSheet = isPolkiFree || isPolkiByOrder;
  const requiresAgentForProductCatalog = !isPolkiSheet && !isExchangeFlow;

${slice(86, 209)}

  return {
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
    ORDER_CREATE_DEBUG,
    debugOrderCreate,
    polkiOrderIdsSortedKey,
    polkiOrderIdSet
  };
}
`,
  "utf8"
);

console.log("wrote use-order-create-state.ts");
