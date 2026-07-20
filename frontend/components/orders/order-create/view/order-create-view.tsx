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
import { PolkiShelfReturnView } from "./polki-shelf-return/polki-shelf-return-view";
import { OrderCreateViewHeader } from "./order-create-view-header";
import { OrderCreateViewAlerts } from "./order-create-view-alerts";
import { OrderCreateFormSection } from "./order-create-form-section";
import { OrderCreateCatalogSection } from "./order-create-catalog-section";
import { OrderCreateViewFooter } from "./order-create-view-footer";

export function OrderCreateView({ vm }: { vm: OrderCreateVm }) {
  if (vm.isPolkiSheet) {
    return <PolkiShelfReturnView vm={vm} />;
  }

  return (
    <PageShell>
      <OrderCreateViewHeader vm={vm} />
      <div className="flex w-full min-w-0 flex-col gap-6 pb-32">
        <OrderCreateViewAlerts vm={vm} />
        <OrderCreateFormSection vm={vm} />
        <OrderCreateCatalogSection vm={vm} />
      </div>
      <OrderCreateViewFooter vm={vm} />
    </PageShell>
  );
}
