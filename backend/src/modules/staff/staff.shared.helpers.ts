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
import type { AgentEntitlements, ExpeditorAssignmentRules, StaffKind } from "./staff.shared.types";
import { SKLADCHIK_WAREHOUSE_LINK_ROLE } from "./staff.shared.types";

export function kindRole(kind: StaffKind): string {
  if (kind === "agent") return "agent";
  if (kind === "supervisor") return "supervisor";
  if (kind === "collector") return "collector";
  if (kind === "auditor") return "auditor";
  if (kind === "operator") return "operator";
  if (kind === "skladchik") return "skladchik";
  if (kind === "expeditor") return "expeditor";
  if ((DISTRIBUTION_WEB_STAFF_ROLES as readonly string[]).includes(kind)) return kind;
  return "expeditor";
}

export function normalizePositiveIntIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const x of ids) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export async function assertWarehousesBelongToTenant(tenantId: number, warehouseIds: number[]): Promise<void> {
  if (warehouseIds.length === 0) return;
  const n = await prisma.warehouse.count({
    where: { tenant_id: tenantId, id: { in: warehouseIds } }
  });
  if (n !== warehouseIds.length) throw new Error("BAD_WAREHOUSE");
}

/** Skladchik uchun `warehouse_user_links` ni to‘liq almashtirish */
export async function syncSkladchikWarehouseLinks(
  tenantId: number,
  userId: number,
  warehouseIds: number[]
): Promise<void> {
  const uniq = normalizePositiveIntIds(warehouseIds);
  await assertWarehousesBelongToTenant(tenantId, uniq);
  await prisma.$transaction([
    prisma.warehouseUserLink.deleteMany({
      where: { user_id: userId, link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE }
    }),
    ...(uniq.length > 0
      ? [
          prisma.warehouseUserLink.createMany({
            data: uniq.map((warehouse_id) => ({
              warehouse_id,
              user_id: userId,
              link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE
            }))
          })
        ]
      : [])
  ]);
}

export function tradeDirectionDisplayFromRef(
  ref: { code: string | null; name: string } | null | undefined,
  legacy: string | null
): string | null {
  if (ref) {
    const v = (ref.code?.trim() || ref.name).trim();
    if (v) return v;
  }
  return legacy?.trim() || null;
}

export async function applyTradeDirectionPatch(
  tenantId: number,
  input: { trade_direction_id?: number | null; trade_direction?: string | null },
  data: Prisma.UserUpdateInput
): Promise<void> {
  if (input.trade_direction_id !== undefined) {
    if (input.trade_direction_id === null) {
      data.trade_direction_row = { disconnect: true };
      data.trade_direction = null;
    } else {
      const row = await prisma.tradeDirection.findFirst({
        where: { id: input.trade_direction_id, tenant_id: tenantId }
      });
      if (!row) throw new Error("BAD_TRADE_DIRECTION");
      data.trade_direction = (row.code?.trim() || row.name).trim() || null;
      data.trade_direction_row = { connect: { id: row.id } };
    }
    return;
  }
  if (input.trade_direction !== undefined) {
    data.trade_direction_row = { disconnect: true };
    data.trade_direction = input.trade_direction?.trim() || null;
  }
}

export async function tradeDirectionForCreate(
  tenantId: number,
  input: { trade_direction_id?: number | null; trade_direction?: string | null }
): Promise<{ label: string | null; connectId: number | null }> {
  if (input.trade_direction_id != null && input.trade_direction_id > 0) {
    const row = await prisma.tradeDirection.findFirst({
      where: { id: input.trade_direction_id, tenant_id: tenantId }
    });
    if (!row) throw new Error("BAD_TRADE_DIRECTION");
    return {
      label: (row.code?.trim() || row.name).trim() || null,
      connectId: row.id
    };
  }
  return { label: input.trade_direction?.trim() || null, connectId: null };
}

export function toFio(u: { first_name: string | null; last_name: string | null; middle_name: string | null; name: string }) {
  const parts = [u.last_name, u.first_name, u.middle_name].filter((x) => x && x.trim().length > 0);
  return parts.length > 0 ? parts.join(" ") : u.name;
}

export function normalizePriceTypes(values: string[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((s) => s.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
    )
  ];
}

export function parsePriceTypesJson(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return normalizePriceTypes(v.filter((x): x is string => typeof x === "string"));
}

export function parseExpeditorAssignmentRules(v: unknown): ExpeditorAssignmentRules {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const price_types = parsePriceTypesJson(o.price_types);
  const agent_ids = Array.isArray(o.agent_ids)
    ? o.agent_ids
        .map((x) => (typeof x === "number" ? x : Number(x)))
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const warehouse_ids = Array.isArray(o.warehouse_ids)
    ? o.warehouse_ids
        .map((x) => (typeof x === "number" ? x : Number(x)))
        .filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const trade_directions = Array.isArray(o.trade_directions)
    ? o.trade_directions
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
    : [];
  const territories = Array.isArray(o.territories)
    ? o.territories
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((s) => s.trim())
    : [];
  const weekdays = Array.isArray(o.weekdays)
    ? o.weekdays
        .map((x) => (typeof x === "number" ? x : Number(x)))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    : [];
  return {
    price_types: price_types.length ? price_types : undefined,
    agent_ids: agent_ids.length ? agent_ids : undefined,
    warehouse_ids: warehouse_ids.length ? warehouse_ids : undefined,
    trade_directions: trade_directions.length ? trade_directions : undefined,
    territories: territories.length ? territories : undefined,
    weekdays: weekdays.length ? weekdays : undefined
  };
}

