/**
 * Обходные листы (StaffClearanceSheet), Терминалы Face ID (AttendanceDevice)
 * va Статистика посещаемости (Analytics) servisi.
 */
import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { getFaceReferenceMeta } from "../mobile/mobile-face.reference";

export async function inspectEmployeeClearanceBlockers(tenantId: number, userId: number) {
  const [user, warehouseLinks, activeSlots, unconfirmedPayments, consignmentOrders] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true, warehouse_id: true }
    }),
    prisma.warehouseUserLink.count({ where: { user_id: userId } }),
    prisma.slotUserLink.count({ where: { tenant_id: tenantId, user_id: userId, ended_at: null } }),
    prisma.payment.count({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        workflow_status: "pending_confirmation",
        OR: [{ created_by_user_id: userId }, { expeditor_user_id: userId }, { ledger_agent_id: userId }]
      }
    }),
    prisma.order.count({
      where: {
        tenant_id: tenantId,
        OR: [{ agent_id: userId }, { expeditor_user_id: userId }],
        status: { in: ["confirmed", "picking", "delivering"] }
      }
    })
  ]);

  const warehouseOk = warehouseLinks === 0 && !user?.warehouse_id;
  const cashOk = unconfirmedPayments === 0;
  const consignmentOk = consignmentOrders === 0;
  const slotOk = activeSlots === 0;

  return {
    user_fio: user ? toFio(user) : `User #${userId}`,
    user_role: user?.role ?? "—",
    user_branch: user?.branch ?? null,
    warehouse_cleared: warehouseOk,
    cash_cleared: cashOk,
    consignment_cleared: consignmentOk,
    equipment_cleared: false,
    work_slot_cleared: slotOk,
    details: {
      warehouse_links: warehouseLinks + (user?.warehouse_id ? 1 : 0),
      pending_payments: unconfirmedPayments,
      open_orders: consignmentOrders,
      active_work_slots: activeSlots
    }
  };
}

export async function listTabelClearanceSheets(tenantId: number, status?: string) {
  const where: Prisma.StaffClearanceSheetWhereInput = { tenant_id: tenantId };
  if (status) where.status = status;
  const rows = await prisma.staffClearanceSheet.findMany({
    where,
    orderBy: [{ created_at: "desc" }],
    take: 100
  });
  const uids = [...new Set(rows.map((r) => r.user_id))];
  const users = uids.length
    ? await prisma.user.findMany({
        where: { tenant_id: tenantId, id: { in: uids } },
        select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true }
      })
    : [];
  const uMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = uMap.get(r.user_id);
    return {
      ...r,
      user_fio: u ? toFio(u) : `User #${r.user_id}`,
      user_role: u?.role ?? "—",
      user_branch: u?.branch ?? null
    };
  });
}

export async function createOrSyncClearanceSheet(
  tenantId: number,
  userId: number,
  comment?: string | null
) {
  const check = await inspectEmployeeClearanceBlockers(tenantId, userId);
  const existing = await prisma.staffClearanceSheet.findFirst({
    where: { tenant_id: tenantId, user_id: userId, status: { in: ["open", "in_progress"] } }
  });
  const itemsJson = [
    { code: "warehouse", label: "Склад и ТМЦ", cleared: check.warehouse_cleared, detail: `Привязок склада: ${check.details.warehouse_links}` },
    { code: "cash", label: "Касса и оплаты", cleared: check.cash_cleared, detail: `Неподтверждённых оплат: ${check.details.pending_payments}` },
    { code: "consignment", label: "Активные заказы / консигнация", cleared: check.consignment_cleared, detail: `Открытых заказов: ${check.details.open_orders}` },
    { code: "equipment", label: "Планшет и оборудование", cleared: existing?.equipment_cleared ?? false, detail: "Проверяется ИТ / складом" },
    { code: "work_slot", label: "Рабочее место (слот)", cleared: check.work_slot_cleared, detail: `Активных слотов: ${check.details.active_work_slots}` }
  ];

  if (existing) {
    return prisma.staffClearanceSheet.update({
      where: { id: existing.id },
      data: {
        warehouse_cleared: existing.warehouse_cleared || check.warehouse_cleared,
        cash_cleared: existing.cash_cleared || check.cash_cleared,
        consignment_cleared: existing.consignment_cleared || check.consignment_cleared,
        work_slot_cleared: existing.work_slot_cleared || check.work_slot_cleared,
        items_json: itemsJson,
        comment: comment?.trim() || existing.comment
      }
    });
  }

  return prisma.staffClearanceSheet.create({
    data: {
      tenant_id: tenantId,
      user_id: userId,
      status: "in_progress",
      warehouse_cleared: check.warehouse_cleared,
      cash_cleared: check.cash_cleared,
      consignment_cleared: check.consignment_cleared,
      equipment_cleared: false,
      work_slot_cleared: check.work_slot_cleared,
      items_json: itemsJson,
      comment: comment?.trim() || null
    }
  });
}

