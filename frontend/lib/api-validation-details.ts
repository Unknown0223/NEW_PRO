/**
 * Backend `zodValidationExtras` / global Zod handler: `details` = `zodError.flatten()`.
 * @see backend/src/lib/api-error.ts — `zodValidationExtras`
 */

export type ZodFlattenDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

function isNonEmptyStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isFieldErrorsRecord(v: unknown): v is Record<string, string[]> {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (val == null) continue;
    if (!Array.isArray(val)) return false;
    if (!val.every((x) => typeof x === "string")) return false;
  }
  return true;
}

/** `details` mayomi `ZodFlattenDetails` bo‘lsa — parse qiladi, aks holda `null`. */
export function parseZodFlattenDetails(details: unknown): ZodFlattenDetails | null {
  if (details == null || typeof details !== "object" || Array.isArray(details)) return null;
  const o = details as Record<string, unknown>;
  const formRaw = o.formErrors;
  const fieldRaw = o.fieldErrors;
  const formErrors = isNonEmptyStringArray(formRaw) ? formRaw : [];
  const fieldErrors = isFieldErrorsRecord(fieldRaw) ? fieldRaw : {};
  if (formErrors.length === 0 && Object.keys(fieldErrors).length === 0) return null;
  return { formErrors, fieldErrors };
}

/** Axios javob tanasi: `error === "ValidationError"` va `details` flatten. */
export function getZodFlattenFromApiErrorBody(body: unknown): ZodFlattenDetails | null {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as { error?: string; details?: unknown };
  if (b.error !== "ValidationError") return null;
  return parseZodFlattenDetails(b.details);
}

/** Har bir maydon uchun birinchi xabar (UI ostidagi qatorlar uchun). */
export function firstMessagePerField(details: ZodFlattenDetails): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, msgs] of Object.entries(details.fieldErrors)) {
    const first = msgs.find((m) => m.trim() !== "");
    if (first) out[key] = first;
  }
  return out;
}

/** Banner / umumiy xabar: avvalo `formErrors`, keyin istalgan maydon xabari. */
export function firstValidationUserHint(details: ZodFlattenDetails): string | undefined {
  const fe0 = details.formErrors.find((m) => m.trim() !== "");
  if (fe0) return fe0;
  const per = firstMessagePerField(details);
  const vals = Object.values(per);
  return vals.find((m) => m.trim() !== "");
}
