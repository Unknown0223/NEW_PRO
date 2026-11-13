import { isAxiosError } from "axios";
import { getRequestIdFromApiError } from "@/lib/api";
import { isErrorCode, type ErrorCode } from "@/components/errors/error-data";

/** Axios / fetch xatosidan tizim sahifasi kodi (401…504). */
export function errorCodeFromUnknown(error: unknown): ErrorCode | null {
  if (!isAxiosError(error)) return null;
  const status = error.response?.status;
  return isErrorCode(status) ? status : null;
}

export function retryAfterFromUnknown(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const h = error.response?.headers?.["retry-after"] ?? error.response?.headers?.["Retry-After"];
  if (typeof h === "string" && h.trim()) return h.trim();
  if (typeof h === "number" && Number.isFinite(h)) return String(h);
  return undefined;
}

export function supportRefFromUnknown(error: unknown): string | undefined {
  return getRequestIdFromApiError(error);
}
