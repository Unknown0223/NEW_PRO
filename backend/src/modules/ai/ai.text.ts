/** AI Assistant — matn va son yordamchilari (pure). */

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’‘`ʻʼ]/g, "'")
    .replace(/ё/g, "е")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function has(text: string, ...words: string[]): boolean {
  return words.some((word) => (word ? text.includes(word) : false));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function money(value: unknown, currency = "so'm"): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return String(value ?? "");
  const formatted = n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(String(value).replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : undefined;
}

const MULTIPLIERS: Array<{ test: RegExp; factor: number }> = [
  { test: /\b(mlrd|milliard|миллиард)/, factor: 1_000_000_000 },
  { test: /\b(mln|million|миллион)/, factor: 1_000_000 },
  { test: /\b(ming|тыс|тысяч)/, factor: 1_000 },
  { test: /\bk\b/, factor: 1_000 }
];

/**
 * «1 250 000», «1.5 mln», «500 ming», «150k», «150 000 so‘m» → son.
 * Valyuta/qo‘shimcha so‘zlar e’tiborsiz qoldiriladi.
 */
export function parseAmount(text: string): number | undefined {
  const q = normalizeText(text);
  const m = q.match(/(\d[\d\s.,]*\d|\d)\s*(mlrd|milliard|миллиард|mln|million|миллион|ming|тыс|тысяч|k)?/);
  if (!m) return undefined;
  const raw = (m[1] ?? "").replace(/\s/g, "");
  // «150,000» yoki «150.000» — ming ajratgich; «1.5» — kasr.
  const normalized = /^\d{1,3}([.,]\d{3})+$/.test(raw) ? raw.replace(/[.,]/g, "") : raw.replace(/,/g, ".");
  const base = Number(normalized);
  if (!Number.isFinite(base)) return undefined;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit) {
    const found = MULTIPLIERS.find((item) => item.test.test(unit));
    if (found) return Math.round(base * found.factor);
  }
  const words = q.match(/(mlrd|milliard|миллиард|mln|million|миллион|ming|тыс|тысяч)/);
  if (words) {
    const found = MULTIPLIERS.find((item) => item.test.test(words[1]!));
    if (found) return Math.round(base * found.factor);
  }
  return base;
}

/** Qo‘shtirnoq yoki «ismli» konstruksiyasidan matn ajratish. */
export function extractQuoted(text: string): string | undefined {
  const m = text.match(/[«"“']([^»"”']{2,120})[»"”']/);
  return m?.[1]?.trim() || undefined;
}

export function truncate(value: string, max = 60): string {
  const t = value.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return toNumber(value);
}

export function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const q = normalizeText(value);
    if (["true", "1", "ha", "yes", "faol"].includes(q)) return true;
    if (["false", "0", "yo'q", "yoq", "no", "nofaol"].includes(q)) return false;
  }
  return undefined;
}
