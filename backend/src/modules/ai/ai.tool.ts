/** AI Assistant — tool spetsifikatsiyasi va yordamchi funksiyalar. */
import type { z } from "zod";
import type { AiDomain, AiKind, AiParams, AiTableResult } from "./ai.types";

export type AiPreview = {
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
};

export type AiToolSpec = {
  id: string;
  kind: AiKind;
  domain: AiDomain;
  /** UI va javob sarlavhasi uchun o‘zbekcha nom. */
  title: string;
  description: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Pre-flight ruxsat kalitlari (kamida bittasi). Bo‘sh bo‘lsa — faqat endpoint tekshiradi. */
  anyOf: string[];
  schema: z.ZodTypeAny;
  /** `/api/:slug` dan keyingi yo‘l (query bilan). */
  path: (params: AiParams) => string;
  body?: (params: AiParams) => unknown;
  format?: (payload: unknown, params: AiParams) => AiTableResult;
  /** Yozish tool’i uchun preview (bajarilmaydi, faqat ko‘rsatiladi). */
  preview?: (params: AiParams) => AiPreview;
  /** Javobda maksimal qator. */
  maxRows?: number;
};

/** `?a=1&b=2` — bo‘sh qiymatlar tashlanadi. */
export function qs(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Faqat ichki (`_` bilan boshlanadigan) maydonlarni olib tashlaydi. */
export function stripInternal(params: AiParams): AiParams {
  const out: AiParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("_")) continue;
    out[key] = value;
  }
  return out;
}

/** Parametr qiymatlarini xavfsiz o‘qish. */
export function pStr(params: AiParams, key: string): string | undefined {
  const value = params[key];
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function pNum(params: AiParams, key: string): number | undefined {
  const value = params[key];
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function pBool(params: AiParams, key: string): boolean | undefined {
  const value = params[key];
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}
