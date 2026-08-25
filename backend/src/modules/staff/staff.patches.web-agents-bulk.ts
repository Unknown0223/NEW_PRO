import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { onBulkAppAccessChanged } from "../auth/app-access.service";
import { validateConsignmentCloseSchedule } from "../consignment/consignment-settings";
import {
  extractMobileConfigFromEntitlementsUnknown,
  mergeMobileConfigPatch,
  parseMobileConfigV1,
  type AgentMobileConfigV1
} from "./agent-mobile-config";
import type { AgentEntitlements } from "./staff.shared";
import { normalizeAgentEntitlementsInput, validateAgentEntitlements } from "./staff.shared";
import { loadActiveWorkSlotsByUserIds } from "../work-slots/work-slots.query";
import { mirrorSlotConfigToUser } from "../work-slots/work-slots.config-mirror";
import { assertNoActiveSlotForWorkplaceBulk } from "../work-slots/work-slots.staff-guard";
import {
  entitlementsSnapshotFromAgentUser,
  mergeAgentEntitlementsAfterProductListPatch,
  snapToAgentEntitlements
} from "./staff.patches.web-agents-bulk.entitlements";

export { mergeAgentEntitlementsAfterProductListPatch } from "./staff.patches.web-agents-bulk.entitlements";

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
  | {
      action: "set_consignment_close";
      agent_ids: number[];
      close_day: number;
      close_hour: number;
      close_minute: number;
    }
  | { action: "set_app_access"; agent_ids: number[]; app_access: boolean }
  | { action: "revoke_sessions"; agent_ids: number[] }
  | { action: "set_max_sessions"; agent_ids: number[]; max_sessions: number }
  | { action: "adjust_max_sessions"; agent_ids: number[]; delta: number }
  | { action: "patch_mobile_config"; agent_ids: number[]; mobile_config: AgentMobileConfigV1 };

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
      await assertNoActiveSlotForWorkplaceBulk(ids);
      const normalizedEnt = normalizeAgentEntitlementsInput(input.agent_entitlements);
      const usersForMerge = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        select: { id: true, agent_entitlements: true, agent_price_types: true, price_type: true }
      });
      const patches = usersForMerge.map((u) => {
        const snap = entitlementsSnapshotFromAgentUser(u);
        return normalizeAgentEntitlementsInput({
          price_types: normalizedEnt.price_types ?? snap.price_types,
          product_rules: normalizedEnt.product_rules ?? snap.product_rules,
          mobile_config:
            normalizedEnt.mobile_config !== undefined ? normalizedEnt.mobile_config : snap.mobile_config
        });
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
      await assertNoActiveSlotForWorkplaceBulk(ids);
      const pids = [...new Set((input.product_ids ?? []).filter((x) => x > 0))];
      const pts = [...new Set((input.price_types ?? []).map((s) => s.trim()).filter(Boolean))];
      if (!pids.length && !pts.length) throw new Error("EMPTY_PRODUCT_PATCH");
      if (pids.length && input.category_id == null) throw new Error("BAD_CATEGORY");
      const users = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        select: { id: true, agent_entitlements: true, agent_price_types: true, price_type: true }
      });
      const patches = users.map((u) =>
        mergeAgentEntitlementsAfterProductListPatch(u, {
          mode: input.mode,
          category_id: input.category_id,
          product_ids: pids,
          price_types: pts
        })
      );
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
      await assertNoActiveSlotForWorkplaceBulk(ids);
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
      await assertNoActiveSlotForWorkplaceBulk(uids);
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
      await assertNoActiveSlotForWorkplaceBulk(ids);
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: { consignment: input.consignment, consignment_updated_at: new Date() }
      });
      await auditBulk(ids.length);
      return { updated: ids.length };
    }
    case "set_consignment_close": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      await assertNoActiveSlotForWorkplaceBulk(ids);
      const schedule = validateConsignmentCloseSchedule({
        day: input.close_day,
        hour: input.close_hour,
        minute: input.close_minute
      });
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: {
          consignment_close_day: schedule.day,
          consignment_close_hour: schedule.hour,
          consignment_close_minute: schedule.minute,
          consignment_updated_at: new Date()
        }
      });
      await auditBulk(ids.length, { close: schedule });
      return { updated: ids.length };
    }
    case "set_app_access": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      await prisma.user.updateMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        data: { app_access: input.app_access }
      });
      await onBulkAppAccessChanged(tenantId, ids, input.app_access);
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
    case "patch_mobile_config": {
      const ids = await assertTenantAgentIdList(tenantId, input.agent_ids);
      const parsedPatch = parseMobileConfigV1(input.mobile_config);
      if (!parsedPatch) throw new Error("BAD_MOBILE_CONFIG_PATCH");
      await validateAgentEntitlements(tenantId, { mobile_config: parsedPatch });
      const users = await prisma.user.findMany({
        where: { tenant_id: tenantId, role: "agent", id: { in: ids } },
        select: { id: true, agent_entitlements: true, agent_price_types: true, price_type: true }
      });
      const slotByUser = await loadActiveWorkSlotsByUserIds(users.map((u) => u.id));
      let updated = 0;
      for (const u of users) {
        const slotInfo = slotByUser.get(u.id);
        if (slotInfo) {
          const slot = await prisma.workSlot.findFirst({
            where: { id: slotInfo.slot_id, tenant_id: tenantId },
            select: { id: true, entitlements: true }
          });
          if (!slot) continue;
          const prevEnt =
            slot.entitlements != null &&
            typeof slot.entitlements === "object" &&
            !Array.isArray(slot.entitlements)
              ? { ...(slot.entitlements as Record<string, unknown>) }
              : {};
          const stored = extractMobileConfigFromEntitlementsUnknown(slot.entitlements);
          const mergedMc = mergeMobileConfigPatch(stored, parsedPatch);
          const nextEnt = { ...prevEnt, mobile_config: mergedMc };
          await prisma.$transaction(async (tx) => {
            await tx.workSlot.update({
              where: { id: slot.id },
              data: { entitlements: nextEnt as Prisma.InputJsonValue }
            });
            await mirrorSlotConfigToUser(tx, tenantId, slot.id, u.id);
          });
          updated += 1;
          continue;
        }
        const snap = entitlementsSnapshotFromAgentUser(u);
        const stored = extractMobileConfigFromEntitlementsUnknown(u.agent_entitlements);
        const mergedMc = mergeMobileConfigPatch(stored, parsedPatch);
        const patch = normalizeAgentEntitlementsInput({
          ...snapToAgentEntitlements(snap),
          mobile_config: mergedMc
        });
        await prisma.user.update({ where: { id: u.id }, data: { agent_entitlements: patch } });
        updated += 1;
      }
      await auditBulk(updated, {
        mobile_config_section_keys: Object.keys(parsedPatch).filter((k) => k !== "schema_version")
      });
      return { updated };
    }
    default:
      throw new Error("BAD_BULK_ACTION");
  }
}
