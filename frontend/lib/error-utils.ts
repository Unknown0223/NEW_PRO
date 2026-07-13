import { formatApiSupportReference, getRequestIdFromApiError } from "@/lib/api";
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
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    if (data?.message && data.message.trim()) base = data.message.trim();
    else if (status === 401) base = "Сессия истекла, войдите снова.";
    else if (status === 403) base = "Недостаточно прав для этого действия.";
    else if (status === 404) base = "Данные не найдены.";
    else if (status === 409 && data?.error === "RuleLocked") {
      base = "Правило уже применялось в заказах — изменения ограничены.";
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
