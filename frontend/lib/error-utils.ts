import { formatApiSupportReference, getRequestIdFromApiError } from "@/lib/api";
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
 * Berilgan matnga «Код для поддержки: …» qatorini qo‘shadi (agar `requestId` bo‘lsa).
 * Bu — chaqiruvchi tomonidan ataylab tanlanadigan variant (masalan, server xatosi uchun).
 */
export function withApiSupportLine(base: string, error: unknown): string {
  const ref = formatApiSupportReference(getRequestIdFromApiError(error));
  return ref ? `${base} — ${ref}` : base;
}

export function getUserFacingError(error: unknown, fallback = "Произошла ошибка"): string {
  // Server umuman javob bermadi — tarmoq/uzilish. Foydalanuvchiga aniq, do‘stona xabar.
  if (isApiUnreachable(error)) {
    return "Нет связи с сервером. Проверьте подключение к интернету и попробуйте снова.";
  }

  let base: string;
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as {
      message?: string;
      error?: string;
      details?: unknown;
    } | undefined;
    const zodHint = (() => {
      if (status !== 400 && status !== 422) return undefined;
      const flat = getZodFlattenFromApiErrorBody(data);
      if (!flat) return undefined;
      return firstValidationUserHint(flat);
    })();
    const msg = data?.message?.trim() ?? "";
    if (zodHint && (!msg || msg === "Request validation failed")) base = zodHint;
    else if (msg) base = msg;
    else if (status === 401) base = "Sessiya tugadi. Qayta kiring (Сессия истекла).";
    else if (
      status === 403 &&
      (data?.error === "DOCUMENT_EDIT_PERIOD_LOCKED" || data?.error === "DocumentEditPeriodLocked")
    ) {
      base = data?.message?.trim() || "Davr yopilgan. Admin ochishi kerak.";
    }
    else if (status === 403 && data?.error === "APP_ACCESS_DENIED") {
      base =
        data?.message?.trim() ||
        "Доступ к приложению отключён / Ilova kirish o‘chirilgan. Обратитесь к администратору.";
    }
    else if (status === 403 && data?.error === "USER_NOT_ON_SLOT") {
      base =
        data?.message?.trim() ||
        "Пользователь не назначен на рабочее место. Обратитесь к администратору.";
    }
    else if (status === 403) base = "Недостаточно прав для этого действия.";
    else if (status === 404) base = "Данные не найдены.";
    else if (status === 409 && data?.error === "RuleLocked") {
      base = "Правило уже применялось в заказах — изменения ограничены.";
    }
    else if (
      status === 409 &&
      (data?.error === "DuplicateName" || data?.error === "NameExists")
    ) {
      base =
        data?.message?.trim() ||
        "Bu nomdagi mahsulot allaqachon mavjud (SKU dan mustaqil).";
    }
    else if (status === 409 && data?.error === "SkuExists") {
      base = data?.message?.trim() || "Bu SKU allaqachon mavjud.";
    }
    else if (status === 409 && data?.error === "BarcodeExists") {
      base = data?.message?.trim() || "Bu shtrixkod allaqachon band.";
    }
    else if (status === 409) base = "Данные были изменены. Обновите страницу и повторите.";
    else if (status === 503) base = "Сервис временно недоступен. Попробуйте позже.";
    else if (status && status >= 500) base = "Ошибка сервера. Можно повторить запрос.";
    else if (typeof data?.error === "string" && data.error.trim()) base = data.error.trim();
    else if (status === 400 || status === 422) base = "Проверьте правильность введённых данных.";
    else if (status === 429) base = "Слишком много запросов. Подождите немного и повторите.";
    else if (error.message.trim()) base = error.message;
    else base = fallback;
  } else if (error instanceof Error && error.message.trim()) base = error.message;
  else base = fallback;

  if (shouldShowSupportRef(error)) {
    const ref = formatApiSupportReference(getRequestIdFromApiError(error));
    return ref ? `${base} — ${ref}` : base;
  }
  return base;
}
