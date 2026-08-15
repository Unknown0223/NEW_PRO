import ExcelJS from "exceljs";
import { prisma } from "../../config/database";

export type ListTenantAuditQuery = {
  entity_type?: string;
  entity_id?: string;
  actor_user_id?: number;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

export type TenantAuditEventRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: unknown;
  actor_user_id: number | null;
  actor_login: string | null;
  created_at: string;
};

function buildWhere(tenantId: number, q: Omit<ListTenantAuditQuery, "page" | "limit">) {
  const where: {
    tenant_id: number;
    entity_type?: string;
    entity_id?: string;
    actor_user_id?: number;
    created_at?: { gte?: Date; lte?: Date };
  } = { tenant_id: tenantId };

  if (q.entity_type?.trim()) {
    where.entity_type = q.entity_type.trim();
  }
  if (q.entity_id?.trim()) {
    where.entity_id = q.entity_id.trim();
  }
  if (q.actor_user_id != null && Number.isFinite(q.actor_user_id)) {
    where.actor_user_id = Math.floor(q.actor_user_id);
  }
  if (q.from?.trim() || q.to?.trim()) {
    where.created_at = {};
    if (q.from?.trim()) {
      const d = new Date(q.from.trim());
      if (!Number.isNaN(d.getTime())) {
        where.created_at.gte = d;
      }
    }
    if (q.to?.trim()) {
      const d = new Date(q.to.trim());
      if (!Number.isNaN(d.getTime())) {
        where.created_at.lte = d;
      }
    }
    if (Object.keys(where.created_at).length === 0) {
      delete where.created_at;
    }
  }
  return where;
}

function mapRow(r: {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: unknown;
  actor_user_id: number | null;
  created_at: Date;
  actor: { login: string } | null;
}): TenantAuditEventRow {
  return {
    id: r.id,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    action: r.action,
    payload: r.payload,
    actor_user_id: r.actor_user_id,
    actor_login: r.actor?.login ?? null,
    created_at: r.created_at.toISOString()
  };
}

export async function listTenantAuditEvents(tenantId: number, q: ListTenantAuditQuery) {
  const where = buildWhere(tenantId, q);

  const [total, rows] = await Promise.all([
    prisma.tenantAuditEvent.count({ where }),
    prisma.tenantAuditEvent.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        actor: { select: { login: true } }
      }
    })
  ]);

  return {
    data: rows.map(mapRow),
    total,
    page: q.page,
    limit: q.limit
  };
}

const EXPORT_MAX = 5000;

/** Filtrlarga mos audit jurnal (export limithi). */
export async function listTenantAuditEventsForExport(
  tenantId: number,
  q: Omit<ListTenantAuditQuery, "page" | "limit">
): Promise<{ data: TenantAuditEventRow[]; total: number; truncated: boolean }> {
  const where = buildWhere(tenantId, q);
  const total = await prisma.tenantAuditEvent.count({ where });
  const rows = await prisma.tenantAuditEvent.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: EXPORT_MAX,
    include: { actor: { select: { login: true } } }
  });
  return {
    data: rows.map(mapRow),
    total,
    truncated: total > rows.length
  };
}

function formatAuditDateRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" });
}

export async function buildTenantAuditXlsxBuffer(rows: TenantAuditEventRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Аудит", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Дата", key: "date", width: 22 },
    { header: "Исполнитель", key: "actor", width: 28 },
    { header: "Тип объекта", key: "entity_type", width: 22 },
    { header: "ID объекта", key: "entity_id", width: 14 },
    { header: "Действие", key: "action", width: 36 },
    { header: "Payload", key: "payload", width: 48 }
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    let payloadStr = "";
    try {
      payloadStr = JSON.stringify(r.payload ?? {});
      if (payloadStr.length > 2000) payloadStr = `${payloadStr.slice(0, 2000)}…`;
    } catch {
      payloadStr = String(r.payload ?? "");
    }
    ws.addRow({
      date: formatAuditDateRu(r.created_at),
      actor: r.actor_login ?? (r.actor_user_id != null ? String(r.actor_user_id) : ""),
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      action: r.action,
      payload: payloadStr
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
