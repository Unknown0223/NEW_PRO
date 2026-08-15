import {
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody,
  parseZodFlattenDetails
} from "@/lib/api-validation-details";

const BULK_ERROR_RU: Record<string, string> = {
  ValidationError: "Неверные данные запроса",
  EmptyPatch: "Укажите хотя бы одно поле для изменения",
  BadSlotIds: "Одно или несколько выбранных мест не найдены",
  TooManySlots: "Слишком много мест (максимум 500)",
  BadDirection: "Направление торговли не найдено",
  BadWarehouse: "Склад не найден",
  BadCashDesk: "Касса не найдена",
  AlreadyVoided: "Одно или несколько мест уже удалены",
  NotFound: "Рабочее место не найдено"
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  details?: unknown;
};

function validationHint(body: ApiErrorBody | undefined): string | undefined {
  if (!body) return undefined;
  const flat = getZodFlattenFromApiErrorBody(body);
  if (flat) {
    const hint = firstValidationUserHint(flat);
    if (hint) {
      const lower = hint.toLowerCase();
      if (lower.includes("emptypatch")) {
        return "Укажите хотя бы одно поле для изменения";
      }
      return hint;
    }
  }
  const msg = body.message?.trim();
  if (msg && msg !== "Request validation failed") return msg;
  const details = parseZodFlattenDetails(body.details);
  if (details) return firstValidationUserHint(details);
  return undefined;
}

/** POST /work-slots/bulk — понятное сообщение об ошибке. */
export function messageFromWorkSlotsBulkError(err: unknown): string {
  if (err instanceof Error && "apiBody" in err) {
    const apiErr = err as Error & { status?: number; apiBody?: ApiErrorBody };
    const code = apiErr.apiBody?.error?.trim();
    const hint = validationHint(apiErr.apiBody);
    if (hint) return hint;
    if (code && BULK_ERROR_RU[code]) return BULK_ERROR_RU[code];
    if (apiErr.message && apiErr.message !== "ValidationError") return apiErr.message;
  }

  if (err instanceof Error) {
    const code = err.message.trim();
    if (BULK_ERROR_RU[code]) return BULK_ERROR_RU[code];
    if (code && code !== "ValidationError") return code;
  }

  return "Не удалось выполнить групповую обработку";
}
