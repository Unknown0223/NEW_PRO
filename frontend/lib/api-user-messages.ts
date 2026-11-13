/**
 * API `error` kodlari → qisqa, tez o‘qiladigan matn (toast / tepadagi banner).
 * Uzun texnik izohlar bu yerga kirmaydi.
 */

const SHORT_BY_CODE: Record<string, string> = {
  StockReserveConflict: "Резерв склада сбился. Обновите страницу и повторите.",
  StockQtyConflict: "Остаток склада не позволяет операцию.",
  DatabaseConstraintConflict: "Конфликт данных на складе. Обновите и повторите.",
  InsufficientStock: "На складе не хватает товара.",
  DuplicateRecord: "Такая запись уже есть.",
  RelatedRecordMissing: "Связанная запись не найдена.",
  RecordNotFound: "Запись не найдена или уже изменена.",
  InternalServerError: "Не удалось выполнить. Повторите.",
  NotFound: "Данные не найдены.",
  InvalidTransition: "Недопустимый переход статуса.",
  ForbiddenRevert: "Вернуть статус может только администратор.",
  ForbiddenPermission: "Нет права на это действие.",
  ApprovalPending: "Дождитесь согласования.",
  ApprovalRejected: "Согласование отклонено.",
  OrderNotEditable: "Заказ уже нельзя редактировать.",
  DocumentEditPeriodLocked: "Период закрыт — правки запрещены.",
  TooManyRequests: "Слишком много запросов. Подождите."
};

/** Kod bo‘yicha qisqa matn; noma’lum kod → null. */
export function shortMessageForApiErrorCode(code: string | undefined | null): string | null {
  if (!code) return null;
  const t = SHORT_BY_CODE[code.trim()];
  return t ?? null;
}

/** Toast / banner uchun: bo‘sh joylarni siqish, max uzunlik. */
export function compactUserMessage(text: string, maxLen = 120): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= maxLen) return one;
  return `${one.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}
