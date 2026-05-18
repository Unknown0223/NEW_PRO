import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { parseMobileConfigV1, type AgentMobileConfigV1 } from "./agent-mobile-config";
import type { AgentEntitlements, ExpeditorAssignmentRules, StaffRow } from "./staff.shared";
import {
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  normalizeAgentEntitlementsInput,
  normalizePriceTypes,
  parseEntitlements,
  parsePriceTypesJson,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
import { applyAgentPatchInDb } from "./staff.patches.field";
import { listStaff, type PatchAgentInput } from "./staff.crud";

const AGENT_BULK_MAX_IDS = 500;

async function assertTenantAgentIdList(tenantId: number, ids: number[]): Promise<number[]> {
  const uniq = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))];
  if (!uniq.length) throw new Error("EMPTY_IDS");
  if (uniq.length > AGENT_BULK_MAX_IDS) throw new Error("TOO_MANY_AGENTS");
  const count = await prisma.user.count({
    where: { tenant_id: tenantId, role: "agent", id: { in: uniq } }
  });
  if (count !== uniq.length) throw new Error("BAD_AGENT_IDS");
  return uniq;
}

type EntSnap = {
  price_types: string[];
  product_rules: NonNullable<AgentEntitlements["product_rules"]>;
  mobile_config?: AgentMobileConfigV1;
};

function entitlementsSnapshotFromAgentUser(u: {
  agent_entitlements: unknown;
  agent_price_types: unknown;
  price_type: string | null;
}): EntSnap {
  const fromJson =
    u.agent_entitlements && typeof u.agent_entitlements === "object" && !Array.isArray(u.agent_entitlements)
      ? (u.agent_entitlements as Record<string, unknown>)
      : {};
  const product_rules: NonNullable<AgentEntitlements["product_rules"]> = [];
  const rulesRaw = fromJson.product_rules;
  if (Array.isArray(rulesRaw)) {
    for (const r of rulesRaw) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const cid =
        typeof rec.category_id === "number" && Number.isInteger(rec.category_id) && rec.category_id > 0
          ? rec.category_id
          : 0;
      if (!cid) continue;
      const all = Boolean(rec.all);
      const product_ids = Array.isArray(rec.product_ids)
        ? rec.product_ids.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0)
        : undefined;
      product_rules.push({ category_id: cid, all, product_ids });
    }
  }
  const jPt = fromJson.price_types;
  const fromJsonPts =
    Array.isArray(jPt) && jPt.every((x) => typeof x === "string") ? normalizePriceTypes(jPt as string[]) : [];
  const colPts = parsePriceTypesJson(u.agent_price_types);
  const single = u.price_type ? normalizePriceTypes([u.price_type]) : [];
  const price_types = [...new Set([...fromJsonPts, ...colPts, ...single])];
  const mobile_config = parseMobileConfigV1(fromJson.mobile_config);
  return {
    price_types,
    product_rules,
    ...(mobile_config ? { mobile_config } : {})
  };
}

function snapToAgentEntitlements(snap: EntSnap): AgentEntitlements {
  const out: AgentEntitlements = {
    price_types: snap.price_types,
    product_rules: snap.product_rules
  };
  if (snap.mobile_config) out.mobile_config = snap.mobile_config;
  return out;
}

/** Guruh mahsulot/narx patchidan keyin `mobile_config` saqlanadi (regression fix). */
export function mergeAgentEntitlementsAfterProductListPatch(
  userRow: { agent_entitlements: unknown; agent_price_types: unknown; price_type: string | null },
  patch: {
    mode: "add" | "remove";
    category_id?: number;
    product_ids?: number[];
    price_types?: string[];
  }
): AgentEntitlements {
  let snap = entitlementsSnapshotFromAgentUser(userRow);
  if (patch.product_ids?.length && patch.category_id != null) {
    snap = mergeAgentProductRulesPatch(snap, patch.mode, patch.category_id, patch.product_ids);
  }
  if (patch.price_types?.length) {
    snap = mergeEntitlementPriceTypes(snap, patch.mode, patch.price_types);
  }
  return snapToAgentEntitlements(snap);
}

function mergeAgentProductRulesPatch(
  ent: EntSnap,
  mode: "add" | "remove",
  categoryId: number,
  productIds: number[]
): EntSnap {
  const idSet = [...new Set(productIds.filter((x) => x > 0))];
  const rules = [...ent.product_rules];
  const idx = rules.findIndex((r) => r.category_id === categoryId);
  if (mode === "add") {
    if (!idSet.length) return ent;
    if (idx < 0) {
      rules.push({ category_id: categoryId, all: false, product_ids: idSet });
    } else {
      const r = rules[idx]!;
      if (r.all) {
        rules[idx] = { category_id: categoryId, all: false, product_ids: idSet };
      } else {
        const cur = new Set(r.product_ids ?? []);
        for (const p of idSet) cur.add(p);
        rules[idx] = { category_id: categoryId, all: false, product_ids: [...cur] };
      }
    }
    return { ...ent, product_rules: rules };
  }
  if (idx < 0) return ent;
  const r = rules[idx]!;
  if (r.all) {
    rules.splice(idx, 1);
    return { ...ent, product_rules: rules };
  }
  const rm = new Set(idSet);
  const next = (r.product_ids ?? []).filter((id) => !rm.has(id));
  if (next.length === 0) rules.splice(idx, 1);
  else rules[idx] = { category_id: categoryId, all: false, product_ids: next };
  return { ...ent, product_rules: rules };
}

