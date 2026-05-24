import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

async function assertClient(tenantId: number, clientId: number): Promise<void> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!c) throw new Error("NOT_FOUND");
}

export type ClientEquipmentApi = {
  id: number;
  inventory_type: string;
  equipment_kind: string | null;
  serial_number: string | null;
  inventory_number: string | null;
  assigned_at: string;
  removed_at: string | null;
  note: string | null;
};

export async function listClientEquipmentSplit(
  tenantId: number,
  clientId: number
): Promise<{ active: ClientEquipmentApi[]; removed: ClientEquipmentApi[] }> {
  await assertClient(tenantId, clientId);
  const rows = await prisma.clientEquipment.findMany({
    where: { tenant_id: tenantId, client_id: clientId },
    orderBy: [{ removed_at: "asc" }, { assigned_at: "desc" }]
  });
  const mapRow = (r: (typeof rows)[0]): ClientEquipmentApi => ({
    id: r.id,
    inventory_type: r.inventory_type,
    equipment_kind: r.equipment_kind,
    serial_number: r.serial_number,
    inventory_number: r.inventory_number,
    assigned_at: r.assigned_at.toISOString(),
    removed_at: r.removed_at?.toISOString() ?? null,
    note: r.note
  });
  return {
    active: rows.filter((r) => r.removed_at == null).map(mapRow),
    removed: rows.filter((r) => r.removed_at != null).map(mapRow)
  };
}

export async function createClientEquipmentRow(
  tenantId: number,
  clientId: number,
  input: {
    inventory_type: string;
    equipment_kind?: string | null;
    serial_number?: string | null;
    inventory_number?: string | null;
    note?: string | null;
  }
): Promise<ClientEquipmentApi> {
  await assertClient(tenantId, clientId);
  const t = input.inventory_type.trim();
  if (!t) throw new Error("VALIDATION");
  const row = await prisma.clientEquipment.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      inventory_type: t.slice(0, 256),
      equipment_kind: input.equipment_kind?.trim() ? input.equipment_kind.trim().slice(0, 256) : null,
      serial_number: input.serial_number?.trim() ? input.serial_number.trim().slice(0, 128) : null,
      inventory_number: input.inventory_number?.trim() ? input.inventory_number.trim().slice(0, 128) : null,
      note: input.note?.trim() ? input.note.trim().slice(0, 2000) : null
    }
  });
  return {
    id: row.id,
    inventory_type: row.inventory_type,
    equipment_kind: row.equipment_kind,
    serial_number: row.serial_number,
    inventory_number: row.inventory_number,
    assigned_at: row.assigned_at.toISOString(),
    removed_at: null,
    note: row.note
  };
}

export async function markClientEquipmentRemoved(tenantId: number, clientId: number, equipmentId: number): Promise<void> {
  await assertClient(tenantId, clientId);
  const r = await prisma.clientEquipment.findFirst({
    where: { id: equipmentId, tenant_id: tenantId, client_id: clientId }
  });
  if (!r) throw new Error("NOT_FOUND");
  await prisma.clientEquipment.update({
    where: { id: equipmentId },
    data: { removed_at: new Date() }
  });
}

export type ListEquipmentQuery = {
  page: number;
  limit: number;
  date_from?: string;
  date_to?: string;
  agent_id?: number;
  inventory_type?: string;
  territory_1?: string;
  territory_2?: string;
  territory_3?: string;
  status?: "all" | "active" | "removed";
  search?: string;
};

export type EquipmentListRow = {
  id: number;
  inventory_type: string;
  equipment_kind: string | null;
  serial_number: string | null;
  inventory_number: string | null;
  assigned_at: string;
  removed_at: string | null;
  note: string | null;
  client_id: number;
  client_name: string;
  client_phone: string | null;
  client_address: string | null;
  region: string | null;
  district: string | null;
  zone: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  agent_id: number | null;
  agent_name: string | null;
};

