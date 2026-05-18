import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { createCashDeskUserLink } from "../cash-desks/cash-desks.service";
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import {
  parseMobileConfigV1,
  validateAgentMobileConfig,
  type AgentMobileConfigV1
} from "./agent-mobile-config";
import {
  assertValidEntitlementsKeys,
  normalizeWarehouseStaffEntitlementsRow,
  toPrismaJsonEntitlements
} from "./skladchik-entitlements";
import type { DistributionWebStaffRole } from "../../lib/tenant-user-roles";
import {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  DISTRIBUTION_WEB_STAFF_ROLES,
  OPERATOR_LIKE_WEB_ROLES,
  WEB_PANEL_STAFF_ROLES
} from "../../lib/tenant-user-roles";

import type {
  AgentEntitlements,
  CreateStaffInput,
  ExpeditorAssignmentRules,
  ListStaffFilters,
  StaffCreateResult,
  StaffKind,
  StaffRow
} from "./staff.shared";
import {
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  STAFF_KINDS_WITH_WORK_SLOT,
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  assertWarehousesBelongToTenant,
  kindRole,
  mergePriceTypesForUser,
  normalizeAgentEntitlementsInput,
  normalizePositiveIntIds,
  normalizePriceTypes,
  parseEntitlements,
  parseExpeditorAssignmentRules,
  parsePriceTypesJson,
  refStringListFromTenantSettings,
  syncSkladchikWarehouseLinks,
  toFio,
  tradeDirectionDisplayFromRef,
  tradeDirectionForCreate,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
export async function listStaff(
  tenantId: number,
  kind: StaffKind,
  filters?: ListStaffFilters
): Promise<StaffRow[]> {
  const roleFilter: Prisma.StringFilter | string =
    kind === "operator" ? { in: [...OPERATOR_LIKE_WEB_ROLES] } : kindRole(kind);
  const where: Prisma.UserWhereInput = { tenant_id: tenantId, role: roleFilter };
  if (filters?.is_active !== undefined) {
    where.is_active = filters.is_active;
  }
  if (filters?.branch?.trim()) {
    where.branch = { equals: filters.branch.trim(), mode: "insensitive" };
  }
  if (filters?.trade_direction?.trim()) {
    where.trade_direction = { equals: filters.trade_direction.trim(), mode: "insensitive" };
  }
  if (filters?.position?.trim()) {
    where.position = { equals: filters.position.trim(), mode: "insensitive" };
  }

  const territoryAnd: Prisma.UserWhereInput[] = [];
  if (filters?.territory?.trim()) {
    territoryAnd.push({ territory: { equals: filters.territory.trim(), mode: "insensitive" } });
  }
  if (filters?.territory_oblast?.trim()) {
    territoryAnd.push({ territory: { contains: filters.territory_oblast.trim(), mode: "insensitive" } });
  }
  if (filters?.territory_city?.trim()) {
    territoryAnd.push({ territory: { contains: filters.territory_city.trim(), mode: "insensitive" } });
  }
  if (territoryAnd.length > 0) {
    where.AND = territoryAnd;
  }

  if (
    kind === "skladchik" &&
    filters?.warehouse_id != null &&
    Number.isInteger(filters.warehouse_id) &&
    filters.warehouse_id > 0
  ) {
    const wid = filters.warehouse_id;
    const whClause: Prisma.UserWhereInput = {
      OR: [
        { warehouse_id: wid },
        {
          warehouse_links: {
            some: { warehouse_id: wid, link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE }
          }
        }
      ]
    };
    if (where.AND) {
      const existing = Array.isArray(where.AND) ? where.AND : [where.AND];
      where.AND = [...existing, whClause];
    } else {
      where.AND = [whClause];
    }
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      warehouse: { select: { name: true } },
      return_warehouse: { select: { name: true } },
      supervisor: { select: { id: true, name: true } },
      trade_direction_row: { select: { id: true, name: true, code: true } }
    },
    orderBy: { created_at: "desc" }
  });

  const userIds = users.map((u) => u.id);
  const sessionCounts =
    userIds.length === 0
      ? []
      : await prisma.refreshToken.groupBy({
          by: ["user_id"],
          where: {
            user_id: { in: userIds },
            revoked_at: null,
            expires_at: { gt: new Date() }
          },
          _count: { _all: true }
        });
  const sessMap = new Map(sessionCounts.map((s) => [s.user_id, s._count._all]));

  const warehousesByUserId = new Map<number, Array<{ id: number; name: string }>>();
  if (kind === "skladchik" && userIds.length > 0) {
    const links = await prisma.warehouseUserLink.findMany({
      where: { user_id: { in: userIds }, link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE },
      include: { warehouse: { select: { id: true, name: true } } },
      orderBy: { warehouse_id: "asc" }
    });
    for (const l of links) {
      const list = warehousesByUserId.get(l.user_id) ?? [];
      list.push({ id: l.warehouse.id, name: l.warehouse.name });
      warehousesByUserId.set(l.user_id, list);
    }
  }

  const cashDesksByUserId = new Map<number, Array<{ id: number; name: string }>>();
  if (kind === "collector" && userIds.length > 0) {
    const links = await prisma.cashDeskUserLink.findMany({
      where: { user_id: { in: userIds } },
      include: { cash_desk: { select: { id: true, name: true } } },
      orderBy: { cash_desk_id: "asc" }
    });
    for (const l of links) {
      const list = cashDesksByUserId.get(l.user_id) ?? [];
      if (!list.some((x) => x.id === l.cash_desk.id)) {
        list.push({ id: l.cash_desk.id, name: l.cash_desk.name });
      }
      cashDesksByUserId.set(l.user_id, list);
    }
  }

  const clientCounts = await prisma.client.groupBy({
    by: ["agent_id"],
    where: { tenant_id: tenantId, agent_id: { not: null }, merged_into_client_id: null },
    _count: { _all: true }
  });
  const countMap = new Map<number, number>();
  for (const row of clientCounts) {
    if (row.agent_id != null) countMap.set(row.agent_id, row._count._all);
  }

  let workSlotByUser = new Map<number, { slot_id: number; slot_code: string }>();
  if (STAFF_KINDS_WITH_WORK_SLOT.has(kind) && userIds.length > 0) {
    const { loadActiveWorkSlotsByUserIds } = await import("../work-slots/work-slots.query");
    workSlotByUser = await loadActiveWorkSlotsByUserIds(userIds);
  }

  let superviseeCountMap = new Map<number, number>();
  const superviseesBySupervisor = new Map<number, Array<{ id: number; fio: string; code: string | null }>>();
  if (kind === "supervisor") {
    const grouped = await prisma.user.groupBy({
      by: ["supervisor_user_id"],
      where: {
        tenant_id: tenantId,
        role: "agent",
        supervisor_user_id: { not: null }
      },
      _count: { _all: true }
    });
    for (const g of grouped) {
      if (g.supervisor_user_id != null) {
        superviseeCountMap.set(g.supervisor_user_id, g._count._all);
      }
    }

    const supIds = users.map((u) => u.id);
    if (supIds.length > 0) {
      const agents = await prisma.user.findMany({
        where: {
          tenant_id: tenantId,
          role: "agent",
          supervisor_user_id: { in: supIds }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          name: true,
          code: true,
          supervisor_user_id: true
        },
        orderBy: { id: "asc" }
      });
      for (const a of agents) {
        const sid = a.supervisor_user_id;
        if (sid == null) continue;
        const list = superviseesBySupervisor.get(sid) ?? [];
        list.push({ id: a.id, fio: toFio(a), code: a.code });
        superviseesBySupervisor.set(sid, list);
      }
    }
  }

  return users.map((u) => ({
    id: u.id,
    kind:
      kind === "operator" && (OPERATOR_LIKE_WEB_ROLES as readonly string[]).includes(u.role)
        ? (u.role as StaffKind)
        : kind,
    fio: toFio(u),
    product: u.product,
    agent_type: u.agent_type,
    code: u.code,
    pinfl: u.pinfl,
    consignment: u.consignment,
    consignment_limit_amount: u.consignment_limit_amount?.toString() ?? null,
    consignment_ignore_previous_months_debt: u.consignment_ignore_previous_months_debt ?? false,
    consignment_updated_at: u.consignment_updated_at?.toISOString() ?? null,
    apk_version: u.apk_version,
    device_name: u.device_name,
    last_sync_at: u.last_sync_at ? u.last_sync_at.toISOString() : null,
    phone: u.phone,
    email: u.email ?? null,
    can_authorize: u.can_authorize,
    price_type: u.price_type,
    price_types: mergePriceTypesForUser(u.agent_price_types, u.price_type),
    warehouse: u.warehouse?.name ?? null,
    trade_direction_id: u.trade_direction_id ?? null,
    trade_direction: tradeDirectionDisplayFromRef(u.trade_direction_row, u.trade_direction),
    branch: u.branch,
    position: u.position,
    created_at: u.created_at.toISOString(),
    app_access: u.app_access,
    territory: u.territory,
    login: u.login,
    is_active: u.is_active,
    max_sessions: u.max_sessions ?? 2,
    active_session_count: sessMap.get(u.id) ?? 0,
    kpi_color: u.kpi_color ?? null,
    agent_entitlements: parseEntitlements(u.agent_entitlements),
    expeditor_assignment_rules: parseExpeditorAssignmentRules(
      (u as { expeditor_assignment_rules?: unknown }).expeditor_assignment_rules
    ),
    client_count: countMap.get(u.id) ?? 0,
    supervisor_user_id: u.supervisor_user_id,
    supervisor_name: u.supervisor?.name ?? null,
    supervisee_count: kind === "supervisor" ? superviseeCountMap.get(u.id) ?? 0 : 0,
    supervisees: kind === "supervisor" ? superviseesBySupervisor.get(u.id) ?? [] : [],
    first_name: u.first_name,
    last_name: u.last_name,
    middle_name: u.middle_name,
    warehouses: kind === "skladchik" ? (warehousesByUserId.get(u.id) ?? []) : [],
    cash_desks: kind === "collector" ? (cashDesksByUserId.get(u.id) ?? []) : [],
    warehouse_staff_entitlements:
      kind === "skladchik"
        ? (normalizeWarehouseStaffEntitlementsRow(
            (u as { warehouse_staff_entitlements?: unknown }).warehouse_staff_entitlements
          ) as Record<string, boolean>)
        : {},
    work_slot_id: workSlotByUser.get(u.id)?.slot_id ?? null,
    work_slot_code: workSlotByUser.get(u.id)?.slot_code ?? null
  }));
}
