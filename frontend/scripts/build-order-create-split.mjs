#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = path.join(root, "components/orders/order-create-workspace.tsx");
const src = readFileSync(srcPath, "utf8").split(/\r?\n/);
const hooksDir = path.join(root, "components/orders/order-create/hooks");
const viewDir = path.join(root, "components/orders/order-create/view");
mkdirSync(hooksDir, { recursive: true });
mkdirSync(viewDir, { recursive: true });

function slice(a, b) {
  return src.slice(a - 1, b).join("\n");
}

const queryImports = `"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import type { ClientRow } from "@/lib/client-types";
import type { ProductRow } from "@/lib/product-types";
import {
  buildPolkiPairRows,
  parsePriceAmount,
  parseStockQty,
  availableOrderQty,
  unitPriceForType,
  isPolkiShelfSourceOrder,
  isPolkiReturnByOrderPickable,
  polkiOrderRowHasBonus
} from "../utils";
import type { PolkiOrderPickRow } from "../types";
import { buildExchangePairRows } from "@/components/orders/exchange-order-create-panel";
import type { useOrderCreateState } from "./use-order-create-state";

type State = ReturnType<typeof useOrderCreateState>;

export function useOrderCreateQueries(
  tenantSlug: string | null,
  onCreated: () => void,
  state: State
) {
  const {
    isExchangeFlow,
    isPolkiFree,
    isPolkiByOrder,
    isPolkiSheet,
    requiresAgentForProductCatalog,
    clientId,
    warehouseId,
    agentId,
    selectedClientIdNum,
    selectedAgentIdNum,
    hasAgentSelected,
    agentCatalogReady,
    selectedWarehouseIdNum,
    selectedExpeditorIdNum,
    debugOrderCreate,
    polkiOrderIdsSortedKey,
    polkiOrderIdSet,
    polkiDateFrom,
    polkiDateTo,
    polkiOrderIds,
    polkiTotalQty,
    polkiBonusToBalance,
    polkiBonusCash,
    exchangeSourceOrderIds,
    exMinusKey,
    exMinusQty,
    exPlusProductId,
    exPlusQty,
    qtyByProductId,
    blockByProductId,
    productSearch,
    selectedCategoryIds,
    activeCatalogCategoryId,
    priceType,
    applyBonus
  } = state;

`;

writeFileSync(
  path.join(hooksDir, "use-order-create-queries.ts"),
  queryImports + slice(210, 1315) + "\n\n  return {\n    createCtxQ,\n    stockQ,\n    polkiOrdersPickQ,\n    exchangeReturnsQ,\n    polkiContextQ,\n    clientSummaryQ,\n    uiPrefsQ,\n    useSplitOrderCatalog,\n    stockProductIdsKey,\n    catalogProducts,\n    displayProducts,\n    productCategoriesForChips,\n    warehouses,\n    warehouseIdSet,\n    agents,\n    agentIdSet,\n    expeditors,\n    priceTypes,\n    ctxProfile,\n    selectedClientRow,\n    selectedClientExpeditorIds,\n    selectedClientExpeditorIdSet,\n    polkiSelectedClientLabel,\n    polkiRowsAll,\n    polkiOrderGroups,\n    polkiFilteredRowsAll,\n    exchangePairRows,\n    exchangePayloadCheck,\n    stockReadyForLines,\n    hasQtyOverStock,\n    hasMissingPriceForSelected,\n    missingPriceProductNames,\n    selectedItemsCount,\n    selectedTotalQty,\n    estimatedSum,\n    totalVolumeM3,\n    hasClient,\n    hasWarehouse,\n    canPickWarehouse,\n    canPickPricingAndExpeditor,\n    canPickProducts,\n    canShowOrderCatalog,\n    loadingLists,\n    canShowPolkiGrid,\n    canUseCategoryChips,\n    polkiTotalReturnQtySum,\n    polkiVolumeM3,\n    polkiEstimatedSum,\n    polkiDebtHintSum,\n    polkiTotalBonusCashSum,\n    hasPolkiQtyOverMax,\n    hasPolkiBonusCashOverMax,\n    polkiSubmitBlockedReason,\n    requiresAgentAndPayment,\n    requiresPaymentMethodForSubmit,\n    categoryIssueCountById\n  };\n}\n",
  "utf8"
);

const mutationImports = `"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AxiosError } from "axios";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { MAX_POLKI_RETURN_QTY, POLKI_TRADE_DIRECTION_OPTS, POLKI_SKIDKA_OPTS } from "../constants";
import { parsePriceAmount, polkiSplitTotal } from "../utils";
import { refEntryLabelByStored } from "@/lib/profile-ref-entries";
import { buildExchangeCreateBody } from "@/components/orders/exchange-order-create-panel";
import type { useOrderCreateState } from "./use-order-create-state";
import type { useOrderCreateQueries } from "./use-order-create-queries";

type State = ReturnType<typeof useOrderCreateState>;
type Q = ReturnType<typeof useOrderCreateQueries>;

export function useOrderCreateMutation(
  tenantSlug: string | null,
  onCreated: () => void,
  state: State,
  q: Q
) {
`;

writeFileSync(
  path.join(hooksDir, "use-order-create-mutation.ts"),
  mutationImports + slice(1317, 1989) + "\n\n  return { mutation, canSubmit };\n}\n",
  "utf8"
);

writeFileSync(
  path.join(hooksDir, "use-order-create.ts"),
  `"use client";

import type { OrderCreateProps } from "../types";
import { useOrderCreateState } from "./use-order-create-state";
import { useOrderCreateQueries } from "./use-order-create-queries";
import { useOrderCreateMutation } from "./use-order-create-mutation";

export function useOrderCreate({ tenantSlug, onCreated, onCancel, orderType }: OrderCreateProps) {
  const state = useOrderCreateState(orderType);
  const queries = useOrderCreateQueries(tenantSlug, onCreated, state);
  const { mutation, canSubmit } = useOrderCreateMutation(tenantSlug, onCreated, state, queries);
  return { tenantSlug, onCreated, onCancel, ...state, ...queries, mutation, canSubmit };
}

export type OrderCreateVm = ReturnType<typeof useOrderCreate>;
`,
  "utf8"
);

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
`;

writeFileSync(
  path.join(viewDir, "order-create-view.tsx"),
  viewImports +
    slice(2003, 3858).replace(/^export function OrderCreateWorkspace/m, "") +
    "\n}\n",
  "utf8"
);

writeFileSync(
  path.join(root, "components/orders/order-create-workspace.tsx"),
  `"use client";

import type { OrderCreateProps } from "@/components/orders/order-create/types";
import { useOrderCreate } from "@/components/orders/order-create/hooks/use-order-create";
import { OrderCreateView } from "@/components/orders/order-create/view/order-create-view";
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

console.log("split complete");
