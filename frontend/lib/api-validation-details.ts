/**
 * Backend `zodValidationExtras` / global Zod handler: `details` = `zodError.flatten()`.
 * @see backend/src/lib/api-error.ts — `zodValidationExtras`
 */

export type ZodFlattenDetails = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
  issues?: Array<{ path: string; message: string }>;
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
  const issuesRaw = o.issues;
  const issues = Array.isArray(issuesRaw)
    ? issuesRaw
        .filter((x): x is { path?: string; message?: string } => x != null && typeof x === "object")
        .map((x) => ({
          path: typeof x.path === "string" ? x.path : "",
          message: typeof x.message === "string" ? x.message : ""
        }))
    : undefined;
  if (formErrors.length === 0 && Object.keys(fieldErrors).length === 0 && !issues?.length) return null;
  return { formErrors, fieldErrors, ...(issues?.length ? { issues } : {}) };
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

/** Banner / umumiy xabar: avvalo `formErrors`, keyin issues, keyin istalgan maydon xabari. */
export function firstValidationUserHint(details: ZodFlattenDetails): string | undefined {
  const fe0 = details.formErrors.find((m) => m.trim() !== "");
  if (fe0) return fe0;
  const issues = details.issues;
  if (Array.isArray(issues) && issues.length) {
    const lines = issues.slice(0, 3).map((i) => {
      if (i.path?.endsWith("payment_method_id") || i.path === "payment_method_id") {
        return "Способ оплаты обязателен для каждого типа цены";
      }
      return i.path ? `${i.path}: ${i.message ?? ""}` : (i.message ?? "");
    });
    const joined = lines.map((s) => s.trim()).filter(Boolean).join("; ");
    if (joined) return joined;
  }
  const per = firstMessagePerField(details);
  const vals = Object.values(per);
  return vals.find((m) => m.trim() !== "");
}
