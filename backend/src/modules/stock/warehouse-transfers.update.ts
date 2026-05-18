import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { UpdateTransferInput } from "./warehouse-transfers.types";
import {
  assertSourceStockForLines,
  assertTransferExists,
  assertWarehouseForTenant,
  validateWarehouseDisjoint
} from "./warehouse-transfers.shared";

export async function updateTransfer(
  tenantId: number,
  id: number,
  input: UpdateTransferInput,
  actorUserId: number | null = null
): Promise<{ id: number; number: string }> {
  const existing = await assertTransferExists(tenantId, id);
  if (existing.status !== "draft") throw new Error("NOT_DRAFT");

  // Validate warehouses if changing
  const srcWh = input.source_warehouse_id ?? Number(existing.source_warehouse_id);
  const dstWh = input.destination_warehouse_id ?? Number(existing.destination_warehouse_id);
  if (input.source_warehouse_id != null) {
    await assertWarehouseForTenant(tenantId, input.source_warehouse_id);
  }
  if (input.destination_warehouse_id != null) {
    await assertWarehouseForTenant(tenantId, input.destination_warehouse_id);
  }
  validateWarehouseDisjoint({
    source_warehouse_id: srcWh,
    destination_warehouse_id: dstWh,
  });

  if (input.lines != null) {
    await assertSourceStockForLines(
      tenantId,
      srcWh,
      input.lines.map((l) => ({ product_id: l.product_id, qty: l.qty }))
    );
  }

  await prisma.$transaction(async () => {
    // Update header fields (each one is safe because Prisma.Sql handles parameterization)
    if (input.source_warehouse_id != null) {
      await prisma.$executeRaw`
        UPDATE warehouse_transfers
        SET source_warehouse_id = ${input.source_warehouse_id}
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;
    }
    if (input.destination_warehouse_id != null) {
      await prisma.$executeRaw`
        UPDATE warehouse_transfers
        SET destination_warehouse_id = ${input.destination_warehouse_id}
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;
    }
    if (input.comment !== undefined) {
      await prisma.$executeRaw`
        UPDATE warehouse_transfers
        SET comment = ${input.comment?.trim() ?? null}
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;
    }
    if (input.planned_date !== undefined) {
      await prisma.$executeRaw`
        UPDATE warehouse_transfers
        SET planned_date = ${input.planned_date ? new Date(input.planned_date) : null}
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;
    }

    // Replace lines if provided
    if (input.lines != null) {
      if (input.lines.some((l) => l.qty == null || l.qty <= 0)) throw new Error("BAD_QTY");

      await prisma.$executeRaw`
        DELETE FROM warehouse_transfer_lines WHERE transfer_id = ${id}
      `;

      if (input.lines.length > 0) {
        const lineValues: Prisma.Sql[] = input.lines.map((l, i) =>
          Prisma.sql`(
            ${id}, ${l.product_id}, ${new Prisma.Decimal(l.qty)},
            ${l.batch_no?.trim() ?? null}, ${l.comment?.trim() ?? null}, ${i}
          )`
        );

        await prisma.$executeRaw`
          INSERT INTO warehouse_transfer_lines (
            transfer_id, product_id, qty, batch_no, comment, sort_order
          ) VALUES ${Prisma.join(lineValues)}
        `;
      }
    }
  });

  // Re-fetch to return the number
  const updated = await prisma.$queryRaw<{ id: number; number: string }[]>(
    Prisma.sql`SELECT id, number FROM warehouse_transfers WHERE id = ${id} AND tenant_id = ${tenantId}`
  );
  const rec = updated[0]!;

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: id,
    action: "transfer_update",
    payload: { number: rec.number },
  });

  return { id: rec.id, number: rec.number };
}
