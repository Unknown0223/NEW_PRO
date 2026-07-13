import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

function serializeTake(row: {
  id: number;
  status: string;
  title: string | null;
  notes: string | null;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  warehouse: { id: number; name: string };
  created_by: { id: number; name: string; login: string } | null;
  lines: {
    id: number;
    system_qty: Prisma.Decimal;
    counted_qty: Prisma.Decimal | null;
    previous_qty: Prisma.Decimal | null;
    product: { id: number; sku: string; name: string };
  }[];
}) {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    notes: row.notes,
    posted_at: row.posted_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    warehouse: row.warehouse,
    created_by: row.created_by,
    lines: row.lines.map((l) => ({
      id: l.id,
      system_qty: String(l.system_qty),
      counted_qty: l.counted_qty != null ? String(l.counted_qty) : null,
      previous_qty: l.previous_qty != null ? String(l.previous_qty) : null,
      product: l.product
    }))
  };
}

export async function listStockTakes(
  tenantId: number,
  opts: { warehouse_id?: number; status?: string; page: number; limit: number }
) {
  const where: Prisma.StockTakeWhereInput = { tenant_id: tenantId };
  if (opts.warehouse_id) where.warehouse_id = opts.warehouse_id;
  if (opts.status) where.status = opts.status;
  const skip = (opts.page - 1) * opts.limit;
  const [total, rows] = await Promise.all([
    prisma.stockTake.count({ where }),
    prisma.stockTake.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: opts.limit,
      include: {
        warehouse: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true, login: true } },
        lines: {
          include: { product: { select: { id: true, sku: true, name: true } } }
        }
      }
    })
  ]);
  return {
    data: rows.map(serializeTake),
    total,
    page: opts.page,
    limit: opts.limit
  };
}

export async function getStockTake(tenantId: number, id: number) {
  const row = await prisma.stockTake.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      warehouse: { select: { id: true, name: true } },
      created_by: { select: { id: true, name: true, login: true } },
      lines: {
        include: { product: { select: { id: true, sku: true, name: true } } },
        orderBy: { id: "asc" }
      }
    }
  });
  return row ? serializeTake(row) : null;
}

export async function createStockTake(
  tenantId: number,
  userId: number | undefined,
  body: { warehouse_id: number; title?: string | null; notes?: string | null }
) {
  const wh = await prisma.warehouse.findFirst({
    where: { id: body.warehouse_id, tenant_id: tenantId },
    select: { id: true }
  });
  if (!wh) throw new Error("WarehouseNotFound");
  const row = await prisma.stockTake.create({
    data: {
      tenant_id: tenantId,
      warehouse_id: body.warehouse_id,
      title: body.title?.trim() || null,
      notes: body.notes?.trim() || null,
      created_by_user_id: userId
    },
    include: {
      warehouse: { select: { id: true, name: true } },
      created_by: { select: { id: true, name: true, login: true } },
      lines: {
        include: { product: { select: { id: true, sku: true, name: true } } }
      }
    }
  });
  return serializeTake(row);
}

export async function setStockTakeLines(
  tenantId: number,
  id: number,
  lines: { product_id: number; counted_qty: number | null }[]
) {
  const take = await prisma.stockTake.findFirst({
    where: { id, tenant_id: tenantId },
    select: { id: true, status: true, warehouse_id: true }
  });
  if (!take) return null;
  if (take.status !== "draft") throw new Error("NotDraft");

  const byPid = new Map<number, { product_id: number; counted_qty: number | null }>();
  for (const l of lines) byPid.set(l.product_id, l);
  const uniqLines = [...byPid.values()];
  const productIds = [...byPid.keys()];
  if (!productIds.length) {
    await prisma.stockTakeLine.deleteMany({ where: { stock_take_id: id } });
    return getStockTake(tenantId, id);
  }
  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: productIds } },
    select: { id: true }
  });
  if (products.length !== productIds.length) throw new Error("ProductNotFound");

  const stockRows = await prisma.stock.findMany({
    where: { tenant_id: tenantId, warehouse_id: take.warehouse_id, product_id: { in: productIds } },
    select: { product_id: true, qty: true }
  });
  const qtyByProduct = new Map(stockRows.map((s) => [s.product_id, s.qty]));

  await prisma.$transaction(async (tx) => {
    await tx.stockTakeLine.deleteMany({ where: { stock_take_id: id } });
    await tx.stockTakeLine.createMany({
      data: uniqLines.map((l) => ({
        stock_take_id: id,
        product_id: l.product_id,
        system_qty: qtyByProduct.get(l.product_id) ?? new Prisma.Decimal(0),
        counted_qty:
          l.counted_qty != null && Number.isFinite(l.counted_qty)
            ? new Prisma.Decimal(l.counted_qty)
            : null
      }))
    });
  });
  return getStockTake(tenantId, id);
}

