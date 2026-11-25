import { prisma } from "../../../config/database";
import { locksForOrders } from "./share.service";
import { assertOrderShareActionAllowed } from "./share-lock.pure";

/** Status/pay/return mutations — faol da faqat receiver. */
export async function assertShareMutationAllowed(
  tenantId: number,
  actorUserId: number,
  orderId: number
): Promise<void> {
  const locks = await locksForOrders(tenantId, [orderId]);
  assertOrderShareActionAllowed({
    orderId,
    actorUserId,
    locks
  });
}

const orderSelect = {
  id: true,
  client_id: true,
  agent_id: true,
  status: true,
  order_type: true,
  comment: true,
  total_sum: true,
  is_consignment: true
} as const;

/** Faol share receiver uchun owns-check o‘rniga order yuklash. */
export async function loadOrderAfterShareGuard(
  tenantId: number,
  actorUserId: number,
  orderId: number,
  assertOwns: (
    tenantId: number,
    userId: number,
    orderId: number
  ) => Promise<{
    id: number;
    client_id: number;
    agent_id: number | null;
    status: string;
    order_type: string;
    comment: string | null;
    total_sum: unknown;
    is_consignment: boolean;
  }>
) {
  const locks = await locksForOrders(tenantId, [orderId]);
  assertOrderShareActionAllowed({
    orderId,
    actorUserId,
    locks
  });
  const active = locks.find(
    (l) => l.orderId === orderId && l.locked && l.status === "faol"
  );
  if (active && active.receiverUserId === actorUserId) {
    const row = await prisma.order.findFirst({
      where: { id: orderId, tenant_id: tenantId },
      select: orderSelect
    });
    if (!row) throw new Error("NOT_FOUND");
    return row;
  }
  return assertOwns(tenantId, actorUserId, orderId);
}
