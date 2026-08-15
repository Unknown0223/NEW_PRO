import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

/** Blok = bitta доставщик (экспедитор) uchun yuk maydoni; biriktirish faqat `expeditor` roli. */
const EXPEDITOR_ROLE = "expeditor" as const;

export type WarehouseBlockRow = {
  id: number;
  name: string;
  warehouse_id: number;
  warehouse_name: string;
  code: string | null;
  sort_order: number;
  is_active: boolean;
  comment: string | null;
  empty_stock_confirmed_at: string | null;
  gruzchik_user_id: number | null;
  gruzchik_user_name: string | null;
  expeditors: { id: number; name: string }[];
};

export type WarehouseBlockSort = "name_asc" | "name_desc" | "sort_asc" | "sort_desc";

function warehouseBlocksWhere(
  tenantId: number,
  opts: { warehouse_id?: number; is_active?: boolean; q: string; archive?: boolean }
): Prisma.WarehouseBlockWhereInput {
  const where: Prisma.WarehouseBlockWhereInput = { tenant_id: tenantId };
  if (opts.warehouse_id != null && opts.warehouse_id > 0) {
    where.warehouse_id = opts.warehouse_id;
  }
  if (opts.archive) {
    where.is_active = false;
  } else if (opts.is_active !== undefined) {
    where.is_active = opts.is_active;
  } else {
    where.is_active = true;
  }
  const q = opts.q.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { comment: { contains: q, mode: "insensitive" } }
    ];
  }
  return where;
}

function warehouseBlocksOrderBy(sort: WarehouseBlockSort): Prisma.WarehouseBlockOrderByWithRelationInput[] {
  if (sort === "name_desc") return [{ name: "desc" }];
  if (sort === "name_asc") return [{ name: "asc" }];
  if (sort === "sort_desc") return [{ sort_order: "desc" }, { name: "asc" }];
  return [{ sort_order: "asc" }, { name: "asc" }];
}

export async function listWarehouseBlocks(
  tenantId: number,
  opts: {
    warehouse_id?: number;
    is_active?: boolean;
    archive?: boolean;
    q: string;
    sort: WarehouseBlockSort;
    page: number;
    limit: number;
  }
): Promise<{ data: WarehouseBlockRow[]; total: number; page: number; limit: number }> {
  const where = warehouseBlocksWhere(tenantId, opts);
  const orderBy = warehouseBlocksOrderBy(opts.sort);
  const skip = (opts.page - 1) * opts.limit;
  const [total, rows] = await prisma.$transaction([
    prisma.warehouseBlock.count({ where }),
    prisma.warehouseBlock.findMany({
      where,
      orderBy,
      skip,
      take: opts.limit,
      include: {
        warehouse: { select: { name: true } },
        gruzchik_user: { select: { id: true, name: true } },
        expeditors: { include: { user: { select: { id: true, name: true } } } }
      }
    })
  ]);

  const data: WarehouseBlockRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    warehouse_id: r.warehouse_id,
    warehouse_name: r.warehouse.name,
    code: r.code,
    sort_order: r.sort_order,
    is_active: r.is_active,
    comment: r.comment,
    empty_stock_confirmed_at: r.empty_stock_confirmed_at?.toISOString() ?? null,
    gruzchik_user_id: r.gruzchik_user?.id ?? null,
    gruzchik_user_name: r.gruzchik_user?.name ?? null,
    expeditors: r.expeditors.map((e) => ({ id: e.user.id, name: e.user.name }))
  }));

  return { data, total, page: opts.page, limit: opts.limit };
}

export async function buildWarehouseBlocksExportBuffer(
  tenantId: number,
  opts: { warehouse_id?: number; is_active?: boolean; archive?: boolean; q: string; sort: WarehouseBlockSort }
): Promise<Buffer> {
  const where = warehouseBlocksWhere(tenantId, opts);
  const orderBy = warehouseBlocksOrderBy(opts.sort);
  const rows = await prisma.warehouseBlock.findMany({
    where,
    orderBy,
    take: 10_000,
    include: {
      warehouse: { select: { name: true } },
      gruzchik_user: { select: { name: true } },
      expeditors: { include: { user: { select: { name: true } } } }
    }
  });
  const sheet = rows.map((r) => ({
    Название: r.name,
    Склад: r.warehouse.name,
    Доставщик: r.expeditors.map((e) => e.user.name).join("; "),
    Грузчик: r.gruzchik_user?.name ?? "",
    Код: r.code ?? "",
    Сортировка: r.sort_order,
    Комментарий: r.comment ?? "",
    Активный: r.is_active ? "Да" : "Нет",
    Пустой_блок_подтвержден: r.empty_stock_confirmed_at?.toISOString() ?? ""
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheet.length ? sheet : [{ Название: "" }]);
  XLSX.utils.book_append_sheet(wb, ws, "Блоки");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function assertWarehouse(tenantId: number, warehouseId: number) {
  const wh = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");
}

async function validateExpeditorUserIds(tenantId: number, userIds: number[]) {
  const uniq = [...new Set(userIds)].filter((id) => Number.isFinite(id) && id > 0);
  if (uniq.length === 0) return [];
  if (uniq.length > 1) throw new Error("TOO_MANY_EXPEDITORS");
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: uniq },
      is_active: true,
      role: EXPEDITOR_ROLE
    },
    select: { id: true }
  });
  const ok = new Set(users.map((u) => u.id));
  for (const id of uniq) {
    if (!ok.has(id)) throw new Error("BAD_EXPEDITOR_USER");
  }
  return uniq;
}

