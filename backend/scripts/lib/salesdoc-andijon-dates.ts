/** SalesDoc sana, hujjat raqami va narx turi nomlari. */

/** Lokal nusxada hamma oy kiradi. Kesish faqat bo‘sh qolsa. */
export const LIVE_CUTOFF = "2099-01-01";

const sdPriceTypeNames = new Map<string, string>();

export type SdPriceType = { id: string; name: string; kind: "sale" | "purchase" };

/** Tovar sahifasi `buyPrices` / `purchasePrices`. Nom topilmasa kod o‘zi. */
export function rememberPriceTypes(
  rows: Array<{ text?: string; value?: string }>,
  kind: "sale" | "purchase"
): SdPriceType[] {
  const out: SdPriceType[] = [];
  for (const row of rows) {
    const id = String(row.value ?? "").trim();
    const name = String(row.text ?? "").trim();
    if (!id || !name) continue;
    sdPriceTypeNames.set(id, name);
    out.push({ id, name, kind });
  }
  return out;
}

export function sdPriceTypeName(id: string): string {
  const key = id.trim();
  return sdPriceTypeNames.get(key) || key;
}

function realDay(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Mijoz kartasidagi kun: yetkazilgan, bo‘lmasa yuklangan, bo‘lmasa ochilgan kun. */
export function sdLedgerDate(date: string, dateLoad: string, dateDeliver: string): string {
  return realDay(dateDeliver) || realDay(dateLoad) || realDay(date);
}

export function sdOrderNumber(id: string): string {
  return id.replace(/^(?:f\d+-)?d0_/, "").slice(0, 64);
}
