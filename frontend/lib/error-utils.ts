import { formatApiSupportReference, getRequestIdFromApiError } from "@/lib/api";
import {
  compactUserMessage,
  shortMessageForApiErrorCode
} from "@/lib/api-user-messages";
import {
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { isAxiosError } from "axios";

/** Brauzerda server o‘chiq / noto‘g‘ri port — odatda `response` bo‘lmaydi */
export function isApiUnreachable(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  if (error.response != null) return false;
  const code = error.code;
  if (code === "ERR_NETWORK" || code === "ECONNABORTED") return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("network error")) return true;
  if (msg.includes("econnrefused")) return true;
  if (msg.includes("failed to fetch")) return true;
  return false;
}

/**
 * `requestId` faqat kutilmagan server xatolari uchun foydali (5xx).
 * Foydalanuvchi xatolari (parol, ruxsat, validatsiya — 4xx) uchun u faqat shovqin.
 */
function shouldShowSupportRef(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status == null) return false; // tarmoq xatosida requestId baribir yo‘q
  return status >= 500;
}

/**
 * Berilgan matnga qisqa «(код: …)» qo‘shadi (agar `requestId` bo‘lsa).
 * Toast / tepadagi banner uchun — chaqiruvchi ataylab tanlaydi.
 */
export function withApiSupportLine(base: string, error: unknown): string {
  const ref = formatApiSupportReference(getRequestIdFromApiError(error));
  const short = compactUserMessage(base, 140);
  return ref ? `${short} (${ref})` : short;
}

export function getUserFacingError(error: unknown, fallback = "Произошла ошибка"): string {
  // Server umuman javob bermadi — tarmoq/uzilish. Foydalanuvchiga aniq, do‘stona xabar.
  if (isApiUnreachable(error)) {
    return "Нет связи с сервером. Проверьте интернет и повторите.";
  }

  let base: string;
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as {
      message?: string;
      error?: string;
      details?: unknown;
    } | undefined;
    const codeHint = shortMessageForApiErrorCode(
      typeof data?.error === "string" ? data.error : undefined
    );
    const zodHint = (() => {
      if (status !== 400 && status !== 422) return undefined;
      const flat = getZodFlattenFromApiErrorBody(data);
      if (!flat) return undefined;
      return firstValidationUserHint(flat);
    })();
    const msg = data?.message?.trim() ?? "";
    const genericServerMsg =
      msg === "Непредвиденная ошибка сервера" ||
      msg === "Не удалось выполнить. Повторите или обратитесь в поддержку.";
    // Kod bo‘yicha qisqa matn — uzun generic 500 / bo‘sh message dan ustun
    if (codeHint && (!msg || genericServerMsg)) base = codeHint;
    else if (zodHint && (!msg || msg === "Request validation failed")) base = zodHint;
    else if (msg && !genericServerMsg) base = msg;
    else if (codeHint) base = codeHint;
    else if (status === 401) base = "Сессия истекла. Войдите снова.";
    else if (
      status === 403 &&
      (data?.error === "DOCUMENT_EDIT_PERIOD_LOCKED" || data?.error === "DocumentEditPeriodLocked")
    ) {
      base =
        data?.message?.trim() ||
        "Период закрыт. Администратор может временно открыть доступ.";
    }
    else if (status === 403 && data?.error === "APP_ACCESS_DENIED") {
      base =
        data?.message?.trim() ||
        "Доступ к приложению отключён. Обратитесь к администратору.";
    }
    else if (status === 403 && data?.error === "USER_NOT_ON_SLOT") {
      base =
        data?.message?.trim() ||
        "Не назначен на рабочее место. Обратитесь к администратору.";
    }
    else if (status === 403 && data?.error === "AgentNotOnSlot") {
      base =
        data?.message?.trim() ||
        "Агент не на рабочем месте — новые операции запрещены.";
    }
    else if (status === 403 && data?.error === "ExpeditorNotOnSlot") {
      base =
        data?.message?.trim() ||
        "Доставщик не на рабочем месте — новые операции запрещены.";
    }
    else if (status === 403) base = "Недостаточно прав для этого действия.";
    else if (status === 404) base = "Данные не найдены.";
    else if (status === 409 && data?.error === "RuleLocked") {
      base = "Правило уже в заказах — правки ограничены.";
    }
    else if (
      status === 409 &&
      (data?.error === "DuplicateName" || data?.error === "NameExists")
    ) {
      base =
        data?.message?.trim() ||
        "Товар с таким названием уже есть.";
    }
    else if (status === 409 && data?.error === "SkuExists") {
      base = data?.message?.trim() || "Такой SKU уже существует.";
    }
    else if (status === 409 && data?.error === "BarcodeExists") {
      base = data?.message?.trim() || "Этот штрихкод уже занят.";
    }
    else if (status === 409) base = "Данные изменились. Обновите и повторите.";
    else if (status === 503) base = "Сервис временно недоступен. Попробуйте позже.";
    else if (status && status >= 500) {
      base = "Не удалось выполнить. Повторите.";
    }
    else if (typeof data?.error === "string" && data.error.trim()) {
      if (data.error === "ValidationError") {
        base = "Проверьте введённые данные.";
      } else {
        base = data.error.trim();
      }
    }
    else if (status === 400 || status === 422) base = "Проверьте введённые данные.";
    else if (status === 429) base = "Слишком много запросов. Подождите.";
    else if (error.message.trim()) base = error.message;
    else base = fallback;
  } else if (error instanceof Error && error.message.trim()) base = error.message;
  else base = fallback;

  base = compactUserMessage(base, 140);

  if (shouldShowSupportRef(error)) {
    const ref = formatApiSupportReference(getRequestIdFromApiError(error));
    return ref ? `${base} (${ref})` : base;
  }
  return base;
}
