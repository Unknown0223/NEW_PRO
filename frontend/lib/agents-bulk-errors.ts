import type { AxiosError } from "axios";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";

const BULK_ERROR_RU: Record<string, string> = {
  ValidationError: "Неверные данные запроса",
  BadAgentIds: "Один или несколько выбранных агентов не найдены",
  TooManyAgents: "Слишком много агентов (максимум 500)",
  EmptyIds: "Не выбраны агенты",
  BadBulkAction: "Действие не поддерживается сервером. Перезапустите API (npm run dev)",
  BadMobileConfigPatch: "Некорректная конфигурация мобильного приложения",
  BadMobileConfigSyncWindow: "Неверный формат времени синхронизации (ожидается ЧЧ:ММ, например 08:00)",
  BadMobileConfigGpsBattery: "Недопустимый уровень батареи GPS (0–100)",
  BadMobileConfigRoute: "Недопустимые настройки маршрута",
  BadMobileConfigPhoto: "Недопустимые параметры фото",
  BadMobileConfigPaymentMethod: "Недопустимый способ оплаты в конфигурации",
  BadEntitlements: "Некорректные ограничения по товарам или ценам",
  BadCategory: "Не выбрана категория товаров",
  EmptyProductPatch: "Укажите товары или типы цен",
  BadMaxSessions: "Лимит сессий должен быть от 1 до 99",
  BadDelta: "Недопустимое изменение лимита сессий",
  BadCloseDay: "День закрытия консигнации: от 1 до 31",
  BadCloseHour: "Часы закрытия консигнации: от 0 до 23",
  BadCloseMinute: "Минуты закрытия консигнации: от 0 до 59"
};

function validationBulkHint(ax: AxiosError<{ error?: string; message?: string; details?: unknown }>): string {
  const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
  if (flat) {
    const hint = firstValidationUserHint(flat);
    if (hint) {
      const lower = hint.toLowerCase();
      if (lower.includes("invalid input") || lower.includes("invalid literal") || lower.includes("discriminator")) {
        return "Сервер не принял запрос групповой конфигурации. Перезапустите API (npm run dev в корне проекта) и повторите.";
      }
      return hint;
    }
  }
  const msg = ax.response?.data?.message?.trim();
  if (msg && msg !== "Request validation failed") return msg;
  return BULK_ERROR_RU.ValidationError;
}

/** POST /agents/bulk — guruhli amallar uchun tushunarli xabar. */
export function messageFromAgentsBulkError(err: unknown, context?: "config"): string {
  const ax = err as AxiosError<{ error?: string; message?: string }>;
  const status = ax.response?.status;
  const code = ax.response?.data?.error?.trim();

  if (status === 400 && code === "ValidationError") {
    const base =
      context === "config"
        ? "Не удалось применить конфигурацию к выбранным агентам"
        : "Групповая обработка не выполнена";
    return withApiSupportLine(`${base}. ${validationBulkHint(ax)}`, err);
  }

  if (code && BULK_ERROR_RU[code]) {
    const base = context === "config" ? "Конфигурация не сохранена" : "Групповая обработка не выполнена";
    return withApiSupportLine(`${base}: ${BULK_ERROR_RU[code]}`, err);
  }

  if (status === 403) {
    return withApiSupportLine("Недостаточно прав для групповой обработки агентов.", err);
  }

  return getUserFacingError(err, context === "config" ? "Не удалось сохранить конфигурацию" : "Ошибка групповой обработки");
}

/** API ga yuborishdan oldin `mobile_config` patchni tozalash. */
export function sanitizeMobileConfigPatch(patch: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(patch)) as Record<string, unknown>;
}
