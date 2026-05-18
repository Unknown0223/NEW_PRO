/**
 * Qaysi API xatolari avtomatik qayta urinilishi mumkin — bitta joyda (roadmap Sprint 5).
 * POST/PUT/PATCH/DELETE ga umuman ishonmaymiz (idempotent emas).
 */

export function isIdempotentHttpMethod(method: string | undefined): boolean {
  const m = (method ?? "get").toUpperCase();
  return m === "GET" || m === "HEAD";
}

/** Vaqtinchalik server / tarmoq bosimi — bitta GET qayta urinishi ma’qul. */
export function isTransientHttpStatus(status: number | undefined): boolean {
  if (status == null) return false;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export type AxiosStyleError = {
  response?: { status?: number };
  code?: string;
};

/**
 * Avtomatik bitta qayta urinish: faqat GET/HEAD va
 * - tarmoq xatosi (javob status yo‘q + ERR_NETWORK), yoki
 * - 429 / 502 / 503 / 504.
 */
export function shouldRetryIdempotentRequestOnce(e: AxiosStyleError): boolean {
  const status = e.response?.status;
  if (isTransientHttpStatus(status)) return true;
  if (status == null && e.code === "ERR_NETWORK") return true;
  return false;
}

/** 429 uchun qisqa kutish (RateLimit-Limit header ishlatilmaydi — minimal siyosat). */
export function backoffMsBeforeTransientRetry(status: number | undefined): number {
  if (status === 429) return 900;
  return 0;
}