function parseYmdStart(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export async function listTenantEquipmentPaged(
  tenantId: number,
  q: ListEquipmentQuery
): Promise<{ data: EquipmentListRow[]; total: number; page: number; limit: number }> {
  const page = Number.isFinite(q.page) && q.page > 0 ? Math.floor(q.page) : 1;
  const limit = Number.isFinite(q.limit) ? Math.max(1, Math.min(200, Math.floor(q.limit))) : 50;
  const skip = (page - 1) * limit;
  const status = q.status ?? "active";
  const dateFrom = q.date_from ? parseYmdStart(q.date_from) : null;
  const dateToStart = q.date_to ? parseYmdStart(q.date_to) : null;
  const dateTo = dateToStart
    ? new Date(
        dateToStart.getFullYear(),
        dateToStart.getMonth(),
        dateToStart.getDate(),
        23,
        59,
        59,
        999
      )
    : null;
  const term = q.search?.trim() ?? "";

  const andWhere: Prisma.ClientEquipmentWhereInput[] = [];

  if (status === "active") andWhere.push({ removed_at: null });
  else if (status === "removed") andWhere.push({ removed_at: { not: null } });

  if (dateFrom || dateTo) {
    andWhere.push({
      assigned_at: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {})
      }
    });
  }

  if (q.inventory_type?.trim()) {
    const inv = q.inventory_type.trim();
    andWhere.push({
      OR: [
        { inventory_type: { contains: inv, mode: "insensitive" } },
        { equipment_kind: { contains: inv, mode: "insensitive" } }
      ]
    });
  }

  if (term) {
    andWhere.push({
      OR: [
        { inventory_type: { contains: term, mode: "insensitive" } },
        { equipment_kind: { contains: term, mode: "insensitive" } },
        { serial_number: { contains: term, mode: "insensitive" } },
        { inventory_number: { contains: term, mode: "insensitive" } },
        { note: { contains: term, mode: "insensitive" } },
        {
          client: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { phone: { contains: term, mode: "insensitive" } },
              { address: { contains: term, mode: "insensitive" } }
            ]
          }
        }
      ]
    });
  }

  const clientWhere: Record<string, unknown> = {
    ...(q.agent_id ? { agent_id: q.agent_id } : {}),
    ...(q.territory_1?.trim() ? { region: q.territory_1.trim() } : {}),
    ...(q.territory_2?.trim() ? { zone: q.territory_2.trim() } : {}),
    ...(q.territory_3?.trim() ? { city: q.territory_3.trim() } : {})
  };
  if (Object.keys(clientWhere).length > 0) {
    andWhere.push({ client: clientWhere });
  }

  const rowsWhere: Prisma.ClientEquipmentWhereInput = {
    tenant_id: tenantId,
    ...(andWhere.length > 0 ? { AND: andWhere } : {})
  };

  const [rows, total] = await Promise.all([
    prisma.clientEquipment.findMany({
      where: rowsWhere,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            region: true,
            district: true,
            zone: true,
            city: true,
            latitude: true,
            longitude: true,
            agent_id: true,
            agent: { select: { name: true } }
          }
        }
      },
      orderBy: [{ assigned_at: "desc" }, { id: "desc" }],
      skip,
      take: limit
    }),
    prisma.clientEquipment.count({ where: rowsWhere })
  ]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      inventory_type: r.inventory_type,
      equipment_kind: r.equipment_kind,
      serial_number: r.serial_number,
      inventory_number: r.inventory_number,
      assigned_at: r.assigned_at.toISOString(),
      removed_at: r.removed_at?.toISOString() ?? null,
      note: r.note,
      client_id: r.client_id,
      client_name: r.client.name,
      client_phone: r.client.phone,
      client_address: r.client.address,
      region: r.client.region,
      district: r.client.district,
      zone: r.client.zone,
      city: r.client.city,
      latitude: r.client.latitude ? String(r.client.latitude) : null,
      longitude: r.client.longitude ? String(r.client.longitude) : null,
      agent_id: r.client.agent_id,
      agent_name: r.client.agent?.name ?? null
    })),
    total,
    page,
    limit
  };
}

export type ClientPhotoReportApi = {
  id: number;
  image_url: string;
  caption: string | null;
  order_id: number | null;
  created_at: string;
};

export async function listClientPhotoReports(
  tenantId: number,
  clientId: number
): Promise<ClientPhotoReportApi[]> {
  await assertClient(tenantId, clientId);
  const rows = await prisma.clientPhotoReport.findMany({
    where: { tenant_id: tenantId, client_id: clientId },
    orderBy: { created_at: "desc" },
    take: 200
  });
  return rows.map((r) => ({
    id: r.id,
    image_url: r.image_url,
    caption: r.caption,
    order_id: r.order_id,
    created_at: r.created_at.toISOString()
  }));
}

export async function createClientPhotoReportRow(
  tenantId: number,
  clientId: number,
  userId: number | null,
  input: { image_url: string; caption?: string | null; order_id?: number | null }
): Promise<ClientPhotoReportApi> {
  await assertClient(tenantId, clientId);
  const url = input.image_url.trim();
  if (!url || url.length > 4000) throw new Error("VALIDATION");
  let orderId: number | null = null;
  if (input.order_id != null && Number.isFinite(input.order_id) && input.order_id > 0) {
    const o = await prisma.order.findFirst({
      where: { id: input.order_id, tenant_id: tenantId, client_id: clientId },
      select: { id: true }
    });
    if (!o) throw new Error("ORDER_NOT_FOUND");
    orderId = o.id;
  }
  const row = await prisma.clientPhotoReport.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      image_url: url,
      caption: input.caption?.trim() ? input.caption.trim().slice(0, 1000) : null,
      order_id: orderId,
      created_by_user_id: userId
    }
  });
  return {
    id: row.id,
    image_url: row.image_url,
    caption: row.caption,
    order_id: row.order_id,
    created_at: row.created_at.toISOString()
  };
}

export async function deleteClientPhotoReport(
  tenantId: number,
  clientId: number,
  photoId: number
): Promise<void> {
  await assertClient(tenantId, clientId);
  const r = await prisma.clientPhotoReport.findFirst({
    where: { id: photoId, tenant_id: tenantId, client_id: clientId }
  });
  if (!r) throw new Error("NOT_FOUND");
  await prisma.clientPhotoReport.delete({ where: { id: photoId } });
}
