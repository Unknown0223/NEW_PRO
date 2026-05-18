import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidateStock } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateTransferInput } from "./warehouse-transfers.types";
import {
  assertSourceStockForLines,
  assertWarehouseForTenant,
  generateTransferNumber,
  validateWarehouseDisjoint
} from "./warehouse-transfers.shared";

export async function createTransfer(
  tenantId: number,
  input: CreateTransferInput,
  actorUserId: number | null = null
): Promise<{ id: number; number: string }> {
  if (!input.lines.length) throw new Error("EMPTY_LINES");
  if (input.lines.some((l) => l.qty == null || l.qty <= 0)) throw new Error("BAD_QTY");

  const src = await assertWarehouseForTenant(tenantId, input.source_warehouse_id);
  const dst = await assertWarehouseForTenant(tenantId, input.destination_warehouse_id);
  validateWarehouseDisjoint({
    source_warehouse_id: input.source_warehouse_id,
    destination_warehouse_id: input.destination_warehouse_id,
  });

  await assertSourceStockForLines(tenantId, input.source_warehouse_id, input.lines);

  const tmp = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const result = await prisma.$queryRaw<
    { id: number }[]
  >`
    INSERT INTO warehouse_transfers (
      tenant_id, number, source_warehouse_id, destination_warehouse_id,
      status, comment, planned_date, created_by_user_id
    ) VALUES (
      ${tenantId}, ${tmp},
      ${input.source_warehouse_id}, ${input.destination_warehouse_id},
      'draft',
      ${input.comment?.trim() ?? null},
      ${input.planned_date ? new Date(input.planned_date) : null},
      ${actorUserId ?? null}
    )
    RETURNING id
  `;

  const rec = result[0];
  if (!rec) throw new Error("CREATE_FAILED");
  const number = generateTransferNumber(rec.id);

  await prisma.$executeRaw`
    UPDATE warehouse_transfers
    SET number = ${number}
    WHERE id = ${rec.id}
  `;

  const lineInserts: Prisma.Sql[] = input.lines.map((l, i) =>
    Prisma.sql`(
      ${rec.id}, ${l.product_id}, ${new Prisma.Decimal(l.qty)},
      ${l.batch_no?.trim() ?? null}, ${l.comment?.trim() ?? null}, ${i}
    )`
  );

  await prisma.$executeRaw`
    INSERT INTO warehouse_transfer_lines (
      transfer_id, product_id, qty, batch_no, comment, sort_order
    ) VALUES ${Prisma.join(lineInserts)}
  `;

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.stock,
    entityId: rec.id,
    action: "transfer_create",
    payload: { number, line_count: input.lines.length },
  });

  return { id: rec.id, number };
}

// ---------------------------------------------------------------------------
// 2. getTransfers
// ---------------------------------------------------------------------------
