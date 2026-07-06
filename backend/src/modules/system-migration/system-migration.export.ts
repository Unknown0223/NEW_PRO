import JSZip from "jszip";
import { prisma } from "../../config/database";
import { buildInitialSetupExportBuffer } from "../tenant-settings/initial-setup-export.service";
import { getTenantProfile } from "../tenant-settings/tenant-settings.service";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_KIND,
  INITIAL_SETUP_XLSX_PATH,
  MANIFEST_PATH,
  PROFILE_JSON_PATH
} from "./system-migration.constants";
import { getMigrationInventory } from "./system-migration.inventory";
import { extendedDataFilePaths, loadExtendedTables } from "./system-migration.extended.export";
import { jsonFileContent } from "./system-migration.serialize";

type ExportContext = {
  tenantId: number;
  tenantSlug: string;
};

async function loadReferenceTables(tenantId: number) {
  const [tradeDirections, salesChannels, warehouses, users, clients, products, cashDesks, stock] =
    await Promise.all([
      prisma.tradeDirection.findMany({ where: { tenant_id: tenantId } }),
      prisma.salesChannelRef.findMany({ where: { tenant_id: tenantId } }),
      prisma.warehouse.findMany({ where: { tenant_id: tenantId } }),
      prisma.user.findMany({ where: { tenant_id: tenantId } }),
      prisma.client.findMany({ where: { tenant_id: tenantId } }),
      prisma.product.findMany({ where: { tenant_id: tenantId } }),
      prisma.cashDesk.findMany({ where: { tenant_id: tenantId } }),
      prisma.stock.findMany({ where: { tenant_id: tenantId } })
    ]);
  return {
    trade_directions: tradeDirections,
    sales_channel_refs: salesChannels,
    warehouses,
    users,
    clients,
    products,
    cash_desks: cashDesks,
    stock
  };
}

async function loadTransactionalTables(tenantId: number) {
  const orders = await prisma.order.findMany({ where: { tenant_id: tenantId } });
  const orderIds = orders.map((o) => o.id);

  const [
    orderItems,
    orderStatusLogs,
    orderChangeLogs,
    payments,
    goodsReceipts,
    salesReturns,
    auditEvents,
    clientAuditLogs
  ] = await Promise.all([
    orderIds.length
      ? prisma.orderItem.findMany({ where: { order_id: { in: orderIds } } })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.orderStatusLog.findMany({ where: { order_id: { in: orderIds } } })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.orderChangeLog.findMany({ where: { order_id: { in: orderIds } } })
      : Promise.resolve([]),
    prisma.payment.findMany({ where: { tenant_id: tenantId } }),
    prisma.goodsReceipt.findMany({ where: { tenant_id: tenantId } }),
    prisma.salesReturn.findMany({ where: { tenant_id: tenantId } }),
    prisma.tenantAuditEvent.findMany({ where: { tenant_id: tenantId } }),
    prisma.clientAuditLog.findMany({ where: { tenant_id: tenantId } })
  ]);

  const receiptIds = goodsReceipts.map((r) => r.id);
  const returnIds = salesReturns.map((r) => r.id);

  const [goodsReceiptLines, salesReturnLines] = await Promise.all([
    receiptIds.length
      ? prisma.goodsReceiptLine.findMany({ where: { receipt_id: { in: receiptIds } } })
      : Promise.resolve([]),
    returnIds.length
      ? prisma.salesReturnLine.findMany({ where: { return_id: { in: returnIds } } })
      : Promise.resolve([])
  ]);

  return {
    orders,
    order_items: orderItems,
    order_status_logs: orderStatusLogs,
    order_change_logs: orderChangeLogs,
    payments,
    goods_receipts: goodsReceipts,
    goods_receipt_lines: goodsReceiptLines,
    sales_returns: salesReturns,
    sales_return_lines: salesReturnLines,
    tenant_audit_events: auditEvents,
    client_audit_logs: clientAuditLogs,
    ...(await loadFieldActivityTables(tenantId))
  };
}

async function loadFieldActivityTables(tenantId: number) {
  const [clientRefusals, agentVisits, agentLocationPings, expenses, paymentAllocations] =
    await Promise.all([
      prisma.clientRefusal.findMany({ where: { tenant_id: tenantId } }),
      prisma.agentVisit.findMany({ where: { tenant_id: tenantId } }),
      prisma.agentLocationPing.findMany({ where: { tenant_id: tenantId } }),
      prisma.expense.findMany({ where: { tenant_id: tenantId } }),
      prisma.paymentAllocation.findMany({ where: { tenant_id: tenantId } })
    ]);
  return {
    client_refusals: clientRefusals,
    agent_visits: agentVisits,
    agent_location_pings: agentLocationPings,
    expenses,
    payment_allocations: paymentAllocations
  };
}