async function validateGruzchikUserId(tenantId: number, userId?: number | null): Promise<number | null> {
  if (userId == null) return null;
  if (!Number.isFinite(userId) || userId < 1) throw new Error("BAD_GRUZCHIK_USER");
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true, role: "gruzchik" },
    select: { id: true }
  });
  if (!u) throw new Error("BAD_GRUZCHIK_USER");
  return u.id;
}

export async function createWarehouseBlock(
  tenantId: number,
  input: {
    warehouse_id: number;
    name: string;
    code?: string | null;
    sort_order?: number | null;
    is_active?: boolean;
    comment?: string | null;
    expeditor_user_ids: number[];
    gruzchik_user_id?: number | null;
  }
): Promise<{ id: number }> {
  await assertWarehouse(tenantId, input.warehouse_id);
  const name = input.name.trim();
  if (!name) throw new Error("EMPTY_NAME");
  const expIds = await validateExpeditorUserIds(tenantId, input.expeditor_user_ids ?? []);
  const gruzchikUserId = await validateGruzchikUserId(tenantId, input.gruzchik_user_id);

  const code = input.code?.trim() ? input.code.trim().slice(0, 20) : null;
  const comment = input.comment?.trim() ? input.comment.trim().slice(0, 2000) : null;
  const sortOrder =
    input.sort_order != null && Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;

  const block = await prisma.warehouseBlock.create({
    data: {
      tenant_id: tenantId,
      warehouse_id: input.warehouse_id,
      name,
      code,
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
      comment,
      gruzchik_user_id: gruzchikUserId,
      expeditors: {
        create: expIds.map((user_id) => ({ user_id }))
      }
    },
    select: { id: true }
  });
  return { id: block.id };
}

export async function updateWarehouseBlock(
  tenantId: number,
  id: number,
  input: {
    warehouse_id: number;
    name: string;
    code?: string | null;
    sort_order?: number | null;
    is_active?: boolean;
    comment?: string | null;
    expeditor_user_ids: number[];
    gruzchik_user_id?: number | null;
  }
): Promise<void> {
  const existing = await prisma.warehouseBlock.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");
  await assertWarehouse(tenantId, input.warehouse_id);
  const name = input.name.trim();
  if (!name) throw new Error("EMPTY_NAME");
  const expIds = await validateExpeditorUserIds(tenantId, input.expeditor_user_ids ?? []);
  const gruzchikUserId = await validateGruzchikUserId(tenantId, input.gruzchik_user_id);
  const code = input.code?.trim() ? input.code.trim().slice(0, 20) : null;
  const comment = input.comment?.trim() ? input.comment.trim().slice(0, 2000) : null;
  const sortOrder =
    input.sort_order != null && Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;
  const isActive = input.is_active !== undefined ? input.is_active : existing.is_active;

  await prisma.$transaction([
    prisma.warehouseBlockExpeditor.deleteMany({ where: { block_id: id } }),
    prisma.warehouseBlock.update({
      where: { id },
      data: {
        warehouse_id: input.warehouse_id,
        name,
        code,
        sort_order: sortOrder,
        is_active: isActive,
        comment,
        gruzchik_user_id: gruzchikUserId,
        expeditors: { create: expIds.map((user_id) => ({ user_id })) }
      }
    })
  ]);
}

export async function deleteWarehouseBlock(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<void> {
  const existing = await prisma.warehouseBlock.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, name: true, is_active: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (!existing.is_active) throw new Error("ALREADY_VOIDED");
  await prisma.warehouseBlock.update({
    where: { id },
    data: { is_active: false }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "warehouse_block",
    entityId: id,
    action: "warehouse_block.void",
    payload: { name: existing.name, soft: true }
  });
}

export async function restoreWarehouseBlock(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<void> {
  const existing = await prisma.warehouseBlock.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, name: true, is_active: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.is_active) throw new Error("NOT_VOIDED");
  await prisma.warehouseBlock.update({
    where: { id },
    data: { is_active: true }
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "warehouse_block",
    entityId: id,
    action: "warehouse_block.restore",
    payload: { name: existing.name }
  });
}

export async function confirmWarehouseBlockEmpty(tenantId: number, id: number): Promise<void> {
  const r = await prisma.warehouseBlock.updateMany({
    where: { id, tenant_id: tenantId, is_active: true },
    data: { empty_stock_confirmed_at: new Date() }
  });
  if (r.count === 0) throw new Error("NOT_FOUND");
}