export async function postStockTake(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const take = await prisma.stockTake.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      lines: true,
      warehouse: { select: { id: true } }
    }
  });
  if (!take) return null;
  if (take.status !== "draft") throw new Error("NotDraft");
  if (!take.lines.length) throw new Error("NoLines");
  for (const l of take.lines) {
    if (l.counted_qty == null) throw new Error("IncompleteLines");
  }

  const snapshotLines: {
    product_id: number;
    previous_qty: string;
    counted_qty: string;
  }[] = [];

  await withTransaction(async (tx) => {
    for (const l of take.lines) {
      const counted = l.counted_qty!;
      const existing = await tx.stock.findUnique({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: take.warehouse_id,
            product_id: l.product_id
          }
        },
        select: { qty: true }
      });
      const previousQty = existing?.qty ?? new Prisma.Decimal(0);
      await tx.stockTakeLine.update({
        where: { id: l.id },
        data: { previous_qty: previousQty }
      });
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: take.warehouse_id,
            product_id: l.product_id
          }
        },
        create: {
          tenant_id: tenantId,
          warehouse_id: take.warehouse_id,
          product_id: l.product_id,
          qty: counted
        },
        update: { qty: counted }
      });
      snapshotLines.push({
        product_id: l.product_id,
        previous_qty: previousQty.toString(),
        counted_qty: counted.toString()
      });
    }
    await tx.stockTake.update({
      where: { id },
      data: { status: "posted", posted_at: new Date() }
    });
  });
  void invalidateStock(tenantId, take.warehouse_id);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "stock_take",
    entityId: id,
    action: "stock_take.post",
    payload: {
      id,
      warehouse_id: take.warehouse_id,
      stock_snapshot: snapshotLines
    }
  });

  return getStockTake(tenantId, id);
}

export async function cancelStockTake(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
) {
  const take = await prisma.stockTake.findFirst({
    where: { id, tenant_id: tenantId },
    include: { lines: true }
  });
  if (!take) return null;
  if (take.status === "cancelled") throw new Error("AlreadyCancelled");
  if (take.status !== "draft" && take.status !== "posted") {
    throw new Error("NotCancellable");
  }

  if (take.status === "draft") {
    await prisma.stockTake.update({
      where: { id },
      data: { status: "cancelled" }
    });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: "stock_take",
      entityId: id,
      action: "stock_take.cancel",
      payload: { id, draft: true }
    });
    return getStockTake(tenantId, id);
  }

  // Posted: restore stock to previous_qty snapshot
  for (const l of take.lines) {
    if (l.previous_qty == null) {
      throw new Error("CANNOT_CANCEL_POSTED_NO_SNAPSHOT");
    }
  }

  const restored: { product_id: number; previous_qty: string; counted_qty: string | null }[] = [];

  await withTransaction(async (tx) => {
    for (const l of take.lines) {
      const restoreQty = l.previous_qty!;
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: take.warehouse_id,
            product_id: l.product_id
          }
        },
        create: {
          tenant_id: tenantId,
          warehouse_id: take.warehouse_id,
          product_id: l.product_id,
          qty: restoreQty
        },
        update: { qty: restoreQty }
      });
      restored.push({
        product_id: l.product_id,
        previous_qty: restoreQty.toString(),
        counted_qty: l.counted_qty != null ? l.counted_qty.toString() : null
      });
    }
    await tx.stockTake.update({
      where: { id },
      data: { status: "cancelled" }
    });
  });
  void invalidateStock(tenantId, take.warehouse_id);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "stock_take",
    entityId: id,
    action: "stock_take.cancel",
    payload: {
      id,
      posted: true,
      warehouse_id: take.warehouse_id,
      stock_restored: restored
    }
  });

  return getStockTake(tenantId, id);
}
