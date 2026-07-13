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

export function OrderCreateViewAlerts({ vm }: { vm: OrderCreateVm }) {
  const {
    isPolkiSheet,
    createCtxQ,
    isExchangeFlow,
    localError,
    selectionNotice,
  } = vm;

  return (
    <>
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
    </>
  );
}
