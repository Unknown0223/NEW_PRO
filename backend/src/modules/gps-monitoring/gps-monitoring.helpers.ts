import type { GpsEmployeeType } from "./gps-monitoring.types";

export function startOfLocalDay(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) throw new Error("InvalidDate");
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 0, 0, 0, 0);
}

export function endOfLocalDay(isoDate: string): Date {
  const start = startOfLocalDay(isoDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function hourFloatFromDate(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function fmtLastSeen(d: Date | null | undefined): string {
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function regionOfTerritory(territory: string | null | undefined, explicit?: string | null): string {
  if (explicit?.trim()) return explicit.trim();
  const t = (territory ?? "").toUpperCase();
  if (/(TOSHKENT|YUNUSOBOD|CHILANZOR|MIRABOD|YASHNOBOD|SERGELI|CHIRCHIQ|O'RTA|BO'KA|PISKENT|TO'YTEPA|QIBRAY|OLMALIQ|ANGREN|YANGIYO|ТАШКЕНТ)/.test(t)) {
    return "Toshkent";
  }
  if (/(FARG'ONA|FERGANA|QO'QON|VODIYSI|ФЕРГАН)/.test(t)) return "Farg'ona";
  if (/ANDIJON|АНДИЖАН/.test(t)) return "Andijon";
  if (/NAMANGAN|НАМАНГАН/.test(t)) return "Namangan";
  if (/SAMARQAND|САМАРКАНД/.test(t)) return "Samarqand";
  if (/BUXORO|БУХАРА/.test(t)) return "Buxoro";
  if (/NAVOIY|НАВОИ/.test(t)) return "Navoiy";
  if (/NUKUS|НУКУС/.test(t)) return "Nukus";
  return "Boshqa";
}

export function mapDbRoleToType(
  role: string,
  opts: { vanSelling?: boolean; agentType?: string | null }
): GpsEmployeeType {
  if (role === "supervisor") return "supervisor";
  if (role === "expeditor") return "delivery";
  if (role === "collector") return "inkasator";
  if (opts.vanSelling || /vansell|van.?sell/i.test(opts.agentType ?? "")) return "vansell";
  return "agent";
}

export function roleFilterToDbRoles(role?: string | null): string[] {
  const r = (role ?? "").trim().toLowerCase();
  if (!r || r === "all") return ["agent", "expeditor", "supervisor", "collector"];
  if (r === "agent") return ["agent"];
  if (r === "delivery") return ["expeditor"];
  if (r === "supervisor") return ["supervisor"];
  if (r === "inkasator") return ["collector"];
  if (r === "vansell") return ["agent"];
  return ["agent", "expeditor", "supervisor", "collector"];
}

export function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}