function mergeEntitlementPriceTypes(ent: EntSnap, mode: "add" | "remove", labels: string[]): EntSnap {
  const norm = [...new Set(labels.map((s) => s.trim()).filter(Boolean))];
  let pts = [...ent.price_types];
  if (mode === "add") pts = [...new Set([...pts, ...norm])];
  else {
    const rm = new Set(norm);
    pts = pts.filter((p) => !rm.has(p));
  }
  return { ...ent, price_types: pts };
}

export type BulkAgentsInput =
  | { action: "set_agent_entitlements"; agent_ids: number[]; agent_entitlements: AgentEntitlements }
  | {
      action: "patch_product_list";
      agent_ids: number[];
      mode: "add" | "remove";
      category_id?: number;
      product_ids?: number[];
      price_types?: string[];
    }
  | { action: "set_trade_direction"; agent_ids: number[]; trade_direction_id: number | null }
  | { action: "set_trade_directions"; updates: { agent_id: number; trade_direction_id: number | null }[] }
  | { action: "set_consignment"; agent_ids: number[]; consignment: boolean }
  | { action: "set_app_access"; agent_ids: number[]; app_access: boolean }
  | { action: "revoke_sessions"; agent_ids: number[] }
  | { action: "set_max_sessions"; agent_ids: number[]; max_sessions: number }
  | { action: "adjust_max_sessions"; agent_ids: number[]; delta: number };

export async function bulkPatchAgents(
  tenantId: number,
  input: BulkAgentsInput,
  actorUserId: number | null = null
): Promise<{ updated: number }> {
  const auditBulk = (count: number, extra?: Record<string, unknown>) =>
    appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: "agents_bulk",
      action: "agents.bulk",
      payload: { op: input.action, count, ...extra }
    });

  switch (input.action) {
    case "set_agent_entitlements": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      const normalizedEnt = normalizeAgentEntitlementsInput(input.agent_entitlements);
      const usersForMerge = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        select: { id: true, agent_entitlements: true }
      });
      const patches = usersForMerge.map((u) => {
        const prev =
          u.agent_entitlements && typeof u.agent_entitlements === "object" && !Array.isArray(u.agent_entitlements)
            ? (u.agent_entitlements as Record<string, unknown>)
            : {};
        return normalizeAgentEntitlementsInput({ ...parseEntitlements(prev), ...normalizedEnt });
      });
      await prisma.$transaction(
        usersForMerge.map((u, i) =>
          prisma.user.update({ where: { id: u.id }, data: { agent_entitlements: patches[i] } })
        )
      );
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "patch_product_list": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      const pids = [...new Set((input.product_ids ?? []).filter((x) => x > 0))];
      const pts = [...new Set((input.price_types ?? []).map((s) => s.trim()).filter(Boolean))];
      if (!pids.length && !pts.length) throw new Error("EMPTY_PRODUCT_PATCH");
      if (pids.length && input.category_id == null) throw new Error("BAD_CATEGORY");
      const users = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        select: { id: true, agent_entitlements: true, agent_price_types: true, price_type: true }
      });
      const patches = users.map((u) => {
        const ent = mergeAgentEntitlementsAfterProductListPatch(u, {
          mode: input.mode,
          category_id: input.category_id,
          product_ids: pids,
          price_types: pts
        });
        return ent;
      });
      await prisma.$transaction(
        users.map((u, i) =>
          prisma.user.update({ where: { id: u.id }, data: { agent_entitlements: patches[i] } })
        )
      );
      await auditBulk(users.length);
      return { updated: users.length };
    }
    case "set_trade_direction": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: { trade_direction_id: input.trade_direction_id }
      });
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "set_trade_directions": {
      if (!input.updates.length) throw new Error("EMPTY_IDS");
      if (input.updates.length > AGENT_BULK_MAX_IDS) throw new Error("TOO_MANY_AGENTS");
      const uids = input.updates.map((u) => u.agent_id);
      await assertTenantAgentIdList(tenantId, uids);
      await prisma.$transaction(
        input.updates.map((u) =>
          prisma.user.update({ where: { id: u.agent_id }, data: { trade_direction_id: u.trade_direction_id } })
        )
      );
      await auditBulk(input.updates.length);
      return { updated: input.updates.length };
    }
    case "set_consignment": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: { consignment: input.consignment, consignment_updated_at: new Date() }
      });
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "set_app_access": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: { app_access: input.app_access }
      });
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "revoke_sessions": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      const now = new Date();
      await prisma.refreshToken.updateMany({
        where: { tenant_id: tenantId, user_id: { in: ids }, revoked_at: null },
        data: { revoked_at: now }
      });
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "set_max_sessions": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      const n = input.max_sessions;
      if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: { max_sessions: n }
      });
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "adjust_max_sessions": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      const d = input.delta;
      if (!Number.isInteger(d) || d === 0) throw new Error("BAD_DELTA");
      const rows = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        select: { id: true, max_sessions: true }
      });
      await prisma.$transaction(
        rows.map((u) => {
          const next = Math.min(99, Math.max(1, u.max_sessions + d));
          return prisma.user.update({ where: { id: u.id }, data: { max_sessions: next } });
        })
      );
      await auditBulk(rows.length, { delta: d });
      return { updated: rows.length };
    }
    default:
      throw new Error("BAD_BULK_ACTION");
  }
}
