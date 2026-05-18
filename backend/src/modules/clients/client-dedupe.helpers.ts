import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { DEFAULT_SEARCH_FIELDS } from "./client-dedupe.constants";

export function formatBalanceUZS(d: Prisma.Decimal | null | undefined): string | null {
  if (d == null) return null;
  const n = Number(d.toString());
  const s = new Intl.NumberFormat("ru-RU").format(Math.round(n));
  return `${s} UZS`;
}

export function formatMoneyUZS(d: Prisma.Decimal | null | undefined, withCents: boolean): string | null {
  if (d == null) return null;
  const n = Number(d.toString());
  const s = withCents
    ? new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
    : new Intl.NumberFormat("ru-RU").format(Math.round(n));
  return `${s} UZS`;
}

export function formatContactPersonsSummary(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const parts: string[] = [];
  for (const entry of raw.slice(0, 5)) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const fn = String(o.firstName ?? o.first_name ?? "").trim();
    const ln = String(o.lastName ?? o.last_name ?? "").trim();
    const ph = String(o.phone ?? "").trim();
    const nm = [fn, ln].filter(Boolean).join(" ");
    const line = [nm, ph].filter(Boolean).join(", ");
    if (line) parts.push(line);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function normalizeSearchFields(raw: string[] | undefined): string[] {
  const allowed = new Set(["name", "legal_name", "phone", "inn", "pinfl", "contract", "address"]);
  const pick = (raw ?? []).map((s) => s.trim().toLowerCase()).filter((s) => allowed.has(s));
  return pick.length > 0 ? pick : DEFAULT_SEARCH_FIELDS;
}