export async function updateTabelClearanceSheet(
  tenantId: number,
  id: number,
  patch: {
    warehouse_cleared?: boolean;
    cash_cleared?: boolean;
    consignment_cleared?: boolean;
    equipment_cleared?: boolean;
    work_slot_cleared?: boolean;
    status?: "open" | "in_progress" | "approved" | "rejected";
    comment?: string | null;
  },
  actorUserId: number | null
) {
  const row = await prisma.staffClearanceSheet.findFirst({ where: { id, tenant_id: tenantId } });
  if (!row) throw new Error("NOT_FOUND");
  const w = patch.warehouse_cleared ?? row.warehouse_cleared;
  const c = patch.cash_cleared ?? row.cash_cleared;
  const cn = patch.consignment_cleared ?? row.consignment_cleared;
  const eq = patch.equipment_cleared ?? row.equipment_cleared;
  const ws = patch.work_slot_cleared ?? row.work_slot_cleared;
  const allCleared = w && c && cn && eq && ws;
  const nextStatus = patch.status ?? (allCleared ? "approved" : "in_progress");

  return prisma.staffClearanceSheet.update({
    where: { id },
    data: {
      warehouse_cleared: w,
      cash_cleared: c,
      consignment_cleared: cn,
      equipment_cleared: eq,
      work_slot_cleared: ws,
      status: nextStatus,
      approved_by: nextStatus === "approved" ? actorUserId : row.approved_by,
      approved_at: nextStatus === "approved" ? new Date() : row.approved_at,
      comment: patch.comment !== undefined ? patch.comment?.trim() || null : row.comment
    }
  });
}

function asMeta(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function isDeviceLinked(d: { status: string; is_confirmed: boolean }): boolean {
  return d.is_confirmed || d.status === "online";
}

export function toTabelDeviceDto(d: {
  id: number;
  name: string;
  vendor: string;
  serial_no: string | null;
  branch: string | null;
  pairing_code: string | null;
  tunnel_url: string | null;
  status: string;
  is_confirmed: boolean;
  synced_faces_count: number;
  last_seen_at: Date | null;
  device_token_hash: string | null;
  meta: Prisma.JsonValue;
}) {
  const linked = isDeviceLinked(d);
  const meta = asMeta(d.meta);
  const stored = typeof meta.device_token === "string" ? meta.device_token : null;
  return {
    id: d.id,
    name: d.name,
    vendor: d.vendor,
    serial_no: d.serial_no,
    branch: d.branch,
    pairing_code: d.pairing_code,
    tunnel_url: d.tunnel_url,
    status: d.status,
    is_confirmed: d.is_confirmed,
    is_linked: linked,
    synced_faces_count: d.synced_faces_count,
    last_seen_at: d.last_seen_at,
    has_token: Boolean(d.device_token_hash),
    device_token: linked ? stored : null
  };
}

export async function listTabelDevices(tenantId: number) {
  const rows = await prisma.attendanceDevice.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ id: "desc" }]
  });
  return rows.map(toTabelDeviceDto);
}

export async function createTabelDevice(
  tenantId: number,
  input: {
    name: string;
    vendor?: string;
    serial_no?: string | null;
    branch?: string | null;
    location_id?: number | null;
    tunnel_url?: string | null;
  }
) {
  const pairingCode = String(100000 + Math.floor(Math.random() * 900000));
  const device = await prisma.attendanceDevice.create({
    data: {
      tenant_id: tenantId,
      name: input.name.trim(),
      vendor: (input.vendor ?? "hikvision").trim().toLowerCase(),
      serial_no: input.serial_no?.trim() || null,
      branch: input.branch?.trim() || null,
      location_id: input.location_id ?? null,
      pairing_code: pairingCode,
      tunnel_url: input.tunnel_url?.trim() || null,
      status: "pending",
      is_confirmed: false
    }
  });
  return { device: toTabelDeviceDto(device), pairing_code: pairingCode };
}

export async function issueTabelDeviceToken(tenantId: number, id: number) {
  const existing = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!existing) throw new Error("NOT_FOUND");
  if (!isDeviceLinked(existing)) throw new Error("DEVICE_NOT_LINKED");
  const rawToken = `dev_${randomBytes(18).toString("hex")}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const meta = { ...asMeta(existing.meta), device_token: rawToken, token_issued_at: new Date().toISOString() };
  const device = await prisma.attendanceDevice.update({
    where: { id },
    data: { device_token_hash: tokenHash, meta }
  });
  return { device: toTabelDeviceDto(device), device_token: rawToken };
}

export async function updateTabelDevice(
  tenantId: number,
  id: number,
  patch: {
    name?: string;
    branch?: string | null;
    tunnel_url?: string | null;
    is_confirmed?: boolean;
    status?: string;
  }
) {
  const existing = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!existing) throw new Error("NOT_FOUND");
  return prisma.attendanceDevice.update({
    where: { id },
    data: {
      ...(patch.name ? { name: patch.name.trim() } : {}),
      ...(patch.branch !== undefined ? { branch: patch.branch?.trim() || null } : {}),
      ...(patch.tunnel_url !== undefined ? { tunnel_url: patch.tunnel_url?.trim() || null } : {}),
      ...(patch.is_confirmed !== undefined ? { is_confirmed: patch.is_confirmed } : {}),
      ...(patch.status ? { status: patch.status } : {})
    }
  });
}

export async function syncFacesToTabelDevice(tenantId: number, id: number) {
  const device = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!device) throw new Error("NOT_FOUND");

  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      ...(device.branch ? { branch: { equals: device.branch, mode: "insensitive" } } : {})
    },
    select: { id: true }
  });
  let enrolledCount = 0;
  for (const u of users) {
    const meta = await getFaceReferenceMeta(tenantId, u.id);
    if (meta.has_reference) enrolledCount += 1;
  }

  return prisma.attendanceDevice.update({
    where: { id },
    data: {
      synced_faces_count: enrolledCount,
      last_sync_at: new Date(),
      last_seen_at: new Date(),
      status: "online",
      is_confirmed: true
    }
  });
}

export async function deleteTabelDevice(tenantId: number, id: number) {
  await prisma.attendanceDevice.deleteMany({ where: { id, tenant_id: tenantId } });
  return { ok: true };
}

export { getTabelAnalytics } from "./tabel-analytics.service";
