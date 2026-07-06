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

const QR_STATUS_LABEL_RU: Record<string, string> = {
  new: "Готово к печати",
  printed: "Напечатано",
  attached: "Прикреплено",
  detached: "Откреплено"
};

function formatCsvDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function territoryLabel(zone: string | null, region: string | null): string {
  return [zone, region].map((x) => String(x ?? "").trim()).filter(Boolean).join(" · ");
}

/** Jadval ustunlari bilan mos CSV (Excel uchun `;` ajratgich). */
export function toCsv(rows: QrListRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = [
    "Дата создания",
    "QR код",
    "Клиент",
    "Статус",
    "Территория",
    "Город",
    "Дата привязки"
  ];
  const out = [head.map(esc).join(";")];
  for (const r of rows) {
    out.push(
      [
        esc(formatCsvDateTime(r.created_at)),
        esc(r.qr_code),
        esc(r.client_name ?? ""),
        esc(QR_STATUS_LABEL_RU[r.status] ?? r.status),
        esc(territoryLabel(r.zone, r.region)),
        esc(r.city ?? ""),
        esc(formatCsvDateTime(r.bound_at))
      ].join(";")
    );
  }
  return `\uFEFF${out.join("\r\n")}`;
}

export function toClientsWithoutQrCsv(rows: ClientWithoutQrRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = ["Клиент", "Телефон", "Зона / область", "Город"];
  const out = [head.map(esc).join(";")];
  for (const r of rows) {
    out.push(
      [
        esc(r.name),
        esc(r.phone ?? ""),
        esc(territoryLabel(r.zone, r.region)),
        esc(r.city ?? "")
      ].join(";")
    );
  }
  return `\uFEFF${out.join("\r\n")}`;
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
