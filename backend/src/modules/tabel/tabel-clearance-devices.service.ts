/**
 * Обходные листы (StaffClearanceSheet), Терминалы Face ID (AttendanceDevice)
 * va Статистика посещаемости (Analytics) servisi.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";

function uniqueIds(values: Array<number | null | undefined>): number[] {
  const ids = new Set<number>();
  for (const value of values) {
    if (value != null && value > 0) ids.add(value);
  }
  return [...ids];
}

export async function inspectEmployeeClearanceBlockers(tenantId: number, userId: number) {
  const [user, warehouseLinks, activeSlots, unconfirmedPayments, consignmentOrders] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: {
        id: true,
        name: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        role: true,
        branch: true,
        warehouse_id: true,
        return_warehouse_id: true
      }
    }),
    prisma.warehouseUserLink.findMany({ where: { user_id: userId }, select: { warehouse_id: true } }),
    prisma.slotUserLink.findMany({
      where: { tenant_id: tenantId, user_id: userId, ended_at: null },
      select: { slot_id: true }
    }),
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

  const warehouseIds = uniqueIds([
    ...warehouseLinks.map((link) => link.warehouse_id),
    user?.warehouse_id,
    user?.return_warehouse_id
  ]);
  const slotIds = uniqueIds(activeSlots.map((link) => link.slot_id));
  const warehouseOk = warehouseIds.length === 0;
  const cashOk = unconfirmedPayments === 0;
  const consignmentOk = consignmentOrders === 0;
  const slotOk = slotIds.length === 0;

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
      warehouse_links: warehouseIds.length,
      pending_payments: unconfirmedPayments,
      open_orders: consignmentOrders,
      active_work_slots: slotIds.length
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
    { code: "warehouse", label: "Склад и ТМЦ", cleared: check.warehouse_cleared, detail: `Складов: ${check.details.warehouse_links}` },
    { code: "cash", label: "Касса и оплаты", cleared: check.cash_cleared, detail: `Неподтверждённых оплат: ${check.details.pending_payments}` },
    { code: "consignment", label: "Активные заказы / консигнация", cleared: check.consignment_cleared, detail: `Открытых заказов: ${check.details.open_orders}` },
    { code: "equipment", label: "Планшет и оборудование", cleared: existing?.equipment_cleared ?? false, detail: "Проверяется ИТ / складом" },
    { code: "work_slot", label: "Рабочее место (слот)", cleared: check.work_slot_cleared, detail: `Активных слотов: ${check.details.active_work_slots}` }
  ];

  if (existing) {
    return prisma.staffClearanceSheet.update({
      where: { id: existing.id },
      data: {
        warehouse_cleared: check.warehouse_cleared,
        cash_cleared: check.cash_cleared,
        consignment_cleared: check.consignment_cleared,
        work_slot_cleared: check.work_slot_cleared,
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
  const check = await inspectEmployeeClearanceBlockers(tenantId, row.user_id);
  const w = check.warehouse_cleared;
  const c = check.cash_cleared;
  const cn = check.consignment_cleared;
  const eq = patch.equipment_cleared ?? row.equipment_cleared;
  const ws = check.work_slot_cleared;
  const allCleared = w && c && cn && eq && ws;
  const nextStatus = allCleared ? "approved" : "in_progress";

  return prisma.staffClearanceSheet.update({
    where: { id },
    data: {
      warehouse_cleared: w,
      cash_cleared: c,
      consignment_cleared: cn,
      equipment_cleared: eq,
      work_slot_cleared: ws,
      items_json: [
        { code: "warehouse", label: "Склад и ТМЦ", cleared: w, detail: `Складов: ${check.details.warehouse_links}` },
        { code: "cash", label: "Касса и оплаты", cleared: c, detail: `Неподтверждённых оплат: ${check.details.pending_payments}` },
        { code: "consignment", label: "Активные заказы / консигнация", cleared: cn, detail: `Открытых заказов: ${check.details.open_orders}` },
        { code: "equipment", label: "Планшет и оборудование", cleared: eq, detail: "Проверяется ИТ / складом" },
        { code: "work_slot", label: "Рабочее место (слот)", cleared: ws, detail: `Активных слотов: ${check.details.active_work_slots}` }
      ],
      status: nextStatus,
      approved_by: nextStatus === "approved" ? actorUserId : row.approved_by,
      approved_at: nextStatus === "approved" ? new Date() : row.approved_at,
      comment: patch.comment !== undefined ? patch.comment?.trim() || null : row.comment
    }
  });
}

export {
  confirmTabelDeviceLink,
  createTabelDevice,
  deleteTabelDevice,
  issueTabelDeviceToken,
  listDeviceFaceSyncPeople,
  listTabelDevices,
  readDeviceFaceSyncImage,
  requestTabelDeviceLink,
  syncFacesToTabelDevice,
  toTabelDeviceDto,
  updateTabelDevice
} from "./tabel-devices.service";

export { getTabelAnalytics } from "./tabel-analytics.service";
