import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { decodeAccessTokenTenantSlug, useAuthStore } from "@/lib/auth-store";
import { readPersistedAuth } from "@/lib/persisted-auth";
import {
  backoffMsBeforeTransientRetry,
  isIdempotentHttpMethod,
  shouldRetryIdempotentRequestOnce
} from "@/lib/api-retry-policy";

const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();

/** Axios `baseURL`: dev + proxy bo‘lsa bo‘sh — so‘rovlar joriy origin (`/api/...`). */
const baseURL =
  fromEnv != null && fromEnv !== ""
    ? fromEnv
    : process.env.NODE_ENV === "development"
      ? typeof window !== "undefined"
        ? ""
        : process.env.INTERNAL_API_BASE?.trim() || "http://127.0.0.1:18080"
      : typeof window !== "undefined"
        ? window.location.origin
        : "";

/**
 * `EventSource` / `new URL` uchun to‘liq origin.
 * Dev + proxy: `window.location.origin`; SSR yoki `NEXT_PUBLIC_API_URL` — mos ravishda.
 */
export function resolveApiOrigin(): string {
  if (fromEnv != null && fromEnv !== "") {
    try {
      return new URL(fromEnv).origin;
    } catch {
      return fromEnv.replace(/\/$/, "");
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.INTERNAL_API_BASE?.trim() || "http://127.0.0.1:18080";
}

function authRefreshAbsoluteUrl(): string {
  if (!baseURL) return "/auth/refresh";
  return `${baseURL.replace(/\/$/, "")}/auth/refresh`;
}

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" }
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean; _transientRetry?: boolean };

/** Backend `sendApiError` / global handler bilan mos JSON xato tanasi */
type ApiErrorResponseBody = {
  error?: string;
  message?: string;
  requestId?: string;
  details?: unknown;
};

function pickRequestIdFromAxiosError(error: AxiosError<ApiErrorResponseBody>): string | undefined {
  const raw = error.response?.headers?.["x-request-id"] ?? error.response?.data?.requestId;
  if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  return undefined;
}

/** Axios xatolaridan `requestId` (header `x-request-id` yoki JSON `requestId`). */
export function getRequestIdFromApiError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const ax = error as AxiosError<ApiErrorResponseBody> & { requestId?: string };
  if (typeof ax.requestId === "string" && ax.requestId.trim() !== "") return ax.requestId.trim();
  return pickRequestIdFromAxiosError(ax);
}

/** Support/telegram uchun qisqa qator; `requestId` bo‘lmasa bo‘sh qator. */
export function formatApiSupportReference(requestId?: string): string {
  const id = requestId?.trim();
  if (!id) return "";
  return `Support: requestId ${id}`;
}

let refreshInFlight: Promise<string | null> | null = null;

function decodeJwtExpMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const store = useAuthStore.getState();
    const disk = readPersistedAuth();
    const refreshToken = store.refreshToken ?? disk.refreshToken;
    if (!refreshToken) return null;
    try {
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        authRefreshAbsoluteUrl(),
        { refreshToken }
      );
      const prevSlug = store.tenantSlug ?? disk.tenantSlug;
      const slugFromJwt = decodeAccessTokenTenantSlug(data.accessToken);
      store.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tenantSlug: slugFromJwt ?? prevSlug ?? undefined
      });
      return data.accessToken;
    } catch {
      store.clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function redirectToLoginIfBrowser() {
  if (typeof window === "undefined") return;
  const current = `${window.location.pathname}${window.location.search}`;
  const next = `/login?from=${encodeURIComponent(current)}`;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign(next);
  }
}

api.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  if (typeof window !== "undefined") {
    const fromStore = useAuthStore.getState().accessToken;
    const fromDisk = readPersistedAuth().accessToken;
    let accessToken = fromStore ?? fromDisk;
    const isRefreshCall = String(config.url ?? "").includes("/auth/refresh");
    const expMs = decodeJwtExpMs(accessToken);
    const almostExpired = expMs != null && expMs - Date.now() < 15_000;
    if (!isRefreshCall && almostExpired) {
      const refreshed = await refreshAccessTokenSingleFlight();
      if (refreshed) accessToken = refreshed;
    }
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorResponseBody>) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const body = error.response?.data ?? {};
    const requestId = pickRequestIdFromAxiosError(error);
    if (requestId) {
      (error as AxiosError<ApiErrorResponseBody> & { requestId?: string }).requestId = requestId;
    }
    const logRequestIds =
      process.env.NEXT_PUBLIC_API_LOG_REQUEST_IDS === "1" ||
      (typeof window !== "undefined" && process.env.NODE_ENV === "development");
    if (typeof window !== "undefined" && logRequestIds && requestId) {
      console.warn("[api]", {
        requestId,
        status,
        code: body.error,
        url: original?.url
      });
    }
    if (
      (status === 404 && body.error === "TenantNotFound") ||
      (status === 403 && body.error === "CrossTenantDenied")
    ) {
      const store = useAuthStore.getState();
      store.clearSession();
      redirectToLoginIfBrowser();
      return Promise.reject(error);
    }

    if (status === 401 && original && !original._retry) {
      original._retry = true;
      const store = useAuthStore.getState();
      const refreshed = await refreshAccessTokenSingleFlight();
      if (!refreshed) {
        store.clearSession();
        return Promise.reject(error);
      }
      original.headers.Authorization = `Bearer ${refreshed}`;
      return api(original);
    }

    if (
      typeof window !== "undefined" &&
      original &&
      !original._transientRetry &&
      isIdempotentHttpMethod(original.method) &&
      error.code !== "ERR_CANCELED" &&
      shouldRetryIdempotentRequestOnce(error)
    ) {
      const ms = backoffMsBeforeTransientRetry(status);
      if (ms > 0) await new Promise((r) => setTimeout(r, ms));
      original._transientRetry = true;
      return api(original);
    }

    return Promise.reject(error);
  }
);

export { baseURL as apiBaseURL };
