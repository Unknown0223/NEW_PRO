import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ReceiveAdjustment } from "./warehouse-transfers.types";
import {
  assertSourceStockForLines,
  assertTransferExists
} from "./warehouse-transfers.shared";

export async function startTransfer(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<void> {
  const existing = await assertTransferExists(tenantId, id);
  if (existing.status !== "draft") throw new Error("NOT_DRAFT");

  const sourceWarehouseId = Number(existing.source_warehouse_id);

  const lines = await prisma.$queryRaw<
    { id: number; product_id: number; qty: Prisma.Decimal; batch_no: string | null }[]
  >`
    SELECT id, product_id, qty, batch_no
    FROM warehouse_transfer_lines
    WHERE transfer_id = ${id}
    ORDER BY sort_order
  `;

  if (!lines.length) throw new Error("EMPTY_LINES");

  await assertSourceStockForLines(
    tenantId,
    sourceWarehouseId,
    lines.map((l) => ({ product_id: l.product_id, qty: l.qty }))
  );

  const productIds = [...new Set(lines.map((l) => l.product_id))];
  const products = await prisma.$queryRaw<
    { id: number; sku: string }[]
  >`SELECT id, sku FROM products WHERE id IN (${Prisma.join(
    productIds.map((pid) => Prisma.sql`${pid}`)
  )}) AND tenant_id = ${tenantId}`;

  const startedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE warehouse_transfers
      SET status = 'in_transit', started_at = ${startedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'draft'
    `;

    for (const line of lines) {
      const delta = new Prisma.Decimal(line.qty);

      const stock = await tx.$queryRaw<
        { id: number; qty: Prisma.Decimal; reserved_qty: Prisma.Decimal }[]
      >`
        SELECT id, qty, reserved_qty FROM stock
        WHERE tenant_id = ${tenantId}
          AND warehouse_id = ${sourceWarehouseId}
          AND product_id = ${line.product_id}
        FOR UPDATE
      `;

      const entry = stock[0];
      if (!entry) throw new Error("STOCK_NOT_FOUND");

      const afterQty = entry.qty.minus(delta);
      if (afterQty.lt(0)) {
        const productInfo = products.find((p) => p.id === line.product_id);
        throw new Error(`INSUFFICIENT_STOCK:${productInfo?.sku ?? line.product_id}`);
      }

      await tx.$executeRaw`
        UPDATE stock
        SET qty = ${afterQty}, updated_at = now()
        WHERE id = ${entry.id}
          AND tenant_id = ${tenantId}
      `;
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: id,
    action: "transfer_start",
    payload: { line_count: lines.length },
  });

  void invalidateStock(tenantId, sourceWarehouseId);
}

// ---------------------------------------------------------------------------
// 6. receiveTransfer  (in_transit -> received, adds destination stock)
// ---------------------------------------------------------------------------


export async function receiveTransfer(
  tenantId: number,
  id: number,
  receivedByUserId: number | null,
  adjustments?: ReceiveAdjustment[] | null
): Promise<void> {
  const existing = await assertTransferExists(tenantId, id);
  if (existing.status !== "in_transit") throw new Error("NOT_IN_TRANSIT");

  const destWarehouseId = Number(existing.destination_warehouse_id);

  const lines = await prisma.$queryRaw<
    { product_id: number; qty: Prisma.Decimal; batch_no: string | null }[]
  >`
    SELECT product_id, qty, batch_no
    FROM warehouse_transfer_lines
    WHERE transfer_id = ${id}
    ORDER BY sort_order
  `;

  if (!lines.length) throw new Error("EMPTY_LINES");

  // Build effective received quantities
  const adjMap = new Map<number, number>();
  if (adjustments?.length) {
    for (const a of adjustments) {
      adjMap.set(a.product_id, a.received_qty ?? 0);
    }
  }

  const receivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const receivedQty = adjMap.has(line.product_id)
        ? new Prisma.Decimal(adjMap.get(line.product_id) ?? 0)
        : new Prisma.Decimal(line.qty);

      if (receivedQty.lte(0)) continue;

      const stock = await tx.$queryRaw<{ id: number; qty: Prisma.Decimal }[]>`
        SELECT id, qty FROM stock
        WHERE tenant_id = ${tenantId}
          AND warehouse_id = ${destWarehouseId}
          AND product_id = ${line.product_id}
        FOR UPDATE
      `;

      if (stock.length > 0) {
        const newQty = stock[0].qty.plus(receivedQty);
        await tx.$executeRaw`
          UPDATE stock
          SET qty = ${newQty}, updated_at = now()
          WHERE id = ${stock[0].id}
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO stock (tenant_id, warehouse_id, product_id, qty, created_at, updated_at)
          VALUES (${tenantId}, ${destWarehouseId}, ${line.product_id}, ${receivedQty}, now(), now())
        `;
      }

      await tx.$executeRaw`
        UPDATE warehouse_transfer_lines
        SET received_qty = ${receivedQty}
        WHERE transfer_id = ${id} AND product_id = ${line.product_id}
      `;
    }

    await tx.$executeRaw`
      UPDATE warehouse_transfers
      SET status = 'received',
          received_at = ${receivedAt},
          received_by_user_id = ${receivedByUserId ?? null}
      WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'in_transit'
    `;
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: receivedByUserId,
    entityType: AuditEntityType.stock,
    entityId: id,
    action: "transfer_receive",
    payload: { adjustments_count: adjustments?.length ?? 0 },
  });

  void invalidateStock(tenantId, destWarehouseId);
}

// ---------------------------------------------------------------------------
// 7. cancelTransfer  (draft or in_transit -> cancelled)
// ---------------------------------------------------------------------------

export async function cancelTransfer(
  tenantId: number,
  id: number,
  actorUserId: number | null = null
): Promise<void> {
  const existing = await assertTransferExists(tenantId, id);
  const currentStatus = existing.status as string;

  if (currentStatus !== "draft" && currentStatus !== "in_transit") {
    throw new Error("NOT_CANCELLABLE");
  }

  // If in_transit, restore stock to source warehouse
  if (currentStatus === "in_transit") {
    const sourceWarehouseId = Number(existing.source_warehouse_id);

    const lines = await prisma.$queryRaw<
      { product_id: number; qty: Prisma.Decimal }[]
    >`
      SELECT product_id, COALESCE(received_qty, qty) as qty
      FROM warehouse_transfer_lines
      WHERE transfer_id = ${id}
    `;

    if (lines.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const line of lines) {
          const stock = await tx.$queryRaw<{ id: number; qty: Prisma.Decimal }[]>`
            SELECT id, qty FROM stock
            WHERE tenant_id = ${tenantId}
              AND warehouse_id = ${sourceWarehouseId}
              AND product_id = ${line.product_id}
            FOR UPDATE
          `;

          if (stock.length > 0) {
            const newQty = stock[0].qty.plus(line.qty);
            await tx.$executeRaw`
              UPDATE stock
              SET qty = ${newQty}, updated_at = now()
              WHERE id = ${stock[0].id}
            `;
          } else {
            await tx.$executeRaw`
              INSERT INTO stock (tenant_id, warehouse_id, product_id, qty, created_at, updated_at)
              VALUES (${tenantId}, ${sourceWarehouseId}, ${line.product_id}, ${line.qty}, now(), now())
            `;
          }
        }

        await tx.$executeRaw`
          UPDATE warehouse_transfers
          SET status = 'cancelled'
          WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'in_transit'
        `;
      });
    }
  } else {
    // Draft: just update status
    await prisma.$executeRaw`
      UPDATE warehouse_transfers
      SET status = 'cancelled'
      WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'draft'
    `;
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: id,
    action: "transfer_cancel",
    payload: { previous_status: currentStatus },
  });

  if (currentStatus === "in_transit") {
    void invalidateStock(tenantId, Number(existing.source_warehouse_id));
  }
}
