import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../config/database";
import { restoreVoidedCode, voidCodeSuffix } from "../../lib/soft-void";

const supplierSelect = {
  id: true,
  name: true,
  code: true,
  phone: true,
  address: true,
  sort_order: true,
  opening_balance: true,
  opening_balance_note: true,
  comment: true,
  is_active: true,
  created_at: true,
  updated_at: true
} as const;

export type SupplierListRow = Prisma.SupplierGetPayload<{ select: typeof supplierSelect }>;

export type SupplierListSortKey = "sort_order" | "name" | "code" | "phone" | "opening_balance" | "created_at";

export type ListSuppliersOptions = {
  /** `active` — default; `inactive` — noaktivlar; `all` — ikkalasi (legacy `all=1`) */
  mode?: "active" | "inactive" | "all";
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: SupplierListSortKey;
  sort_dir?: "asc" | "desc";
};

export async function listSuppliersForTenant(
  tenantId: number,
  opts: ListSuppliersOptions = {}
): Promise<{ data: SupplierListRow[]; total: number }> {
  const mode = opts.mode ?? "active";
  const search = opts.search?.trim();
  const page = opts.page != null && opts.page > 0 ? opts.page : 0;
  const limit = opts.limit != null && opts.limit > 0 ? Math.min(opts.limit, 200) : 0;
  const paged = page > 0 && limit > 0;

  const where: Prisma.SupplierWhereInput = { tenant_id: tenantId };
  if (mode === "inactive") where.is_active = false;
  else if (mode === "active") where.is_active = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { comment: { contains: search, mode: "insensitive" } }
    ];
  }

  const dir = opts.sort_dir === "desc" ? "desc" : "asc";
  const sk = opts.sort_by;
  let orderBy: Prisma.SupplierOrderByWithRelationInput[];
  if (sk === "name") orderBy = [{ name: dir }, { id: dir }];
  else if (sk === "code") orderBy = [{ code: dir }, { id: dir }];
  else if (sk === "phone") orderBy = [{ phone: dir }, { id: dir }];
  else if (sk === "opening_balance") orderBy = [{ opening_balance: dir }, { id: dir }];
  else if (sk === "created_at") orderBy = [{ created_at: dir }, { id: dir }];
  else if (sk === "sort_order") orderBy = [{ sort_order: dir }, { name: "asc" }, { id: "asc" }];
  else orderBy = [{ sort_order: "asc" }, { name: "asc" }];

  if (paged) {
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: supplierSelect
      }),
      prisma.supplier.count({ where })
    ]);
    return { data, total };
  }

  const data = await prisma.supplier.findMany({
    where,
    orderBy,
    select: supplierSelect
  });
  return { data, total: data.length };
}

async function nextSupplierCode(tenantId: number): Promise<string> {
  const prefix = "SUP-";
  const rows = await prisma.supplier.findMany({
    where: { tenant_id: tenantId, code: { startsWith: prefix, mode: "insensitive" } },
    select: { code: true }
  });
  let max = 0;
  for (const r of rows) {
    const c = r.code?.trim();
    if (!c) continue;
    const m = /^SUP-(\d+)$/i.exec(c);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function assertUniqueCode(tenantId: number, code: string | null | undefined, excludeId?: number) {
  const c = code?.trim();
  if (!c) return;
  const dup = await prisma.supplier.findFirst({
    where: { tenant_id: tenantId, code: c, ...(excludeId != null ? { id: { not: excludeId } } : {}) },
    select: { id: true }
  });
  if (dup) throw new Error("DUPLICATE_CODE");
}

export async function createSupplierRow(
  tenantId: number,
  data: {
    name: string;
    code?: string | null;
    phone?: string | null;
    address?: string | null;
    sort_order?: number | null;
    comment?: string | null;
    is_active?: boolean | null;
    opening_balance?: number | null;
    opening_balance_note?: string | null;
    /** true — bo‘sh kod bo‘lsa avtomatik SUP-NNN */
    auto_code?: boolean;
  }
) {
  const name = data.name.trim();
  if (!name) throw new Error("BAD_NAME");

  let code = data.code?.trim() || null;
  if (!code && data.auto_code !== false) {
    code = await nextSupplierCode(tenantId);
  }
  await assertUniqueCode(tenantId, code);

  return prisma.supplier.create({
    data: {
      tenant_id: tenantId,
      name,
      code,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      sort_order: data.sort_order != null && Number.isFinite(data.sort_order) ? Math.trunc(data.sort_order) : 0,
      opening_balance:
        data.opening_balance != null && Number.isFinite(data.opening_balance)
          ? new Decimal(data.opening_balance)
          : new Decimal(0),
      opening_balance_note: data.opening_balance_note?.trim() || null,
      comment: data.comment?.trim() || null,
      is_active: data.is_active !== false
    },
    select: supplierSelect
  });
}

export async function updateSupplierRow(
  tenantId: number,
  id: number,
  data: {
    name?: string;
    code?: string | null;
    phone?: string | null;
    address?: string | null;
    sort_order?: number | null;
    comment?: string | null;
    is_active?: boolean | null;
    opening_balance?: number | null;
    opening_balance_note?: string | null;
  }
) {
  const existing = await prisma.supplier.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true }
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("BAD_NAME");
  }

  const code =
    data.code !== undefined ? (data.code?.trim() || null) : undefined;
  if (code !== undefined) {
    await assertUniqueCode(tenantId, code, id);
  }

  const patch: Prisma.SupplierUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (code !== undefined) patch.code = code;
  if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
  if (data.address !== undefined) patch.address = data.address?.trim() || null;
  if (data.sort_order !== undefined) {
    patch.sort_order =
      data.sort_order != null && Number.isFinite(data.sort_order) ? Math.trunc(data.sort_order) : 0;
  }
  if (data.comment !== undefined) patch.comment = data.comment?.trim() || null;
  if (data.is_active !== undefined) patch.is_active = data.is_active !== false;

  return prisma.supplier.update({
    where: { id },
    data: patch,
    select: supplierSelect
  });
}

export async function deleteSupplierRow(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const existing = await prisma.supplier.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, name: true, code: true, is_active: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (!existing.is_active) throw new Error("ALREADY_VOIDED");

  const data: Prisma.SupplierUpdateInput = { is_active: false };
  if (existing.code) {
    data.code = voidCodeSuffix(existing.code, existing.id, 64);
  }
  await prisma.supplier.update({ where: { id }, data });
  void actorUserId;
  return existing;
}

export async function restoreSupplierRow(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const existing = await prisma.supplier.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, name: true, code: true, is_active: true }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.is_active) throw new Error("NOT_VOIDED");

  const data: Prisma.SupplierUpdateInput = { is_active: true };
  if (existing.code) {
    data.code = restoreVoidedCode(existing.code).slice(0, 64);
  }
  await prisma.supplier.update({ where: { id }, data });
  void actorUserId;
  return existing;
}
