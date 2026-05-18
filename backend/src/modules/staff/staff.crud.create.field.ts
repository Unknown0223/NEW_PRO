import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateStaffInput, StaffCreateResult, StaffKind } from "./staff.shared";
import {
  STAFF_KINDS_WITH_WORK_SLOT,
  kindRole,
  normalizeAgentEntitlementsInput,
  normalizePriceTypes,
  tradeDirectionForCreate,
  validateAgentEntitlements
} from "./staff.shared";
import { listStaff } from "./staff.crud.list";
import { syncUserRoleLink } from "./staff.crud.create.shared";

export async function createFieldStaff(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput,
  actorUserId: number | null,
  login: string,
  firstName: string
): Promise<StaffCreateResult> {
  if (input.warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({ where: { id: input.warehouse_id, tenant_id: tenantId } });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }
  if (input.return_warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: input.return_warehouse_id, tenant_id: tenantId }
    });
    if (!wh) throw new Error("BAD_RETURN_WAREHOUSE");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const priceTypesArr = normalizePriceTypes(input.agent_price_types ?? []);
  const legacyPrice = input.price_type?.trim() || null;
  const ent = normalizeAgentEntitlementsInput(input.agent_entitlements ?? {});
  await validateAgentEntitlements(tenantId, ent);
  const entPriceTypes = ent.price_types?.length ? normalizePriceTypes(ent.price_types) : [];
  const agentPriceTypesStored =
    entPriceTypes.length > 0
      ? entPriceTypes
      : priceTypesArr.length > 0
        ? priceTypesArr
        : legacyPrice
          ? [legacyPrice]
          : [];

  const tdRes = await tradeDirectionForCreate(tenantId, input);

  const created = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: [input.last_name, input.first_name, input.middle_name].filter(Boolean).join(" ").trim() || firstName,
      first_name: firstName,
      last_name: input.last_name?.trim() || null,
      middle_name: input.middle_name?.trim() || null,
      login,
      password_hash: passwordHash,
      role: kindRole(kind),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      product: input.product?.trim() || null,
      agent_type: input.agent_type?.trim() || null,
      code: input.code?.trim() || null,
      pinfl: input.pinfl?.trim() || null,
      consignment: input.consignment ?? false,
      consignment_limit_amount:
        input.consignment_limit_amount != null && String(input.consignment_limit_amount).trim() !== ""
          ? new Prisma.Decimal(input.consignment_limit_amount)
          : null,
      consignment_ignore_previous_months_debt: input.consignment_ignore_previous_months_debt ?? false,
      consignment_updated_at: (() => {
        const lim =
          input.consignment_limit_amount != null && String(input.consignment_limit_amount).trim() !== "";
        const ign = input.consignment_ignore_previous_months_debt === true;
        const on = input.consignment === true;
        return lim || ign || on ? new Date() : null;
      })(),
      apk_version: input.apk_version?.trim() || null,
      device_name: input.device_name?.trim() || null,
      can_authorize: input.can_authorize ?? true,
      price_type: legacyPrice,
      agent_price_types: agentPriceTypesStored,
      agent_entitlements: ent as Prisma.InputJsonValue,
      max_sessions: input.max_sessions != null && input.max_sessions >= 1 ? input.max_sessions : 2,
      kpi_color: input.kpi_color?.trim().slice(0, 16) || null,
      warehouse_id: input.warehouse_id ?? null,
      return_warehouse_id: input.return_warehouse_id ?? null,
      trade_direction: tdRes.label,
      branch: input.branch?.trim() || null,
      position: input.position?.trim() || null,
      app_access: input.app_access ?? true,
      territory: input.territory?.trim() || null,
      is_active: input.is_active ?? true
    }
  });
  await syncUserRoleLink(tenantId, created.id, kindRole(kind));

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: created.id,
    action: "create",
    payload: {
      role: kindRole(kind),
      login: created.login,
      password_set: true
    }
  });

  const rows = await listStaff(tenantId, kind);
  const row = rows.find((x) => x.id === created.id);
  if (!row) throw new Error("NOT_FOUND");

  const warnings: string[] = [];
  if (STAFF_KINDS_WITH_WORK_SLOT.has(kind)) {
    const { getWorkSlotCodeOccupancyWarning } = await import("../work-slots/work-slots.query");
    const slotWarn = await getWorkSlotCodeOccupancyWarning(tenantId, created.id, input.code);
    if (slotWarn) warnings.push(slotWarn);
  }

  if (input.work_slot_id != null && STAFF_KINDS_WITH_WORK_SLOT.has(kind)) {
    const slotId = input.work_slot_id;
    if (Number.isFinite(slotId) && slotId > 0) {
      const { assignUserToSlot } = await import("../work-slots/work-slots.assign");
      await assignUserToSlot(
        tenantId,
        slotId,
        created.id,
        actorUserId,
        "Yangi xodim yaratishda biriktirish"
      );
      const rowsAfter = await listStaff(tenantId, kind);
      const rowAfter = rowsAfter.find((x) => x.id === created.id);
      if (rowAfter) {
        return warnings.length > 0 ? { ...rowAfter, warnings } : rowAfter;
      }
    }
  }

  return warnings.length > 0 ? { ...row, warnings } : row;
}
