import type { AxiosError } from "axios";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import type { OrderCreateErrorTarget } from "./draft.types";

export type MutationFailFn = (message: string, target?: OrderCreateErrorTarget) => void;

/** Shared mutation onError mapping (ordinary + exchange + polki). */
export function handleOrderCreateMutationError(args: {
  e: Error;
  isPolkiSheet: boolean;
  priceType: string;
  fail: MutationFailFn;
  setLocalError: (msg: string | null) => void;
}): void {
  const { e, isPolkiSheet, priceType, fail, setLocalError } = args;
if (isPolkiSheet) {
  if (e.message === "warehouse") {
    fail("Выберите склад возврата.", "warehouse");
    return;
  }
  if (e.message === "client") {
    fail("Выберите клиента.", "client");
    return;
  }
  if (e.message === "polki_order") {
    fail(
      "Отметьте хотя бы один заказ со статусом «Доставлен» (доступны только такие заказы).",
      "polki-orders"
    );
    return;
  }
  if (e.message === "polki_missing_order") {
    fail("Для строки не указан заказ — обновите страницу.", "polki-lines");
    return;
  }
  if (e.message === "polki_qty_over") {
    fail("Количество возврата не больше проданного.", "polki-lines");
    return;
  }
  if (e.message === "polki_over_max") {
    fail(
      "Количество к возврату не может превышать остаток по заказу (см. «макс. всего» в строке).",
      "polki-lines"
    );
    return;
  }
  if (e.message === "nolines") {
    fail(
      "Укажите хотя бы одну позицию с количеством или компенсацией бонуса.",
      "polki-lines"
    );
    return;
  }
  if (e.message === "polki_bonus_preview_pending") {
    fail("Дождитесь окончания расчёта бонуса (колонка «Бонус / баланс»).", "polki-lines");
    return;
  }
  if (e.message === "polki_bonus_preview_error") {
    fail("Не удалось рассчитать бонус. Проверьте сеть и количества в таблице.", "polki-lines");
    return;
  }
  if (e.message === "polki_bonus_preview") {
    fail(
      "Сначала дождитесь авто-расчёта бонуса по всем строкам с количеством.",
      "polki-lines"
    );
    return;
  }
  if (e.message === "qty") {
    fail("Во всех строках количество должно быть положительным.", "polki-lines");
    return;
  }
  if (e.message === "qty_over_stock") {
    fail("Количество не больше остатка по каждой позиции.", "polki-lines");
    return;
  }
}
if (e.message === "warehouse") {
  fail("Выберите склад.", "warehouse");
  return;
}
if (e.message === "agent") {
  fail("Для торгового заказа выберите агента.", "agent");
  return;
}
if (e.message === "payment_method") {
  fail("Выберите способ оплаты.", "payment");
  return;
}
if (e.message === "payment_method_empty") {
  fail("Список способов оплаты пуст. Проверьте агента/экспедитора или настройки.", "payment");
  return;
}
if (e.message === "consignment_patch") {
  fail("Не удалось сохранить признак консигнации. Проверьте статус.");
  return;
}
if (e.message === "client") {
  fail("Выберите клиента.", "client");
  return;
}
if (e.message === "polki_order") {
  fail("В режиме «По заказу» выберите хотя бы один заказ.", "polki-orders");
  return;
}
if (e.message === "polki_missing_order") {
  fail("Для строки не указан заказ — обновите страницу.", "polki-lines");
  return;
}
if (e.message === "polki_qty_over") {
  fail("Количество возврата не должно превышать проданное.", "polki-lines");
  return;
}
if (e.message === "polki_over_max") {
  fail("Количество возврата не должно превышать остаток по заказу.", "polki-lines");
  return;
}
if (e.message === "nolines") {
  fail("Нужна хотя бы одна заполненная строка (товар + количество).", "catalog");
  return;
}
if (e.message === "qty") {
  fail("Во всех строках количество должно быть положительным.", "catalog");
  return;
}
if (e.message === "qty_over_stock") {
  fail(
    "Количество не должно превышать остаток — для каждого товара не больше значения в столбце «Остаток».",
    "catalog"
  );
  return;
}
const ax = e as AxiosError<{
  error?: string;
  message?: string;
  product_id?: number;
  credit_limit?: string;
  outstanding?: string;
  order_total?: string;
  rule_name?: string;
  details?: unknown;
}>;
const code = ax.response?.data?.error;
const d = ax.response?.data;
if (code === "DatabaseSchemaMismatch") {
  const msg = d?.message?.trim();
  fail(
    msg ||
      "В базе нет нужных столбцов (миграция не применена). В папке backend выполните: npm run db:deploy"
  );
  return;
}
if (code === "ValidationError" && d?.details != null) {
  const flat = getZodFlattenFromApiErrorBody(d);
  if (flat) {
    const hint = firstValidationUserHint(flat);
    fail(
      hint
        ? withApiSupportLine(`Проверка на сервере: ${hint}`, e)
        : withApiSupportLine(getUserFacingError(e, "Ошибка проверки на сервере."), e)
    );
  } else {
    fail(
      `Проверка на сервере: ${typeof d.details === "string" ? d.details : JSON.stringify(d.details)}`
    );
  }
  return;
}
if (code === "BadQty") {
  fail("Неверное количество (должно быть положительным числом).", "catalog");
  return;
}
if (code === "BadWarehouse") {
  fail("Выбранный склад не найден.", "warehouse");
  return;
}
if (code === "BadAgent") {
  fail("Выбранный агент не найден или неактивен.", "agent");
  return;
}
if (code === "OrderRequiresAgent") {
  fail("Для торгового заказа агент обязателен.", "agent");
  return;
}
if (code === "AgentNotOnSlot") {
  fail(
    d?.message?.trim() ||
      "Агент не привязан к рабочему месту — новые заказы запрещены (только сбор долгов).",
    "agent"
  );
  return;
}
if (code === "ExpeditorNotOnSlot") {
  fail(
    d?.message?.trim() ||
      "Экспедитор не привязан к рабочему месту — назначение на заказ запрещено."
  );
  return;
}
if (code === "OrderRequiresWarehouse") {
  fail("Для торгового заказа склад обязателен.", "warehouse");
  return;
}
if (code === "OrderRequiresPaymentMethod") {
  fail("Способ оплаты обязателен.", "payment");
  return;
}
if (code === "NoRetailPrice" || code === "NoPrice") {
  const id = ax.response?.data?.product_id as number | undefined;
  const pt = (ax.response?.data as { price_type?: string } | undefined)?.price_type ?? "retail";
  fail(
    id != null ? `Для товара #${id} нет цены «${pt}».` : `Нет цены («${pt}»).`,
    "price"
  );
  return;
}
if (code === "InsufficientStock") {
  const stockErr = ax.response?.data as {
    product_id?: number;
    available?: string;
    requested?: string;
  };
  fail(
    stockErr?.product_id != null
      ? `Не хватает на складе (товар #${stockErr.product_id}: ${stockErr.available ?? "—"} / нужно ${stockErr.requested ?? "—"}).`
      : "На складе не хватает товара.",
    "catalog"
  );
  return;
}
if (code === "StockReserveConflict" || code === "StockQtyConflict") {
  fail(getUserFacingError(e, "Резерв склада сбился. Обновите страницу и повторите."));
  return;
}
if (code === "BadExpeditor") {
  fail("Выбранный экспедитор не найден или неактивен.");
  return;
}
if (code === "BadClient") {
  fail("Клиент не найден или неактивен.", "client");
  return;
}
if (code === "BadProduct") {
  fail("Товар не найден или неактивен.", "catalog");
  return;
}
if (code === "ReturnNotInterchangeable") {
  const id = ax.response?.data?.product_id as number | undefined;
  const msg = ax.response?.data?.message;
  const text =
    id != null
      ? `Товар #${id}: не входит в активную группу взаимозаменяемости или не подходит выбранный тип цены (${priceType.trim() || "retail"}).`
      : typeof msg === "string" && msg.trim()
        ? msg
        : "Товар для возврата не входит в группу взаимозаменяемости или не подходит тип цены.";
  setLocalError(withApiSupportLine(text, e));
  return;
}
if (code === "BadOrder") {
  setLocalError("Заказ не найден или не подходит для возврата.");
  return;
}
if (code === "BadOrderClient") {
  setLocalError("Заказ не принадлежит этому клиенту или не найден.");
  return;
}
if (code === "QtyExceedsOrdered") {
  setLocalError("Количество возврата не должно превышать проданное / заказанное количество.");
  return;
}
if (code === "BonusCashExceeds") {
  setLocalError(
    "Сумма денежной компенсации вместо бонуса не должна превышать оставшуюся стоимость бонуса (шт. и сумма считаются вместе)."
  );
  return;
}
if (code === "DatabaseValidationError" && d?.message) {
  setLocalError(withApiSupportLine(String(d.message).slice(0, 500), e));
  return;
}
if (code === "NothingToReturn") {
  setLocalError("Нет позиций, доступных для возврата, или лимит исчерпан.");
  return;
}
if (code === "DuplicateProduct") {
  setLocalError("Нельзя добавить один и тот же товар в несколько строк.");
  return;
}
if (code === "CreditLimitExceeded" && d) {
  setLocalError(
    `Недостаточно кредитного лимита. Лимит: ${d.credit_limit ?? "—"}, сумма открытых заказов: ${d.outstanding ?? "—"}, этот заказ: ${d.order_total ?? "—"}.`
  );
  return;
}
if (code === "OrderRestricted") {
  const ruleName =
    typeof d?.rule_name === "string" && d.rule_name.trim()
      ? d.rule_name
      : null;
  const apiMsg = typeof d?.message === "string" ? d.message : ax.response?.data?.message;
  setLocalError(
    withApiSupportLine(
      ruleName
        ? `Заказ заблокирован правилом «${ruleName}».`
        : typeof apiMsg === "string" && apiMsg.trim()
          ? apiMsg
          : "Заказ заблокирован правилом ограничения.",
      e
    )
  );
  return;
}
if (code === "ConsignmentRequiresAgent") {
  setLocalError("Для заказа на консигнацию выберите агента.");
  return;
}
if (code === "ConsignmentAgentDisabled") {
  setLocalError("Для этого агента консигнация не включена (Пользователи → Консигнация).");
  return;
}
if (code === "ConsignmentLimitExceeded" && d) {
  setLocalError(
    `Недостаточно лимита консигнации. Лимит: ${(d as { consignment_limit?: string }).consignment_limit ?? "—"}, открытый долг: ${(d as { outstanding?: string }).outstanding ?? "—"}, этот заказ: ${(d as { order_total?: string }).order_total ?? "—"}.`
  );
  return;
}
if (code === "BadConsignmentDueDate") {
  setLocalError("Проверьте срок консигнации (YYYY-MM-DD или полная дата).");
  return;
}
if (code === "OrderNotEditable" || code === "ORDER_NOT_EDITABLE") {
  fail("Заказ больше нельзя редактировать (статус не «Новый»).");
  return;
}
if (code === "OrderHeaderLocked" || code === "ORDER_HEADER_LOCKED") {
  fail("Клиента и агента изменить нельзя. Сохраните остальные поля.");
  return;
}
if (ax.response?.status === 403) {
  fail("Нет прав на создание заказа (только администратор / оператор).");
  return;
}
fail(getUserFacingError(e, "Ошибка"));
}
