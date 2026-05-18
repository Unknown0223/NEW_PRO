/**
 * Domain: Dashboard (supervisor / sales / finance snapshot).
 * Boundary: route → filter parse + RBAC scope; servis → Prisma agregatlar + Redis cache (`DASHBOARD_CACHE_TTL`).
 * Bog‘liq: `dashboard.route.ts`, `recordDashboardPerf`, `docs/domain-boundary.md`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { getRedisForApp } from "../../lib/redis-cache";
import {
  ORDER_STATUSES,
  ORDER_STATUSES_OUTSTANDING_RECEIVABLE
} from "../orders/order-status";

import { startOfTodayUtc } from "./dashboard.cache";

export function normalizeYmd(input?: string): string {
  const t = (input ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return startOfTodayUtc().toISOString().slice(0, 10);
}

export function csvToIntArray(input?: string): number[] {
  if (!input) return [];
  const uniq = new Set<number>();
  for (const part of input.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (Number.isFinite(n) && n > 0) uniq.add(n);
  }
  return Array.from(uniq).sort((a, b) => a - b);
}

export function csvToStringArray(input?: string): string[] {
  if (!input) return [];
  const uniq = new Set<string>();
  for (const part of input.split(",")) {
    const t = part.trim();
    if (t) uniq.add(t);
  }
  return Array.from(uniq);
}

export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.round(v * 10) / 10;
}

export function decToString(v: Prisma.Decimal | string | number | null | undefined): string {
  if (v == null) return "0";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return v.toString();
}

export function bigToNum(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  return Number(v);
}

export function nonEmpty(s?: string): string | undefined {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : undefined;
}
