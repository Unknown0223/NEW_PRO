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
import { PHOTO_REPORT_EXPORT_DAYS, photoReportExportCutoff } from "./system-migration.import.files";
import { splitPhotoReportsForZip } from "./system-migration.photo-zip";
import {
  loadTenantSettingsExtra,
  SETTINGS_EXTRA_JSON_PATH
} from "./system-migration.import.settings-extra";
import { jsonFileContent } from "./system-migration.serialize";

type ExportContext = {
  tenantId: number;
  tenantSlug: string;
};

/** Postgres/Prisma bind-param limtidan saqlanish (katta `IN (...)`). */
const IN_CHUNK = 4000;

function prismaErrorCode(e: unknown): string {
  if (e !== null && typeof e === "object" && "code" in e) {
    return String((e as { code?: unknown }).code ?? "");
  }
  return "";
}

function isSkippableSchemaError(e: unknown): boolean {
  const code = prismaErrorCode(e);
  if (code === "P2021" || code === "P2022") return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
    return true;
  }
  return false;
}

/** Prod’da ba’zi jadvallar hali migrate bo‘lmagan bo‘lishi mumkin — eksport to‘liq yiqilmasin. */
async function safeFindMany<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (e) {
    if (isSkippableSchemaError(e)) {
      console.warn(`[system-migration.export] skip ${label}: ${prismaErrorCode(e) || "P202x"}`);
      return [];
    }
    throw e;
  }
}

async function safeFindManyByIds<T>(
  label: string,
  ids: number[],
  runChunk: (chunk: number[]) => Promise<T[]>
): Promise<T[]> {
  if (!ids.length) return [];
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const rows = await safeFindMany(`${label}[${i}-${i + chunk.length}]`, () => runChunk(chunk));
    out.push(...rows);
  }
  return out;
}

