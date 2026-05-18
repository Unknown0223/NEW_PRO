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

/** Same trailing `Support: requestId …` as {@link getUserFacingError}, without recomputing `base` from the error payload. */
export function withApiSupportLine(base: string, error: unknown): string {
  const ref = formatApiSupportReference(getRequestIdFromApiError(error));
  return ref ? `${base} — ${ref}` : base;
}

export function getUserFacingError(error: unknown, fallback = "Произошла ошибка"): string {
  let base: string;
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as { message?: string; error?: string } | undefined;
    if (data?.message) base = data.message;
    else if (status === 401) base = "Сессия истекла, войдите снова.";
    else if (status === 403) base = "Недостаточно прав для этого действия.";
    else if (status === 404) base = "Данные не найдены.";
    else if (status === 503) base = "Сервис временно недоступен. Попробуйте позже.";
    else if (status && status >= 500) base = "Ошибка сервера. Можно повторить запрос.";
    else if (typeof data?.error === "string" && data.error.trim()) base = data.error;
    else if (error.message.trim()) base = error.message;
    else base = fallback;
  } else if (error instanceof Error && error.message.trim()) base = error.message;
  else base = fallback;

  const ref = formatApiSupportReference(getRequestIdFromApiError(error));
  return ref ? `${base} — ${ref}` : base;
}
