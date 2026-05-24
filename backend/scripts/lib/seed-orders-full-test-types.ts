export type SeededOrder = {
  id: number;
  number: string;
  client_id: number;
  order_type: string | null;
  status: string;
  total_sum: string;
  bonus_sum: string;
  discount_sum: string;
};

export function intEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function nowTag(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${d.getFullYear()}${mm}${dd}_${hh}${mi}${ss}`;
}
