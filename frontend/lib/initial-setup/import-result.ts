/** Import natijasida haqiqatan saqlangan qatorlar bormi */
export function importResultSavedCount(data: Record<string, unknown>): number {
  const keys = ["created", "updated", "imported"] as const;
  return keys.reduce((sum, k) => sum + (typeof data[k] === "number" ? Math.max(0, data[k]) : 0), 0);
}

export function importResultMessageSavedCount(message: string): number {
  let total = 0;
  const re = /(?:создано|обновлено|импортировано|qo['’`ʻ]shildi|yaratildi|yangilandi)[:\s·]*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    total += Number.parseInt(m[1] ?? "0", 10) || 0;
  }
  return total;
}

/** UI: xato/ogohlantirish uslubi (yashil «success» o‘rniga) */
export function isImportFailureMessage(message: string): boolean {
  return /не выполнен|дубликат|xato|ошибк|error|failed|saqlanmadi|tuzating|rad etil/i.test(
    message
  );
}

export function importMessageIndicatesSuccess(message: string): boolean {
  if (isImportFailureMessage(message)) return false;
  if (/создано|обновлено|импортировано|qo['’`ʻ]shildi|yaratildi|yangilandi/i.test(message)) {
    return importResultMessageSavedCount(message) > 0;
  }
  return false;
}

/** Server import xatoliklari bilan throw — UI dialog uchun */
export class ImportFailedError extends Error {
  readonly errors: string[];
  readonly savedCount: number;

  constructor(errors: string[], savedCount = 0) {
    const head = errors.slice(0, 3).join("; ");
    const summary =
      savedCount > 0
        ? `Частично сохранено (${savedCount}), ошибки: ${head}`
        : `Импорт не выполнен: ${head}`;
    super(summary);
    this.name = "ImportFailedError";
    this.errors = errors;
    this.savedCount = savedCount;
  }
}

export function isImportFailedError(e: unknown): e is ImportFailedError {
  return e instanceof ImportFailedError;
}

