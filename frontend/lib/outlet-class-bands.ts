export type OutletClassBandDraft = { name: string; minSum: number };

const DEFAULT_BANDS: OutletClassBandDraft[] = [
  { name: "A", minSum: 1_000_000 },
  { name: "B", minSum: 500_000 },
  { name: "C", minSum: 100_000 },
  { name: "D", minSum: 0 }
];

/** `A:1000000,B:500000,C:100000,D:0` → massiv (yuqoridan pastga). */
export function parseOutletClassBandsString(raw?: string | null): OutletClassBandDraft[] {
  const parts = String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_BANDS.map((b) => ({ ...b }));
  const out: OutletClassBandDraft[] = [];
  for (const p of parts) {
    const [nameRaw, sumRaw] = p.split(":");
    const name = (nameRaw ?? "").trim();
    const minSum = Number.parseFloat(String(sumRaw ?? "").trim().replace(/\s/g, "").replace(",", "."));
    if (!name || !Number.isFinite(minSum) || minSum < 0) continue;
    out.push({ name, minSum });
  }
  if (out.length === 0) return DEFAULT_BANDS.map((b) => ({ ...b }));
  return out.sort((a, b) => b.minSum - a.minSum);
}

export function serializeOutletClassBands(bands: OutletClassBandDraft[]): string {
  return bands
    .slice()
    .sort((a, b) => b.minSum - a.minSum)
    .map((b) => `${b.name}:${Math.round(b.minSum)}`)
    .join(",");
}

/** Trigger uchun qisqa matn: `A≥1 млн · B≥500 тыс`. */
export function formatOutletClassBandsSummary(raw?: string | null): string {
  const bands = parseOutletClassBandsString(raw);
  if (bands.length === 0) return "Пороги";
  return bands
    .slice(0, 3)
    .map((b) => `${b.name}≥${formatThresholdShort(b.minSum)}`)
    .join(" · ");
}

export function formatThresholdShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const t = Number.isInteger(m) ? String(m) : m.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
    return `${t} млн`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    const t = Number.isInteger(k) ? String(k) : k.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
    return `${t} тыс`;
  }
  return Math.round(n).toLocaleString("ru-RU");
}

export function defaultOutletClassBandsString(): string {
  return serializeOutletClassBands(DEFAULT_BANDS);
}

/**
 * Jadval «Класс» uchun SalesDoc uslubi: `< 1 млн`, `500 тыс – 1 млн`, `≥ 1 млн`.
 * `className` — API dan kelgan A/B/C/D (yoki boshqa band nomi).
 */
export function formatOutletClassRowLabel(
  className: string,
  bandsRaw?: string | null
): string {
  const name = String(className ?? "").trim();
  if (!name) return "—";
  const bands = parseOutletClassBandsString(bandsRaw);
  const idx = bands.findIndex((b) => b.name === name);
  if (idx < 0) return name;
  const cur = bands[idx]!;
  const higher = idx > 0 ? bands[idx - 1] : undefined;
  if (!higher) {
    return cur.minSum <= 0 ? formatThresholdShort(0) : `≥ ${formatThresholdShort(cur.minSum)}`;
  }
  if (cur.minSum <= 0) {
    return `< ${formatThresholdShort(higher.minSum)}`;
  }
  return `${formatThresholdShort(cur.minSum)} – ${formatThresholdShort(higher.minSum)}`;
}