async function loadReferenceTables(
  tenantId: number,
  onProgress?: (message: string) => void
) {
  onProgress?.("Spravochniklar: ombor / user…");
  const [tradeDirections, salesChannels, warehouses, users] = await Promise.all([
    safeFindMany("trade_directions", () => prisma.tradeDirection.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("sales_channel_refs", () =>
      prisma.salesChannelRef.findMany({ where: { tenant_id: tenantId } })
    ),
    safeFindMany("warehouses", () => prisma.warehouse.findMany({ where: { tenant_id: tenantId } })),
    safeFindMany("users", () => prisma.user.findMany({ where: { tenant_id: tenantId } }))
  ]);

  // 10k+ mijoz — boshqa jadvallar bilan parallel emas (RAM cho‘qqisi).
  onProgress?.("Spravochniklar: mijozlar…");
  const clients = await safeFindMany("clients", () =>
    prisma.client.findMany({ where: { tenant_id: tenantId } })
  );

  onProgress?.("Spravochniklar: mahsulot / kassa / stock…");
  const [products, cashDesks, stock] = await Promise.all([
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
    safeFindManyByIds("order_items", orderIds, (chunk) =>
      prisma.orderItem.findMany({ where: { order_id: { in: chunk } } })
    ),
    safeFindManyByIds("order_status_logs", orderIds, (chunk) =>
      prisma.orderStatusLog.findMany({ where: { order_id: { in: chunk } } })
    ),
    safeFindManyByIds("order_change_logs", orderIds, (chunk) =>
      prisma.orderChangeLog.findMany({ where: { order_id: { in: chunk } } })
    ),
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
    safeFindManyByIds("goods_receipt_lines", receiptIds, (chunk) =>
      prisma.goodsReceiptLine.findMany({ where: { receipt_id: { in: chunk } } })
    ),
    safeFindManyByIds("sales_return_lines", returnIds, (chunk) =>
      prisma.salesReturnLine.findMany({ where: { return_id: { in: chunk } } })
    )
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

/** GPS pinglar — sahifalab yuklash (katta tenantda OOM oldini olish). */
async function loadAllAgentLocationPings(tenantId: number) {
  const PAGE = 5_000;
  const all: Awaited<ReturnType<typeof prisma.agentLocationPing.findMany>> = [];
  let lastId = 0;
  const cutoff = photoReportExportCutoff();
  for (;;) {
    const page = await safeFindMany("agent_location_pings_page", () =>
      prisma.agentLocationPing.findMany({
        where: {
          tenant_id: tenantId,
          id: { gt: lastId },
          ...(cutoff ? { recorded_at: { gte: cutoff } } : {})
        },
        orderBy: { id: "asc" },
        take: PAGE
      })
    );
    if (!page.length) break;
    lastId = page[page.length - 1]!.id;
    all.push(...page);
  }
  return all;
}

async function loadFieldActivityTables(tenantId: number) {
  const [clientRefusals, agentVisits, agentLocationPings, expenses, paymentAllocations] =
    await Promise.all([
      safeFindMany("client_refusals", () =>
        prisma.clientRefusal.findMany({ where: { tenant_id: tenantId } })
      ),
      safeFindMany("agent_visits", () => prisma.agentVisit.findMany({ where: { tenant_id: tenantId } })),
      loadAllAgentLocationPings(tenantId),
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
    bonusStrategies
  ] = await Promise.all([
    safeFindManyByIds("kpi_group_products", kpiGroupIds, (chunk) =>
      prisma.kpiGroupProduct.findMany({ where: { kpi_group_id: { in: chunk } } })
    ),
    safeFindManyByIds("kpi_group_agents", kpiGroupIds, (chunk) =>
      prisma.kpiGroupAgent.findMany({ where: { kpi_group_id: { in: chunk } } })
    ),
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
    safeFindMany("bonus_strategies", () =>
      prisma.bonusStrategy.findMany({ where: { tenant_id: tenantId } })
    )
  ]);

  const bonusRuleIds = bonusRules.map((r) => r.id);
  const configIds = planConfigs.map((c) => c.id);
  const planIds = salesPlans.map((p) => p.id);
  const strategyIds = bonusStrategies.map((s) => s.id);

  const [bonusRuleClauses, bonusRuleConditions, planLevels, planTargets, bonusStrategyMembers] =
    await Promise.all([
      safeFindManyByIds("bonus_rule_clauses", bonusRuleIds, (chunk) =>
        prisma.bonusRuleClause.findMany({ where: { bonus_rule_id: { in: chunk } } })
      ),
      safeFindManyByIds("bonus_rule_conditions", bonusRuleIds, (chunk) =>
        prisma.bonusRuleCondition.findMany({ where: { bonus_rule_id: { in: chunk } } })
      ),
      safeFindManyByIds("plan_approver_levels", configIds, (chunk) =>
        prisma.planApproverLevel.findMany({ where: { config_id: { in: chunk } } })
      ),
      safeFindManyByIds("sales_kpi_plan_targets", planIds, (chunk) =>
        prisma.salesKpiPlanTarget.findMany({ where: { plan_id: { in: chunk } } })
      ),
      safeFindManyByIds("bonus_strategy_members", strategyIds, (chunk) =>
        prisma.bonusStrategyMember.findMany({ where: { strategy_id: { in: chunk } } })
      )
    ]);

  return {
    kpi_groups: kpiGroups,
    kpi_group_products: kpiGroupProducts,
    kpi_group_agents: kpiGroupAgents,
    bonus_rules: bonusRules,
    bonus_rule_clauses: bonusRuleClauses,
    bonus_rule_conditions: bonusRuleConditions,
    plan_approver_configs: planConfigs,
    plan_approver_levels: planLevels,
    plan_approver_leaders: planLeaders,
    sales_kpi_plans: salesPlans,
    sales_kpi_plan_targets: planTargets,
    kpi_results: kpiResults,
    price_matrix: priceMatrix,
    bonus_strategies: bonusStrategies,
    bonus_strategy_members: bonusStrategyMembers
  };
}

/** Fotootchyotlar: 40 tadan chunk — barcha base64 birga RAM ga sig‘masin. */
async function appendClientPhotoReportsToZip(
  zip: JSZip,
  tenantId: number
): Promise<{ exported_count: number; binary_files: number; stripped_unreadable: number }> {
  const PAGE = 40;
  const metaRows: Array<Record<string, unknown> & { id: number; image_url: string }> = [];
  let binaryFiles = 0;
  let stripped = 0;
  let lastId = 0;

  const cutoff = photoReportExportCutoff();
  for (;;) {
    const page = await safeFindMany("client_photo_reports_page", () =>
      prisma.clientPhotoReport.findMany({
        where: {
          tenant_id: tenantId,
          id: { gt: lastId },
          ...(cutoff ? { created_at: { gte: cutoff } } : {})
        },
        orderBy: { id: "asc" },
        take: PAGE
      })
    );
    if (!page.length) break;
    lastId = page[page.length - 1]!.id;

    const split = await splitPhotoReportsForZip(
      page as Array<Record<string, unknown> & { id: number; image_url: string }>
    );
    metaRows.push(...split.rows);
    stripped += split.strippedCount;
    for (const bin of split.binaries) {
      // JPEG allaqachon siqilgan — DEFLATE faqat sekinlashtiradi.
      zip.file(bin.path, bin.buffer, { compression: "STORE" });
      binaryFiles += 1;
    }
  }

  zip.file("data/client_photo_reports.json", jsonFileContent(metaRows));
  return {
    exported_count: metaRows.length,
    binary_files: binaryFiles,
    stripped_unreadable: stripped
  };
}

async function buildMigrationSetupXlsx(tenantId: number): Promise<{ buf: Buffer; note?: string }> {
  try {
    const buf = await buildInitialSetupExportBuffer(tenantId, { liteForMigration: true });
    return { buf };
  } catch (e) {
    if (e instanceof Error && e.message === "EMPTY_EXPORT") {
      // Minimal workbook — ZIP ichida fayl bo‘lishi uchun
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("README");
      ws.getCell("A1").value =
        "Initial setup sheets empty — katalog ma’lumotlari data/*.json da.";
      const buf = Buffer.from(await wb.xlsx.writeBuffer());
      return { buf, note: "initial_setup_xlsx_empty_stub" };
    }
    console.warn(
      "[system-migration.export] initial-setup xlsx failed — stub used:",
      e instanceof Error ? e.message : e
    );
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("README");
    ws.getCell("A1").value = `Initial setup export skipped: ${
      e instanceof Error ? e.message : "error"
    }. Full data is in data/*.json.`;
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return { buf, note: "initial_setup_xlsx_error_stub" };
  }
}

type ExportProgressFn = (p: { stage: string; percent: number; message: string }) => void;

export async function buildTenantBackupZip(
  ctx: ExportContext,
  onProgress?: ExportProgressFn
): Promise<Buffer> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) throw new Error("NOT_FOUND");

  const report = (stage: string, percent: number, message: string) => {
    onProgress?.({ stage, percent, message });
  };

  // Avval yengil meta, keyin og‘ir jadvallar — pool/RAM cho‘qqisini pasaytiradi.
  report("meta", 5, "Profil va inventar…");
  const [inventory, profile, settingsExtra, xlsxResult] = await Promise.all([
    getMigrationInventory(ctx.tenantId),
    getTenantProfile(ctx.tenantId),
    loadTenantSettingsExtra(ctx.tenantId),
    buildMigrationSetupXlsx(ctx.tenantId)
  ]);

  report("references", 15, "Spravochniklar…");
  const references = await loadReferenceTables(ctx.tenantId, (m) => report("references", 20, m));

  report("transactional", 35, "Buyurtmalar / to‘lovlar…");
  const tables = await loadTransactionalTables(ctx.tenantId);

  report("bonus", 50, "Bonus / KPI…");
  const bonusAndFiles = await loadBonusAndFilesTables(ctx.tenantId);

  report("extended", 60, "Kengaytirilgan jadvallar…");
  const extended = await loadExtendedTables(ctx.tenantId);

  const zip = new JSZip();

  // Fotolar alohida (chunked) — base64 OOM oldini olish.
  report("photos", 70, "Fotootchyotlar…");
  const photoStats = await appendClientPhotoReportsToZip(zip, ctx.tenantId);

  const retentionDays = PHOTO_REPORT_EXPORT_DAYS > 0 ? PHOTO_REPORT_EXPORT_DAYS : null;
  const exportNotes = [
    ...(xlsxResult.note ? [xlsxResult.note] : []),
    ...(photoStats.binary_files ? [`photo_binaries:${photoStats.binary_files}`] : []),
    ...(photoStats.stripped_unreadable
      ? [`photo_stripped_unreadable:${photoStats.stripped_unreadable}`]
      : []),
    retentionDays
      ? `agent_location_pings:last_${retentionDays}_days`
      : "agent_location_pings:full",
    retentionDays ? `client_photo_reports:last_${retentionDays}_days` : "client_photo_reports:full"
  ];

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
    photo_reports: {
      retention_days: retentionDays,
      exported_count: photoStats.exported_count,
      binary_files: photoStats.binary_files,
      stripped_unreadable: photoStats.stripped_unreadable,
      note_uz: retentionDays
        ? `Oxirgi ${retentionDays} kunlik fotootchyotlar; files/client_photos/* (JPEG ≤1280px); import oxirida.`
        : "Barcha fotootchyotlar; files/client_photos/* (JPEG ≤1280px); import oxirida."
    },
    export_notes: exportNotes,
    files: {
      spravochniki: [PROFILE_JSON_PATH, SETTINGS_EXTRA_JSON_PATH, INITIAL_SETUP_XLSX_PATH],
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
        "data/bonus_rule_clauses.json",
        "data/bonus_rule_conditions.json",
        "data/bonus_strategies.json",
        "data/bonus_strategy_members.json",
        "data/sales_kpi_plans.json",
        "data/client_photo_reports.json",
        ...extendedDataFilePaths()
      ]
    },
    import_support: {
      spravochniki: {
        profile_json: true,
        settings_extra_json: true,
        reference_json: true,
        initial_setup_xlsx: true
      },
      transactional: { supported: true, phase: 2 },
      field_activity: { supported: true, phase: 3 },
      bonus_plans: { supported: true, phase: 4 },
      files: {
        supported: true,
        phase: 5,
        after: "extended",
        retention_days: retentionDays
      },
      extended: { supported: true, phase: 4, tables: extendedDataFilePaths().length }
    }
  };

  zip.file(MANIFEST_PATH, jsonFileContent(manifest));
  zip.file(PROFILE_JSON_PATH, jsonFileContent(profile));
  zip.file(SETTINGS_EXTRA_JSON_PATH, jsonFileContent(settingsExtra));
  zip.file(INITIAL_SETUP_XLSX_PATH, xlsxResult.buf);

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
      "Import: bo'sh tenantga to'liq import yoki to'ldirilgan tenantga «almashtirish» (replace).",
      "Format v6: to'liq zaxira — multi-slot, bonus strategiya, bank inbox, katalog/RBAC.",
      "Fotolar: barcha client_photo_reports → files/client_photos/* (siqilgan JPEG).",
      "GPS: barcha agent_location_pings (data/agent_location_pings.json).",
      ""
    ].join("\n")
  );

  report("zip", 90, "ZIP yig‘ilmoqda…");
  // level 1: JSON tez; fotolar allaqachon STORE.
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
    streamFiles: true
  });
}

/** ZIP ni diskka yozadi — HTTP javobida butun buffer ushlab turmaslik uchun. */
export async function buildTenantBackupZipToFile(
  ctx: ExportContext,
  outPath: string,
  onProgress?: ExportProgressFn
): Promise<{ byteLength: number; filename: string }> {
  const { writeFile } = await import("fs/promises");
  const buf = await buildTenantBackupZip(ctx, onProgress);
  await writeFile(outPath, buf);
  onProgress?.({ stage: "done", percent: 100, message: "Zaxira tayyor" });
  return { byteLength: buf.length, filename: backupDownloadFilename(ctx.tenantSlug) };
}

export function backupDownloadFilename(tenantSlug: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `salec-backup-${tenantSlug}-${date}.zip`;
}
