import { Prisma } from "@prisma/client";
import {
  ORDER_CREATED_UTC_OFFSET_HOURS,
  BALANCE_PERF_LOG
} from "./client-balances.constants";

export function parseIsoDateStartUtc(iso: string): Date | null {
  const t = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

export function parseIsoDateEndUtc(iso: string): Date | null {
  const t = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
}

/** `orders.created_at` — kalendari `Asia/Tashkent` bo‘yicha (konsignatsiya / «дата заказа» filtri). */
function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function localDateStartToUtc(ymd: string): Date | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const ms = Date.UTC(p.y, p.m - 1, p.d, 0, 0, 0, 0) - ORDER_CREATED_UTC_OFFSET_HOURS * 3600 * 1000;
  return new Date(ms);
}

function localDateEndToUtc(ymd: string): Date | null {
  const start = localDateStartToUtc(ymd);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 3600 * 1000 - 1);
}

export function makePerfMarker(scope: string) {
  const startedAt = Date.now();
  let last = startedAt;
  return (stage: string, meta?: Record<string, unknown>) => {
    if (!BALANCE_PERF_LOG) return;
    const now = Date.now();
    const deltaMs = now - last;
    last = now;
    const totalMs = now - startedAt;
    console.info(
      `[perf][${scope}] ${stage} | +${deltaMs}ms (total ${totalMs}ms)${
        meta ? ` | ${JSON.stringify(meta)}` : ""
      }`
    );
  };
}

export function buildOrderCreatedLocalDateClause(
  orderDateFrom: string | null | undefined,
  orderDateTo: string | null | undefined
): Prisma.Sql {
  const from = orderDateFrom?.trim();
  const to = orderDateTo?.trim();
  const fromUtc = from ? localDateStartToUtc(from) : null;
  const toUtc = to ? localDateEndToUtc(to) : null;
  if (!fromUtc && !toUtc) return Prisma.empty;
  if (fromUtc && toUtc) {
    return Prisma.sql`AND o.created_at >= ${fromUtc} AND o.created_at <= ${toUtc}`;
  }
  if (fromUtc) {
    return Prisma.sql`AND o.created_at >= ${fromUtc}`;
  }
  return Prisma.sql`AND o.created_at <= ${toUtc}`;
}
