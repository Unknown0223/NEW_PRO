/**
 * Domain: Clients — equipment listing for tenant
 */
import { prisma } from "../../../config/database";
import type { TenantEquipmentRow } from "./client-equipment";

export async function listTenantEquipmentPaged(
  tenantId: number,
  page: number,
  limit: number
): Promise<{ data: TenantEquipmentRow[]; total: number }> {
  const [total, rows] = await Promise.all([
    prisma.clientEquipment.count({ where: { tenant_id: tenantId } }),
    prisma.clientEquipment.findMany({
      where: { tenant_id: tenantId },
      orderBy: { installed_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        equipment: { select: { name: true, code: true } },
        serial_number: true,
        client: { select: { name: true, id: true } },
        installed_at: true,
        removed_at: true
      }
    })
  ]);

  const data: TenantEquipmentRow[] = rows.map((r) => ({
    id: r.id,
    equipment_name: r.equipment.name,
    equipment_code: r.equipment.code,
    serial_number: r.serial_number,
    client_name: r.client.name,
    client_id: r.client.id,
    installed_at: r.installed_at.toISOString(),
    removed_at: r.removed_at?.toISOString() ?? null,
    is_active: r.removed_at === null
  }));

  return { data, total };
}