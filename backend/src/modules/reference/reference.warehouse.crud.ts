import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { STOCK_PURPOSE_VALUES, warehouseDetailSelect } from "./reference.warehouse.constants";
import { getWarehouseDetail } from "./reference.warehouse.pickers";
import type { WarehouseTableRow } from "./reference.warehouse.types";
import { assertWarehouseLinkRoles } from "./reference.warehouse.links";

export async function createWarehouseRow(
  tenantId: number,
  input: {
    name: string;
    type?: string | null;
    stock_purpose?: (typeof STOCK_PURPOSE_VALUES)[number];
    address?: string | null;
    code?: string | null;
    payment_method?: string | null;
    van_selling?: boolean;
    is_active?: boolean;
    links?: { user_id: number; link_role: string }[];
  },
  actorUserId: number | null = null
) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("EMPTY_NAME");
  }
  const dup = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId, name: { equals: name, mode: "insensitive" } }
  });
  if (dup) {
    throw new Error("NAME_EXISTS");
  }
  const code = input.code?.trim() ? input.code.trim().slice(0, 40) : null;
  const payment_method = input.payment_method?.trim() ? input.payment_method.trim().slice(0, 200) : null;
  const links = input.links ?? [];
  await assertWarehouseLinkRoles(tenantId, links);
  const purpose =
    input.stock_purpose != null &&
    (STOCK_PURPOSE_VALUES as readonly string[]).includes(input.stock_purpose)
      ? input.stock_purpose
      : "sales";
  const row = await prisma.warehouse.create({
    data: {
      tenant_id: tenantId,
      name,
      type: input.type?.trim() || null,
      stock_purpose: purpose,
      address: input.address?.trim() || null,
      code,
      payment_method,
      van_selling: input.van_selling ?? false,
      is_active: input.is_active ?? true,
      links: {
        create: links.map((l) => ({
          user_id: l.user_id,
          link_role: l.link_role
        }))
      }
    },
    select: warehouseDetailSelect
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.warehouse,
    entityId: row.id,
    action: "create",
    payload: { name: row.name, type: row.type, address: row.address, code: row.code }
  });
  return row;
}

export async function updateWarehouseRow(
  tenantId: number,
  warehouseId: number,
  patch: {
    name?: string;
    type?: string | null;
    stock_purpose?: (typeof STOCK_PURPOSE_VALUES)[number];
    address?: string | null;
    code?: string | null;
    payment_method?: string | null;
    van_selling?: boolean;
    is_active?: boolean;
    links?: { user_id: number; link_role: string }[];
  },
  actorUserId: number | null = null
) {
  const existing = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenant_id: tenantId }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }
  const data: {
    name?: string;
    type?: string | null;
    stock_purpose?: string;
    address?: string | null;
    code?: string | null;
    payment_method?: string | null;
    van_selling?: boolean;
    is_active?: boolean;
  } = {};
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) {
      throw new Error("EMPTY_NAME");
    }
    const dup = await prisma.warehouse.findFirst({
      where: {
        tenant_id: tenantId,
        name: { equals: t, mode: "insensitive" },
        NOT: { id: warehouseId }
      }
    });
    if (dup) {
      throw new Error("NAME_EXISTS");
    }
    data.name = t;
  }
  if (patch.type !== undefined) {
    data.type = patch.type === null || patch.type === "" ? null : patch.type.trim();
  }
  if (patch.stock_purpose !== undefined) {
    if (!(STOCK_PURPOSE_VALUES as readonly string[]).includes(patch.stock_purpose)) {
      throw new Error("InvalidStockPurpose");
    }
    data.stock_purpose = patch.stock_purpose;
  }
  if (patch.address !== undefined) {
    data.address = patch.address === null || patch.address === "" ? null : patch.address.trim();
  }
  if (patch.code !== undefined) {
    data.code = patch.code === null || patch.code === "" ? null : patch.code.trim().slice(0, 40);
  }
  if (patch.payment_method !== undefined) {
    data.payment_method =
      patch.payment_method === null || patch.payment_method === ""
        ? null
        : patch.payment_method.trim().slice(0, 200);
  }
  if (patch.van_selling !== undefined) {
    data.van_selling = patch.van_selling;
  }
  if (patch.is_active !== undefined) {
    data.is_active = patch.is_active;
  }
  if (patch.links !== undefined) {
    await assertWarehouseLinkRoles(tenantId, patch.links);
  }
  if (Object.keys(data).length === 0 && patch.links === undefined) {
    throw new Error("EMPTY_PATCH");
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.warehouse.update({ where: { id: warehouseId }, data });
    }
    if (patch.links !== undefined) {
      await tx.warehouseUserLink.deleteMany({ where: { warehouse_id: warehouseId } });
      if (patch.links.length > 0) {
        await tx.warehouseUserLink.createMany({
          data: patch.links.map((l) => ({
            warehouse_id: warehouseId,
            user_id: l.user_id,
            link_role: l.link_role
          }))
        });
      }
    }
  });

  const updated = await getWarehouseDetail(tenantId, warehouseId);
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.warehouse,
    entityId: warehouseId,
    action: "update",
    payload: { ...data, links_updated: patch.links !== undefined }
  });
  return updated!;
}

export async function deleteWarehouseRow(
  tenantId: number,
  warehouseId: number,
  actorUserId: number | null = null
): Promise<void> {
  const row = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenant_id: tenantId }
  });
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  const stockN = await prisma.stock.count({
    where: { tenant_id: tenantId, warehouse_id: warehouseId }
  });
  if (stockN > 0) {
    throw new Error("HAS_STOCK");
  }
  const orderN = await prisma.order.count({
    where: { tenant_id: tenantId, warehouse_id: warehouseId }
  });
  if (orderN > 0) {
    throw new Error("HAS_ORDERS");
  }
  await prisma.warehouse.delete({ where: { id: warehouseId } });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.warehouse,
    entityId: warehouseId,
    action: "delete",
    payload: { name: row.name }
  });
}
