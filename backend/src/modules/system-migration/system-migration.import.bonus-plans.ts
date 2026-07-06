import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import {
  hydrateDates,
  hydrateDecimals,
  readZipJson,
  remapId,
  remapIntArray,
  stripIdTenant
} from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

function requireMap(maps: MigrationIdMaps, kind: keyof MigrationIdMaps, oldId: unknown, label: string): number | null {
  if (oldId == null) return null;
  const mapped = remapId(maps[kind], oldId);
  if (mapped == null) throw new Error(`MAP_MISSING:${label}:${oldId}`);
  return mapped;
}

export async function importBonusPlansTables(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const [
    kpiGroups,
    kpiGroupProducts,
    kpiGroupAgents,
    bonusRules,
    bonusRuleConditions,
    planConfigs,
    planLevels,
    planLeaders,
    salesPlans,
    planTargets,
    kpiResults,
    priceMatrix
  ] = await Promise.all([
    readZipJson<Record<string, unknown>>(zip, "data/kpi_groups.json"),
    readZipJson<Record<string, unknown>>(zip, "data/kpi_group_products.json"),
    readZipJson<Record<string, unknown>>(zip, "data/kpi_group_agents.json"),
    readZipJson<Record<string, unknown>>(zip, "data/bonus_rules.json"),
    readZipJson<Record<string, unknown>>(zip, "data/bonus_rule_conditions.json"),
    readZipJson<Record<string, unknown>>(zip, "data/plan_approver_configs.json"),
    readZipJson<Record<string, unknown>>(zip, "data/plan_approver_levels.json"),
    readZipJson<Record<string, unknown>>(zip, "data/plan_approver_leaders.json"),
    readZipJson<Record<string, unknown>>(zip, "data/sales_kpi_plans.json"),
    readZipJson<Record<string, unknown>>(zip, "data/sales_kpi_plan_targets.json"),
    readZipJson<Record<string, unknown>>(zip, "data/kpi_results.json"),
    readZipJson<Record<string, unknown>>(zip, "data/price_matrix.json")
  ]);

  if (!kpiGroups.length && !bonusRules.length && !salesPlans.length) {
    return counts;
  }

  for (const row of kpiGroups) {
    const oldId = Number(row.id);
    const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
    const created = await tx.kpiGroup.create({
      data: {
        ...(data as Prisma.KpiGroupUncheckedCreateInput),
        tenant_id: tenantId
      }
    });
    maps.kpiGroup.set(oldId, created.id);
  }
  counts.kpi_groups = kpiGroups.length;

  for (const row of kpiGroupProducts) {
    const kpiGroupId = requireMap(maps, "kpiGroup", row.kpi_group_id, "kpi_group_product.kpi_group_id");
    const productId = requireMap(maps, "product", row.product_id, "kpi_group_product.product_id");
    if (kpiGroupId == null || productId == null) continue;
    await tx.kpiGroupProduct.create({
      data: { kpi_group_id: kpiGroupId, product_id: productId }
    });
  }
  counts.kpi_group_products = kpiGroupProducts.length;

  for (const row of kpiGroupAgents) {
    const kpiGroupId = requireMap(maps, "kpiGroup", row.kpi_group_id, "kpi_group_agent.kpi_group_id");
    const userId = requireMap(maps, "user", row.user_id, "kpi_group_agent.user_id");
    if (kpiGroupId == null || userId == null) continue;
    await tx.kpiGroupAgent.create({
      data: { kpi_group_id: kpiGroupId, user_id: userId }
    });
  }
  counts.kpi_group_agents = kpiGroupAgents.length;

  const bonusPrereqPending: Array<{ newId: number; oldPrereq: number[] }> = [];

  for (const row of bonusRules) {
    const oldId = Number(row.id);
    const data = hydrateDecimals(
      hydrateDates(stripIdTenant(row), ["valid_from", "valid_to", "created_at", "updated_at"]),
      ["min_sum", "discount_pct"]
    );
    const created = await tx.bonusRule.create({
      data: {
        ...(data as Prisma.BonusRuleUncheckedCreateInput),
        tenant_id: tenantId,
        product_ids: remapIntArray(maps.product, data.product_ids),
        bonus_product_ids: remapIntArray(maps.product, data.bonus_product_ids),
        product_category_ids: [],
        selected_client_ids: remapIntArray(maps.client, data.selected_client_ids),
        scope_agent_user_ids: remapIntArray(maps.user, data.scope_agent_user_ids),
        scope_trade_direction_ids: remapIntArray(maps.tradeDirection, data.scope_trade_direction_ids),
        prerequisite_rule_ids: []
      }
    });
    maps.bonusRule.set(oldId, created.id);
    if (Array.isArray(row.prerequisite_rule_ids) && row.prerequisite_rule_ids.length) {
      bonusPrereqPending.push({
        newId: created.id,
        oldPrereq: row.prerequisite_rule_ids.map(Number)
      });
    }
  }
  counts.bonus_rules = bonusRules.length;

  for (const item of bonusPrereqPending) {
    await tx.bonusRule.update({
      where: { id: item.newId },
      data: {
        prerequisite_rule_ids: remapIntArray(maps.bonusRule, item.oldPrereq)
      }
    });
  }

  for (const row of bonusRuleConditions) {
    const bonusRuleId = requireMap(maps, "bonusRule", row.bonus_rule_id, "bonus_condition.bonus_rule_id");
    if (bonusRuleId == null) continue;
    const data = hydrateDecimals(stripIdTenant(row), [
      "min_qty",
      "max_qty",
      "step_qty",
      "bonus_qty",
      "max_bonus_qty"
    ]);
    await tx.bonusRuleCondition.create({
      data: {
        ...(data as Prisma.BonusRuleConditionUncheckedCreateInput),
        bonus_rule_id: bonusRuleId
      }
    });
  }
  counts.bonus_rule_conditions = bonusRuleConditions.length;

  for (const row of planConfigs) {
    const oldId = Number(row.id);
    const directionId = requireMap(maps, "tradeDirection", row.direction_id, "plan_config.direction_id");
    const supervisorId = requireMap(maps, "user", row.supervisor_user_id, "plan_config.supervisor_user_id");
    if (directionId == null || supervisorId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
    const created = await tx.planApproverConfig.create({
      data: {
        ...(data as Prisma.PlanApproverConfigUncheckedCreateInput),
        tenant_id: tenantId,
        direction_id: directionId,
        supervisor_user_id: supervisorId
      }
    });
    maps.planApproverConfig.set(oldId, created.id);
  }
  counts.plan_approver_configs = planConfigs.length;

  for (const row of planLevels) {
    const configId = requireMap(maps, "planApproverConfig", row.config_id, "plan_level.config_id");
    if (configId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
    await tx.planApproverLevel.create({
      data: {
        ...(data as Prisma.PlanApproverLevelUncheckedCreateInput),
        tenant_id: tenantId,
        config_id: configId,
        approver_user_id: remapId(maps.user, data.approver_user_id) ?? null
      }
    });
  }
  counts.plan_approver_levels = planLevels.length;

  for (const row of planLeaders) {
    const leaderId = requireMap(maps, "user", row.leader_user_id, "plan_leader.leader_user_id");
    if (leaderId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
    await tx.planApproverLeader.create({
      data: {
        ...(data as Prisma.PlanApproverLeaderUncheckedCreateInput),
        tenant_id: tenantId,
        leader_user_id: leaderId
      }
    });
  }
  counts.plan_approver_leaders = planLeaders.length;

  for (const row of salesPlans) {
    const oldId = Number(row.id);
    const directionId = requireMap(maps, "tradeDirection", row.trade_direction_id, "sales_plan.trade_direction_id");
    const kpiGroupId = requireMap(maps, "kpiGroup", row.kpi_group_id, "sales_plan.kpi_group_id");
    if (directionId == null || kpiGroupId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["approved_at", "created_at", "updated_at"]);
    const created = await tx.salesKpiPlan.create({
      data: {
        ...(data as Prisma.SalesKpiPlanUncheckedCreateInput),
        tenant_id: tenantId,
        trade_direction_id: directionId,
        kpi_group_id: kpiGroupId,
        created_by: remapId(maps.user, data.created_by) ?? null,
        approved_by: remapId(maps.user, data.approved_by) ?? null
      }
    });
    maps.salesKpiPlan.set(oldId, created.id);
  }
  counts.sales_kpi_plans = salesPlans.length;

  for (const row of planTargets) {
    const planId = requireMap(maps, "salesKpiPlan", row.plan_id, "plan_target.plan_id");
    const userId = requireMap(maps, "user", row.user_id, "plan_target.user_id");
    if (planId == null || userId == null) continue;
    const data = hydrateDecimals(hydrateDates(stripIdTenant(row), ["updated_at"]), [
      "cost",
      "count",
      "volume",
      "acb"
    ]);
    await tx.salesKpiPlanTarget.create({
      data: {
        ...(data as Prisma.SalesKpiPlanTargetUncheckedCreateInput),
        tenant_id: tenantId,
        plan_id: planId,
        user_id: userId,
        updated_by: remapId(maps.user, data.updated_by) ?? null
      }
    });
  }
  counts.sales_kpi_plan_targets = planTargets.length;

  for (const row of kpiResults) {
    const userId = requireMap(maps, "user", row.user_id, "kpi_result.user_id");
    if (userId == null) continue;
    const data = hydrateDecimals(hydrateDates(stripIdTenant(row), ["calculated_at"]), [
      "value",
      "target",
      "score"
    ]);
    await tx.kpiResult.create({
      data: {
        ...(data as Prisma.KpiResultUncheckedCreateInput),
        tenant_id: tenantId,
        user_id: userId,
        kpi_group_id: remapId(maps.kpiGroup, data.kpi_group_id) ?? null
      }
    });
  }
  counts.kpi_results = kpiResults.length;

  for (const row of priceMatrix) {
    const productId = requireMap(maps, "product", row.product_id, "price_matrix.product_id");
    if (productId == null) continue;
    const data = hydrateDecimals(
      hydrateDates(stripIdTenant(row), ["valid_from", "valid_to", "created_at", "updated_at"]),
      ["price", "min_price", "max_price"]
    );
    await tx.priceMatrix.create({
      data: {
        ...(data as Prisma.PriceMatrixUncheckedCreateInput),
        tenant_id: tenantId,
        product_id: productId
      }
    });
  }
  counts.price_matrix = priceMatrix.length;

  return counts;
}
