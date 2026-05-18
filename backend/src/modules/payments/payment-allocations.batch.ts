import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { PaymentAllocationRow } from "./payment-allocations.types";
import { assertTenantAccess } from "./payment-allocations.helpers";
import { allocatePayment } from "./payment-allocations.allocate";

export async function allocateMultiple(
  tenantId: number,
  paymentIds: number[],
  actorUserId: number | null
): Promise<{ payment_id: number; allocations: PaymentAllocationRow[] }[]> {
  await assertTenantAccess(tenantId);

  const results: { payment_id: number; allocations: PaymentAllocationRow[] }[] = [];

  for (const pid of paymentIds) {
    try {
      const allocations = await allocatePayment(tenantId, pid, actorUserId);
      results.push({ payment_id: pid, allocations });
    } catch (err) {
      results.push({
        payment_id: pid,
        allocations: [],
      } as unknown as { payment_id: number; allocations: PaymentAllocationRow[] });
      // Continue with next payment instead of aborting all
      console.error(`[allocation] Failed for payment ${pid}:`, err);
    }
  }

  return results;
}