async function loadBonusAndFilesTables(tenantId: number) {
  const kpiGroups = await prisma.kpiGroup.findMany({ where: { tenant_id: tenantId } });
  const kpiGroupIds = kpiGroups.map((g) => g.id);

  const [
    kpiGroupProducts,
    kpiGroupAgents,
    bonusRules,
    planConfigs,
    planLeaders,
    salesPlans,
    kpiResults,
    priceMatrix,
    clientPhotoReports
  ] = await Promise.all([
    kpiGroupIds.length
      ? prisma.kpiGroupProduct.findMany({ where: { kpi_group_id: { in: kpiGroupIds } } })
      : Promise.resolve([]),
    kpiGroupIds.length
      ? prisma.kpiGroupAgent.findMany({ where: { kpi_group_id: { in: kpiGroupIds } } })
      : Promise.resolve([]),
    prisma.bonusRule.findMany({ where: { tenant_id: tenantId } }),
    prisma.planApproverConfig.findMany({ where: { tenant_id: tenantId } }),
    prisma.planApproverLeader.findMany({ where: { tenant_id: tenantId } }),
    prisma.salesKpiPlan.findMany({ where: { tenant_id: tenantId } }),
    prisma.kpiResult.findMany({ where: { tenant_id: tenantId } }),
    prisma.priceMatrix.findMany({ where: { tenant_id: tenantId } }),
    prisma.clientPhotoReport.findMany({ where: { tenant_id: tenantId } })
  ]);

  const bonusRuleIds = bonusRules.map((r) => r.id);
  const configIds = planConfigs.map((c) => c.id);
  const planIds = salesPlans.map((p) => p.id);

  const [bonusRuleConditions, planLevels, planTargets] = await Promise.all([
    bonusRuleIds.length
      ? prisma.bonusRuleCondition.findMany({ where: { bonus_rule_id: { in: bonusRuleIds } } })
      : Promise.resolve([]),
    configIds.length
      ? prisma.planApproverLevel.findMany({ where: { config_id: { in: configIds } } })
      : Promise.resolve([]),
    planIds.length
      ? prisma.salesKpiPlanTarget.findMany({ where: { plan_id: { in: planIds } } })
      : Promise.resolve([])
  ]);

  return {
    kpi_groups: kpiGroups,
    kpi_group_products: kpiGroupProducts,
    kpi_group_agents: kpiGroupAgents,
    bonus_rules: bonusRules,
    bonus_rule_conditions: bonusRuleConditions,
    plan_approver_configs: planConfigs,
    plan_approver_levels: planLevels,
    plan_approver_leaders: planLeaders,
    sales_kpi_plans: salesPlans,
    sales_kpi_plan_targets: planTargets,
    kpi_results: kpiResults,
    price_matrix: priceMatrix,
    client_photo_reports: clientPhotoReports
  };
}

export async function buildTenantBackupZip(ctx: ExportContext): Promise<Buffer> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) throw new Error("NOT_FOUND");

  const [inventory, profile, xlsxBuf, references, tables, bonusAndFiles, extended] = await Promise.all([
    getMigrationInventory(ctx.tenantId),
    getTenantProfile(ctx.tenantId),
    buildInitialSetupExportBuffer(ctx.tenantId),
    loadReferenceTables(ctx.tenantId),
    loadTransactionalTables(ctx.tenantId),
    loadBonusAndFilesTables(ctx.tenantId),
    loadExtendedTables(ctx.tenantId)
  ]);

  const manifest = {
    format_version: BACKUP_FORMAT_VERSION,
    kind: BACKUP_KIND,
    exported_at: new Date().toISOString(),
    source: {
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name
    },
    modules: inventory.modules,
    files: {
      spravochniki: [PROFILE_JSON_PATH, INITIAL_SETUP_XLSX_PATH],
      data: [
        "data/warehouses.json",
        "data/trade_directions.json",
        "data/sales_channel_refs.json",
        "data/users.json",
        "data/clients.json",
        "data/products.json",
        "data/cash_desks.json",
        "data/stock.json",
        "data/orders.json",
        "data/order_items.json",
        "data/order_status_logs.json",
        "data/order_change_logs.json",
        "data/payments.json",
        "data/goods_receipts.json",
        "data/goods_receipt_lines.json",
        "data/sales_returns.json",
        "data/sales_return_lines.json",
        "data/tenant_audit_events.json",
        "data/client_audit_logs.json",
        "data/client_refusals.json",
        "data/agent_visits.json",
        "data/agent_location_pings.json",
        "data/expenses.json",
        "data/payment_allocations.json",
        "data/kpi_groups.json",
        "data/bonus_rules.json",
        "data/sales_kpi_plans.json",
        "data/client_photo_reports.json",
        ...extendedDataFilePaths()
      ]
    },
    import_support: {
      spravochniki: { profile_json: true, reference_json: true, initial_setup_xlsx: true },
      transactional: { supported: true, phase: 2 },
      field_activity: { supported: true, phase: 3 },
      bonus_plans: { supported: true, phase: 4 },
      files: { supported: true, phase: 4 },
      extended: { supported: true, phase: 4, tables: extendedDataFilePaths().length }
    }
  };

  const zip = new JSZip();
  zip.file(MANIFEST_PATH, jsonFileContent(manifest));
  zip.file(PROFILE_JSON_PATH, jsonFileContent(profile));
  zip.file(INITIAL_SETUP_XLSX_PATH, xlsxBuf);

  for (const [name, rows] of Object.entries(references)) {
    zip.file(`data/${name}.json`, jsonFileContent(rows));
  }

  for (const [name, rows] of Object.entries(tables)) {
    zip.file(`data/${name}.json`, jsonFileContent(rows));
  }

  for (const [name, rows] of Object.entries(bonusAndFiles)) {
    zip.file(`data/${name}.json`, jsonFileContent(rows));
  }

  for (const [name, rows] of Object.entries(extended)) {
    zip.file(`data/${name}.json`, jsonFileContent(rows));
  }

  zip.file(
    "README.txt",
    [
      "SALEC tenant backup",
      `Exported: ${manifest.exported_at}`,
      `Source tenant: ${tenant.slug}`,
      "",
      "Import: bo'sh tenantga to'liq import (profil + spravochniklar + operatsion tarix).",
      "Format v5: to'liq zaxira — katalog, RBAC, bog'lanishlar, balans va qo'shimcha tarix.",
      ""
    ].join("\n")
  );

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}

export function backupDownloadFilename(tenantSlug: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `salec-backup-${tenantSlug}-${date}.salec-backup.zip`;
}