export function parseEntitlements(v: unknown): AgentEntitlements {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const price_types = parsePriceTypesJson(o.price_types);
  const rawRules = o.product_rules;
  const product_rules: AgentEntitlements["product_rules"] = [];
  if (Array.isArray(rawRules)) {
    for (const r of rawRules) {
      if (r == null || typeof r !== "object" || Array.isArray(r)) continue;
      const row = r as Record<string, unknown>;
      const category_id = typeof row.category_id === "number" ? row.category_id : Number(row.category_id);
      if (!Number.isInteger(category_id) || category_id <= 0) continue;
      const all = row.all === true;
      const pids = Array.isArray(row.product_ids)
        ? row.product_ids.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0)
        : [];
      product_rules.push({ category_id, all, product_ids: pids.length ? pids : undefined });
    }
  }
  const mobile_config = parseMobileConfigV1(o.mobile_config);
  const out: AgentEntitlements = {
    price_types: price_types.length ? price_types : undefined,
    product_rules: product_rules.length ? product_rules : undefined
  };
  if (mobile_config) out.mobile_config = mobile_config;
  return out;
}

/** Saqlashdan oldin `mobile_config` ni whitelist parse qiladi. */
export function normalizeAgentEntitlementsInput(ent: AgentEntitlements): AgentEntitlements {
  const out: AgentEntitlements = {};
  if (ent.price_types?.length) {
    out.price_types = normalizePriceTypes(ent.price_types);
  }
  if (ent.product_rules?.length) {
    out.product_rules = ent.product_rules;
  }
  if (ent.mobile_config !== undefined && ent.mobile_config !== null) {
    const mc = parseMobileConfigV1(ent.mobile_config);
    if (mc) out.mobile_config = mc;
  }
  return out;
}

export function mergePriceTypesForUser(
  agent_price_types: unknown,
  legacy: string | null
): string[] {
  const fromJson = parsePriceTypesJson(agent_price_types);
  if (fromJson.length > 0) return fromJson;
  return legacy ? normalizePriceTypes([legacy]) : [];
}

export async function validateAgentEntitlements(
  tenantId: number,
  ent: AgentEntitlements | undefined | null
): Promise<void> {
  if (!ent || typeof ent !== "object") return;
  validateAgentMobileConfig(tenantId, ent.mobile_config);
  const rules = ent.product_rules;
  if (!rules?.length) return;
  const catIds = [...new Set(rules.map((r) => r.category_id))];
  const cats = await prisma.productCategory.findMany({
    where: { tenant_id: tenantId, id: { in: catIds } },
    select: { id: true }
  });
  if (cats.length !== catIds.length) {
    throw new Error("BAD_ENTITLEMENT_CATEGORY");
  }
  for (const r of rules) {
    if (r.all) continue;
    const pids = r.product_ids ?? [];
    if (!pids.length) {
      throw new Error("BAD_ENTITLEMENT_PRODUCT");
    }
    const prods = await prisma.product.findMany({
      where: { tenant_id: tenantId, id: { in: pids }, category_id: r.category_id },
      select: { id: true }
    });
    if (prods.length !== pids.length) {
      throw new Error("BAD_ENTITLEMENT_PRODUCT");
    }
  }
}

/** `mobile_config.expeditor.allowed_trade_direction_ids` — tenant spravochnikida borligini tekshirish */
export async function assertExpeditorMobileTradeDirections(
  tenantId: number,
  mobileConfig: AgentMobileConfigV1 | undefined | null
): Promise<void> {
  const ids = mobileConfig?.expeditor?.allowed_trade_direction_ids;
  if (!ids?.length) return;
  const uniq = [...new Set(ids)];
  const n = await prisma.tradeDirection.count({
    where: { tenant_id: tenantId, id: { in: uniq } }
  });
  if (n !== uniq.length) throw new Error("BAD_EXPEDITOR_MOBILE_TRADE_DIRECTION");
}

export async function validateExpeditorAssignmentRules(
  tenantId: number,
  rules: ExpeditorAssignmentRules | undefined | null
): Promise<void> {
  if (!rules || typeof rules !== "object") return;
  const aids = rules.agent_ids ?? [];
  if (aids.length) {
    const uniqueAids = [...new Set(aids)];
    const agents = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: uniqueAids }, role: "agent" },
      select: { id: true }
    });
    if (agents.length !== uniqueAids.length) {
      throw new Error("BAD_EXPEDITOR_RULE_AGENT");
    }
  }
  const wids = rules.warehouse_ids ?? [];
  if (wids.length) {
    const uniqueWids = [...new Set(wids)];
    const whs = await prisma.warehouse.findMany({
      where: { tenant_id: tenantId, id: { in: uniqueWids } },
      select: { id: true }
    });
    if (whs.length !== uniqueWids.length) {
      throw new Error("BAD_EXPEDITOR_RULE_WAREHOUSE");
    }
  }
}
