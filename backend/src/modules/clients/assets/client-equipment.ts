/**
 * Domain: Clients — equipment management
 */
import { prisma } from "../../../config/database";

async function assertClient(tenantId: number, clientId: number): Promise<void> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true }
  });
  if (!c) throw new Error("CLIENT_NOT_FOUND");
}

export type ClientEquipmentRow = {
  id: number;
  client_id: number;
  equipment_id: number;
  equipment_name: string;
  serial_number: string | null;
  installed_at: string;
  removed_at: string | null;
};

export type TenantEquipmentRow = {
  id: number;
  equipment_name: string;
  equipment_code: string | null;
  serial_number: string | null;
  client_name: string;
  client_id: number;
  installed_at: string;
  removed_at: string | null;
  is_active: boolean;
};

export async function listClientEquipmentSplit(
  tenantId: number,
  clientId: number
): Promise<ClientEquipmentRow[]> {
  await assertClient(tenantId, clientId);

  const rows = await prisma.clientEquipment.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId
    },
    orderBy: { installed_at: "desc" },
    select: {
      id: true,
      client_id: true,
      equipment_id: true,
      equipment: { select: { name: true } },
      serial_number: true,
      installed_at: true,
      removed_at: true
    }
  });

  return rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    equipment_id: r.equipment_id,
    equipment_name: r.equipment.name,
    serial_number: r.serial_number,
    installed_at: r.installed_at.toISOString(),
    removed_at: r.removed_at?.toISOString() ?? null
  }));
}

export async function createClientEquipmentRow(
  tenantId: number,
  clientId: number,
  equipmentId: number,
  serialNumber: string | null,
  installedAt: Date,
  actorUserId: number | null
): Promise<number> {
  await assertClient(tenantId, clientId);

  const row = await prisma.clientEquipment.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      equipment_id: equipmentId,
      serial_number: serialNumber,
      installed_at: installedAt,
      installed_by_user_id: actorUserId
    }
  });

  return row.id;
}

export async function markClientEquipmentRemoved(
  tenantId: number,
  clientId: number,
  equipmentId: number
): Promise<void> {
  await assertClient(tenantId, clientId);

  const existing = await prisma.clientEquipment.findFirst({
    where: { id: equipmentId, tenant_id: tenantId, client_id: clientId, removed_at: null }
  });

  if (!existing) {
    throw new Error("NOT_FOUND_OR_ALREADY_REMOVED");
  }

  await prisma.clientEquipment.update({
    where: { id: equipmentId },
    data: { removed_at: new Date() }
  });
}