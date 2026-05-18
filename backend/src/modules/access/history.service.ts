import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  deriveAccessHistoryActionTypeLabel,
  deriveAccessHistoryOperationLabel,
  formatAccessHistoryPersonLine,
  type AccessHistoryLabelInput
} from "./access-history-labels";

export type AccessHistoryQuery = {
  page: number;
  limit: number;
  /** Одна запись журнала (режим «детали») — остальные фильтры не комбинируются */
  access_log_id?: number;
  action_type?: string;
  actor_user_id?: number;
  target_user_id?: number;
  from?: string;
  to?: string;
  /** Поиск по типу действия, сущности, логину/имени/коду исполнителя и пользователя */
  search?: string;
  /** Сортировка по дате записи */
  sort_dir?: "asc" | "desc";
};

function labelInputFromRow(r: {
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_value: unknown;
  new_value: unknown;
}): AccessHistoryLabelInput {
  return {
    action_type: r.action_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    old_value: r.old_value,
    new_value: r.new_value
  };
}

export function formatAccessHistoryDateRu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function enrichRow(r: {
  id: number;
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  device: string | null;
  actor_user_id: number | null;
  actor: { login: string; name: string; code: string | null } | null;
  target_user_id: number | null;
  target: { login: string; name: string; code: string | null } | null;
  created_at: Date;
}) {
  const li = labelInputFromRow(r);
  return {
    id: r.id,
    action_type: r.action_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    old_value: r.old_value,
    new_value: r.new_value,
    ip_address: r.ip_address,
    device: r.device,
    actor_user_id: r.actor_user_id,
    actor_login: r.actor?.login ?? null,
    actor_name: r.actor?.name ?? null,
    actor_code: r.actor?.code ?? null,
    actor_display: formatAccessHistoryPersonLine(r.actor?.code, r.actor?.name, r.actor?.login),
    target_user_id: r.target_user_id,
    target_login: r.target?.login ?? null,
    target_name: r.target?.name ?? null,
    target_code: r.target?.code ?? null,
    target_display: formatAccessHistoryPersonLine(r.target?.code, r.target?.name, r.target?.login),
    created_at: r.created_at.toISOString(),
    operation_label: deriveAccessHistoryOperationLabel(li),
    action_type_label: deriveAccessHistoryActionTypeLabel(li)
  };
}

function endOfLocalDayFromYmd(raw: string): Date | null {
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, day] = t.split("-").map(Number);
  const d = new Date(y, m - 1, day, 23, 59, 59, 999);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return d;
}

export async function listAccessHistory(tenantId: number, q: AccessHistoryQuery) {
  const idOnly = q.access_log_id != null && Number.isInteger(q.access_log_id) && q.access_log_id > 0;
  const where: Prisma.AccessLogWhereInput = { tenant_id: tenantId };
  if (idOnly) {
    where.id = q.access_log_id!;
  } else {
    if (q.action_type?.trim()) where.action_type = q.action_type.trim();
    if (q.actor_user_id) where.actor_user_id = q.actor_user_id;
    if (q.target_user_id) where.target_user_id = q.target_user_id;
  }
  if (!idOnly && (q.from || q.to)) {
    const range: { gte?: Date; lte?: Date } = {};
    if (q.from) {
      const d = new Date(q.from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (q.to) {
      const raw = q.to.trim();
      const endDay = endOfLocalDayFromYmd(raw);
      if (endDay) {
        range.lte = endDay;
      } else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) range.lte = d;
      }
    }
    if (Object.keys(range).length > 0) where.created_at = range;
  }

  const search = !idOnly ? q.search?.trim() : "";
  if (search) {
    const mode = Prisma.QueryMode.insensitive;
    where.AND = [
      {
        OR: [
          { action_type: { contains: search, mode } },
          { entity_type: { contains: search, mode } },
          { entity_id: { contains: search, mode } },
          {
            actor: {
              is: {
                OR: [
                  { login: { contains: search, mode } },
                  { name: { contains: search, mode } },
                  { code: { contains: search, mode } }
                ]
              }
            }
          },
          {
            target: {
              is: {
                OR: [
                  { login: { contains: search, mode } },
                  { name: { contains: search, mode } },
                  { code: { contains: search, mode } }
                ]
              }
            }
          }
        ]
      }
    ];
  }

  const sortDir = q.sort_dir === "asc" ? "asc" : "desc";
  const [total, rows] = await Promise.all([
    prisma.accessLog.count({ where }),
    prisma.accessLog.findMany({
      where,
      orderBy: { created_at: sortDir },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        actor: { select: { login: true, name: true, code: true } },
        target: { select: { login: true, name: true, code: true } }
      }
    })
  ]);
  return {
    data: rows.map(enrichRow),
    total,
    page: q.page,
    limit: q.limit
  };
}

export async function listAccessHistoryActionTypes(tenantId: number, take = 80) {
  const grouped = await prisma.accessLog.groupBy({
    by: ["action_type"],
    where: { tenant_id: tenantId },
    _count: { _all: true }
  });
  return grouped
    .map((g) => ({ action_type: g.action_type, count: g._count._all }))
    .sort((a, b) => b.count - a.count || a.action_type.localeCompare(b.action_type, "ru"))
    .slice(0, take);
}

export type AccessHistoryEnrichedRow = ReturnType<typeof enrichRow>;

export async function buildAccessHistoryXlsxBuffer(rows: AccessHistoryEnrichedRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("История", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Дата", key: "date", width: 20 },
    { header: "Операции", key: "op", width: 42 },
    { header: "Исполнитель", key: "actor", width: 38 },
    { header: "Пользователь", key: "target", width: 38 },
    { header: "Тип действия", key: "kind", width: 58 }
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      date: formatAccessHistoryDateRu(r.created_at),
      op: r.operation_label,
      actor: r.actor_display,
      target: r.target_display,
      kind: r.action_type_label
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
