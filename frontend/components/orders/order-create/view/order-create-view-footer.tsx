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

export function OrderCreateViewFooter({ vm }: { vm: OrderCreateVm }) {
  const {
    isPolkiSheet,
    isPolkiFree,
    polkiDateFrom,
    polkiDateTo,
    onCancel,
    canSubmit,
    isExchangeFlow,
    mutation,
    polkiRangeAnchorRef,
    polkiRangeOpen,
    polkiSubmitBlockedReason,
    setPolkiDateFrom,
    setPolkiDateTo,
    setPolkiRangeOpen,
  } = vm;

  return (
    <>
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
    </>
  );
}
