/** AI Assistant — tokenda berilgan parametrlarni tool schema bo‘yicha tekshirish. */
import { z } from "zod";
import type { AiToolSpec } from "./ai.tool";

/** Parametrlarni normalizatsiya qiladi va schema bo‘yicha tekshiradi. Agar xato bo‘lsa null. */
export function verifyParams(
  params: Record<string, unknown> | undefined,
  schema: z.ZodTypeAny
): Record<string, unknown> | null {
  const clean = params ?? {};
  const parsed = schema.safeParse(clean);
  if (!parsed.success) return null;
  return parsed.data as Record<string, unknown>;
}

/** Ichki `_` bilan boshlanmaydigan maydonlarni ajratadi. */
export function publicParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([key]) => !key.startsWith("_")));
}
