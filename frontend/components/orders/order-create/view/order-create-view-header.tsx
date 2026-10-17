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

export function OrderCreateViewHeader({ vm }: { vm: OrderCreateVm }) {
  const {
    isPolkiByOrder,
    isPolkiSheet,
    isPolkiFree,
    polkiOrderIds,
    hasClient,
    hasWarehouse,
    polkiTotalReturnQtySum,
    polkiTotalBonusCashSum,
    hasPolkiQtyOverMax,
    hasPolkiBonusCashOverMax,
    agentId,
    onCancel,
    canSubmit,
    exchangePayloadCheck,
    exchangeReturnsQ,
    hasMissingPriceForSelected,
    hasQtyOverStock,
    isExchangeFlow,
    isEditMode,
    editOrderNumber,
    mutation,
    requestSubmit,
    paymentMethodRef,
    requiresAgentAndPayment,
    requiresPaymentMethodForSubmit,
    selectedItemsCount,
    stockReadyForLines,
  } = vm;

  return (
      <PageHeader
        title={
          isPolkiFree
            ? "Возврат с полки"
            : isPolkiByOrder
              ? "Возврат с полки по заказу"
              : isExchangeFlow
                ? "Обмен (связанный)"
                : isEditMode
                  ? editOrderNumber
                    ? `Редактирование заказа · ${editOrderNumber}`
                    : "Редактирование заказа"
                  : "Новый заказ"
        }
        description={
          isPolkiSheet
            ? isPolkiByOrder
              ? "Параметры и состав; по заказу — только доставленные заказы, можно выбрать несколько."
              : "Компактные параметры и таблица состава возврата за период."
            : isExchangeFlow
              ? "Минус по доставленному заказу, плюс только из группы взаимозаменяемых."
              : isEditMode
                ? "Только заказ в статусе «Новый». Клиент, агент и склад не меняются — остальные поля можно редактировать."
                : "Клиент, склад и количество товаров — на полной странице."
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/orders">
              {isPolkiSheet ? "← Заказы" : "← Список заказов"}
            </Link>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Отмена
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="order-create-submit"
              disabled={!canSubmit}
              onClick={() => requestSubmit()}
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
                          : hasPolkiBonusCashOverMax
                              ? "Сумма компенсации вместо бонуса превышает допустимое"
                              : hasPolkiQtyOverMax
                              ? "Количество не больше проданного"
                              : !stockReadyForLines
                                ? "Загрузка данных…"
                                : undefined
                  : !hasClient
                    ? "Сначала выберите клиента"
                    : !hasWarehouse
                      ? "Сначала выберите склад"
                      : requiresAgentAndPayment && !agentId.trim() && !isEditMode
                        ? "Выберите агента (торговый заказ)"
                      : requiresPaymentMethodForSubmit && !paymentMethodRef.trim()
                          ? "Выберите способ оплаты"
                          : isExchangeFlow
                            ? !agentId.trim()
                              ? "Выберите агента"
                              : exchangeReturnsQ.isLoading
                                ? "Загрузка строк заказа…"
                                : !exchangePayloadCheck.ok
                                  ? "Заполните минус/плюс и проверьте лимиты"
                                  : undefined
                            : selectedItemsCount === 0
                              ? "Укажите количество хотя бы для одного товара"
                              : hasQtyOverStock
                                ? "Количество не должно превышать остаток"
                                : hasMissingPriceForSelected
                                  ? "Есть товары без цены для выбранного типа цены"
                                  : !stockReadyForLines
                                    ? "Загрузка остатков…"
                                    : undefined
              }
            >
              {mutation.isPending
                ? isPolkiSheet
                  ? "Оформление…"
                  : "Сохранение…"
                : isPolkiSheet
                  ? "Возврат"
                  : isExchangeFlow
                    ? "Обмен"
                    : isEditMode
                      ? "Сохранить"
                      : "Создать"}
            </Button>
          </div>
        }
      />
  );
}
