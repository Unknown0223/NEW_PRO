import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

import type { ClientWithoutQrRow, QrListQuery, QrListRow } from "./client-qr.types";

export function parseYmdStart(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

export function parseYmdEnd(s?: string): Date | null {
  const d = parseYmdStart(s);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function makeQrCode(): string {
  const chunk = randomBytes(6).toString("hex").toUpperCase();
  return `QR-CLIENT-${chunk}`;
}

/** Partiya ichida takrorlanmasligi uchun (@@unique tenant_id + qr_code). */
export function uniqueQrCodes(n: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  while (out.length < n) {
    const c = makeQrCode();
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export const MAX_QR_GENERATE_PER_REQUEST = 20_000;
export const QR_GENERATE_CHUNK = 500;

export function toCsv(rows: QrListRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = [
    "id",
    "qr_code",
    "status",
    "client_id",
    "client_name",
    "zone",
    "region",
    "city",
    "created_at",
    "printed_at",
    "bound_at",
    "detached_at",
    "created_by",
    "bound_by"
  ];
  const out = [head.join(",")];
  for (const r of rows) {
    out.push(
      [
        r.id,
        esc(r.qr_code),
        esc(r.status),
        r.client_id ?? "",
        esc(r.client_name),
        esc(r.zone),
        esc(r.region),
        esc(r.city),
        esc(r.created_at),
        esc(r.printed_at),
        esc(r.bound_at),
        esc(r.detached_at),
        esc(r.created_by_name),
        esc(r.bound_by_name)
      ].join(",")
    );
  }
  return `\uFEFF${out.join("\n")}`;
}

export function toClientsWithoutQrCsv(rows: ClientWithoutQrRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = ["id", "name", "phone", "zone", "region", "city", "agent_id"];
  const out = [head.join(",")];
  for (const r of rows) {
    out.push([r.id, esc(r.name), esc(r.phone), esc(r.zone), esc(r.region), esc(r.city), r.agent_id ?? ""].join(","));
  }
  return `\uFEFF${out.join("\n")}`;
}

export function buildWhere(tenantId: number, q: QrListQuery): Prisma.Sql {
  const where: Prisma.Sql[] = [Prisma.sql`q.tenant_id = ${tenantId}`, Prisma.sql`q.is_active = TRUE`];
  if (q.search?.trim()) {
    const p = `%${q.search.trim()}%`;
    where.push(
      Prisma.sql`(
        q.qr_code ILIKE ${p}
        OR COALESCE(c.name,'') ILIKE ${p}
        OR COALESCE(c.zone,'') ILIKE ${p}
        OR COALESCE(c.region,'') ILIKE ${p}
        OR COALESCE(c.city,'') ILIKE ${p}
        OR COALESCE(u1.name,'') ILIKE ${p}
        OR COALESCE(u2.name,'') ILIKE ${p}
      )`
    );
  }
  if (q.attached === "yes") where.push(Prisma.sql`q.client_id IS NOT NULL`);
  if (q.attached === "no") where.push(Prisma.sql`q.client_id IS NULL`);

  const statusList = (q.statuses?.length ? q.statuses : q.status ? [q.status] : []).filter(Boolean);
  if (statusList.length === 1) {
    where.push(Prisma.sql`q.status = ${statusList[0]}`);
  } else if (statusList.length > 1) {
    where.push(Prisma.sql`q.status IN (${Prisma.join(statusList)})`);
  }
  if (q.zone?.trim()) where.push(Prisma.sql`COALESCE(c.zone,'') = ${q.zone.trim()}`);
  if (q.region?.trim()) where.push(Prisma.sql`COALESCE(c.region,'') = ${q.region.trim()}`);
  if (q.city?.trim()) where.push(Prisma.sql`COALESCE(c.city,'') = ${q.city.trim()}`);
  const from = parseYmdStart(q.from);
  const to = parseYmdEnd(q.to);
  if (q.date_type === "attached_date") {
    if (from) where.push(Prisma.sql`q.bound_at >= ${from}`);
    if (to) where.push(Prisma.sql`q.bound_at <= ${to}`);
  } else {
    if (from) where.push(Prisma.sql`q.created_at >= ${from}`);
    if (to) where.push(Prisma.sql`q.created_at <= ${to}`);
  }
  return Prisma.join(where, " AND ");
}
