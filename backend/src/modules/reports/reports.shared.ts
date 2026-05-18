/**
 * Domain: Reports (sotuv, qarz, kassa oqimi va boshqa GET hisobotlar).
 * Boundary: route → `reports.schemas` + RBAC; servis → Prisma agregat / raw SQL.
 * Bog‘liq: `reports.route.ts`, `report-builder.service.ts`, `docs/domain-boundary.md`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

export function parseDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
  const result: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) result.gte = d;
  }
  if (to) {
    const d = new Date(to);
    d.setUTCHours(23, 59, 59, 999);
    if (!Number.isNaN(d.getTime())) result.lte = d;
  }
  return result;
}
