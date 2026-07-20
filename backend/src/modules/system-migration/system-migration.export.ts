import JSZip from "jszip";
import { Prisma } from "@prisma/client";
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

function prismaErrorCode(e: unknown): string {
  if (e !== null && typeof e === "object" && "code" in e) {
    return String((e as { code?: unknown }).code ?? "");
  }
  return "";
}

/** Prod’da ba’zi jadvallar hali migrate bo‘lmagan bo‘lishi mumkin — eksport to‘liq yiqilmasin. */
async function safeFindMany<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (e) {
    const code = prismaErrorCode(e);
    // `instanceof` ba’zan Prisma package duplicate tufayli ishlamaydi — code bilan tekshiramiz.
    if (
      code === "P2021" ||
      code === "P2022" ||
      (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022"))
    ) {
      console.warn(`[system-migration.export] skip ${label}: ${code || "P202x"}`);
      return [];
    }
    throw e;
  }
}

async function loadReferenceTables(tenantId: number) {
  const [tradeDirections, salesChannels, warehouses, users, clients, products, cashDesks, stock] =
    await Promise.all([
      safeFindMany("trade_directions", () => prisma.tradeDirection.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("sales_channel_refs", () =>
        prisma.salesChannelRef.findMany({ where: { tenant_id: tenantId } })
      ),
      safeFindMany("warehouses", () => prisma.warehouse.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("users", () => prisma.user.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("clients", () => prisma.client.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("products", () => prisma.product.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("cash_desks", () => prisma.cashDesk.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("stock", () => prisma.stock.findMany({ where: { tenant_id: tenantId } }))
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
  const orders = await safeFindMany("orders", () =>
    prisma.order.findMany({ where: { tenant_id: tenantId } })
  );
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
      ? safeFindMany("order_items", () => prisma.orderItem.findMany({ where: { order_id: { in: orderIds } } }))
      : Promise.resolve([]),
    orderIds.length
      ? safeFindMany("order_status_logs", () =>
          prisma.orderStatusLog.findMany({ where: { order_id: { in: orderIds } } })
        )
      : Promise.resolve([]),
    orderIds.length
      ? safeFindMany("order_change_logs", () =>
          prisma.orderChangeLog.findMany({ where: { order_id: { in: orderIds } } })
        )
      : Promise.resolve([]),
    safeFindMany("payments", () => prisma.payment.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("goods_receipts", () => prisma.goodsReceipt.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("sales_returns", () => prisma.salesReturn.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("tenant_audit_events", () =>
      prisma.tenantAuditEvent.findMany({ where: { tenant_id: tenantId } })
    ),
    safeFindMany("client_audit_logs", () =>
      prisma.clientAuditLog.findMany({ where: { tenant_id: tenantId } })
    )
  ]);

  const receiptIds = goodsReceipts.map((r) => r.id);
  const returnIds = salesReturns.map((r) => r.id);

  const [goodsReceiptLines, salesReturnLines] = await Promise.all([
    receiptIds.length
      ? safeFindMany("goods_receipt_lines", () =>
          prisma.goodsReceiptLine.findMany({ where: { receipt_id: { in: receiptIds } } })
        )
      : Promise.resolve([]),
    returnIds.length
      ? safeFindMany("sales_return_lines", () =>
          prisma.salesReturnLine.findMany({ where: { return_id: { in: returnIds } } })
        )
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
      safeFindMany("client_refusals", () =>
        prisma.clientRefusal.findMany({ where: { tenant_id: tenantId } })
      ),
      safeFindMany("agent_visits", () => prisma.agentVisit.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("agent_location_pings", () =>
        prisma.agentLocationPing.findMany({ where: { tenant_id: tenantId } })
      ),
      safeFindMany("expenses", () => prisma.expense.findMany({ where: { tenant_id: tenantId } })),
      safeFindMany("payment_allocations", () =>
        prisma.paymentAllocation.findMany({ where: { tenant_id: tenantId } })
      )
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
  const kpiGroups = await safeFindMany("kpi_groups", () =>
    prisma.kpiGroup.findMany({ where: { tenant_id: tenantId } })
  );
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
      ? safeFindMany("kpi_group_products", () =>
          prisma.kpiGroupProduct.findMany({ where: { kpi_group_id: { in: kpiGroupIds } } })
        )
      : Promise.resolve([]),
    kpiGroupIds.length
      ? safeFindMany("kpi_group_agents", () =>
          prisma.kpiGroupAgent.findMany({ where: { kpi_group_id: { in: kpiGroupIds } } })
        )
      : Promise.resolve([]),
    safeFindMany("bonus_rules", () => prisma.bonusRule.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("plan_approver_configs", () =>
      prisma.planApproverConfig.findMany({ where: { tenant_id: tenantId } })
    ),
    safeFindMany("plan_approver_leaders", () =>
      prisma.planApproverLeader.findMany({ where: { tenant_id: tenantId } })
    ),
    safeFindMany("sales_kpi_plans", () => prisma.salesKpiPlan.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("kpi_results", () => prisma.kpiResult.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("price_matrix", () => prisma.priceMatrix.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("client_photo_reports", () =>
      prisma.clientPhotoReport.findMany({ where: { tenant_id: tenantId } })
    )
  ]);

  const bonusRuleIds = bonusRules.map((r) => r.id);
  const configIds = planConfigs.map((c) => c.id);
  const planIds = salesPlans.map((p) => p.id);

  const [bonusRuleConditions, planLevels, planTargets] = await Promise.all([
    bonusRuleIds.length
      ? safeFindMany("bonus_rule_conditions", () =>
          prisma.bonusRuleCondition.findMany({ where: { bonus_rule_id: { in: bonusRuleIds } } })
        )
      : Promise.resolve([]),
    configIds.length
      ? safeFindMany("plan_approver_levels", () =>
          prisma.planApproverLevel.findMany({ where: { config_id: { in: configIds } } })
        )
      : Promise.resolve([]),
    planIds.length
      ? safeFindMany("sales_kpi_plan_targets", () =>
          prisma.salesKpiPlanTarget.findMany({ where: { plan_id: { in: planIds } } })
        )
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
  // Oddiy .zip — brauzer accept/MIME bilan yaxshi moslashadi (.salec-backup.zip ba’zan rad etilardi).
  return `salec-backup-${tenantSlug}-${date}.zip`;
}
