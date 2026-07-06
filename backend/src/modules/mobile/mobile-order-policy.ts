import { prisma } from "../../config/database";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";

function todayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function validateShipmentDateRequired(
  cfg: AgentMobileConfigV1,
  shipmentDate?: string | null
): void {
  if (!cfg.misc?.require_shipment_date) return;
  const raw = shipmentDate?.trim() ?? "";
  if (!raw) throw new Error("SHIPMENT_DATE_REQUIRED");
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error("SHIPMENT_DATE_INVALID");
}

export async function assertStockSnapshotToday(
  tenantId: number,
  userId: number,
  cfg: AgentMobileConfigV1
): Promise<void> {
  if (!cfg.misc?.require_stock_snapshot_for_order) return;
  const { start, end } = todayRange();
  const hit = await prisma.userActivityEvent.findFirst({
    where: {
      tenant_id: tenantId,
      actor_user_id: userId,
      module: "mobile",
      section: "stock_snapshot",
      created_at: { gte: start, lte: end }
    },
    select: { id: true }
  });
  if (!hit) throw new Error("STOCK_SNAPSHOT_REQUIRED");
}

export async function recordMobileStockSnapshot(tenantId: number, userId: number): Promise<void> {
  await prisma.userActivityEvent.create({
    data: {
      tenant_id: tenantId,
      actor_user_id: userId,
      event_type: "mobile_action",
      module: "mobile",
      section: "stock_snapshot",
      label: "warehouse_stock_view"
    }
  });
}
