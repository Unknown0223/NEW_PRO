import { prisma } from "../../config/database";
import { MIGRATION_MODULES } from "./system-migration.constants";

export type MigrationInventoryRow = {
  id: string;
  label_uz: string;
  label_ru: string;
  phase: number;
  export_status: string;
  import_status: string;
  import_note_uz?: string;
  counts: Record<string, number>;
};

async function countOrderItems(tenantId: number): Promise<number> {
  return prisma.orderItem.count({ where: { order: { tenant_id: tenantId } } });
}

async function countGoodsReceiptLines(tenantId: number): Promise<number> {
  return prisma.goodsReceiptLine.count({
    where: { receipt: { tenant_id: tenantId } }
  });
}

async function countSalesReturnLines(tenantId: number): Promise<number> {
  return prisma.salesReturnLine.count({
    where: { return: { tenant_id: tenantId } }
  });
}

export async function getMigrationInventory(tenantId: number): Promise<{
  tenant_id: number;
  generated_at: string;
  modules: MigrationInventoryRow[];
  totals: { records: number };
}> {
  const [
    clients,
    products,
    users,
    warehouses,
    stockRows,
    orders,
    orderItems,
    payments,
    goodsReceipts,
    goodsReceiptLines,
    salesReturns,
    salesReturnLines,
    auditEvents,
    clientAuditLogs,
    refusals,
    agentVisits,
    agentPings,
    expenses,
    paymentAllocations,
    kpiGroups,
    bonusRules,
    salesKpiPlans,
    clientPhotoReports,
    productCategories,
    productPrices,
    suppliers,
    territories,
    roles,
    permissions,
    workSlots,
    clientBalances,
    supplierPayments,
    warehouseCorrections,
    stockTakes,
    tenantTasks,
    inAppNotifications
  ] = await Promise.all([
    prisma.client.count({ where: { tenant_id: tenantId } }),
    prisma.product.count({ where: { tenant_id: tenantId } }),
    prisma.user.count({ where: { tenant_id: tenantId } }),
    prisma.warehouse.count({ where: { tenant_id: tenantId } }),
    prisma.stock.count({ where: { tenant_id: tenantId } }),
    prisma.order.count({ where: { tenant_id: tenantId } }),
    countOrderItems(tenantId),
    prisma.payment.count({ where: { tenant_id: tenantId } }),
    prisma.goodsReceipt.count({ where: { tenant_id: tenantId } }),
    countGoodsReceiptLines(tenantId),
    prisma.salesReturn.count({ where: { tenant_id: tenantId } }),
    countSalesReturnLines(tenantId),
    prisma.tenantAuditEvent.count({ where: { tenant_id: tenantId } }),
    prisma.clientAuditLog.count({ where: { tenant_id: tenantId } }),
    prisma.clientRefusal.count({ where: { tenant_id: tenantId } }),
    prisma.agentVisit.count({ where: { tenant_id: tenantId } }),
    prisma.agentLocationPing.count({ where: { tenant_id: tenantId } }),
    prisma.expense.count({ where: { tenant_id: tenantId } }),
    prisma.paymentAllocation.count({ where: { tenant_id: tenantId } }),
    prisma.kpiGroup.count({ where: { tenant_id: tenantId } }),
    prisma.bonusRule.count({ where: { tenant_id: tenantId } }),
    prisma.salesKpiPlan.count({ where: { tenant_id: tenantId } }),
    prisma.clientPhotoReport.count({ where: { tenant_id: tenantId } }),
    prisma.productCategory.count({ where: { tenant_id: tenantId } }),
    prisma.productPrice.count({ where: { tenant_id: tenantId } }),
    prisma.supplier.count({ where: { tenant_id: tenantId } }),
    prisma.territory.count({ where: { tenant_id: tenantId } }),
    prisma.role.count({ where: { tenant_id: tenantId } }),
    prisma.permission.count({ where: { tenant_id: tenantId } }),
    prisma.workSlot.count({ where: { tenant_id: tenantId } }),
    prisma.clientBalance.count({ where: { tenant_id: tenantId } }),
    prisma.supplierPayment.count({ where: { tenant_id: tenantId } }),
    prisma.warehouseCorrection.count({ where: { tenant_id: tenantId } }),
    prisma.stockTake.count({ where: { tenant_id: tenantId } }),
    prisma.tenantTask.count({ where: { tenant_id: tenantId } }),
    prisma.inAppNotification.count({ where: { tenant_id: tenantId } })
  ]);

  const countByModule: Record<string, Record<string, number>> = {
    profile: { profile: 1 },
    initial_setup: {
      territories,
      product_categories: productCategories,
      product_prices: productPrices,
      work_slots: workSlots,
      warehouses,
      initial_setup_xlsx: 1
    },
    spravochniki: { clients, products, users, warehouses, stock: stockRows },
    orders: { orders, order_items: orderItems },
    payments: { payments },
    warehouse: { goods_receipts: goodsReceipts, goods_receipt_lines: goodsReceiptLines },
    returns: { sales_returns: salesReturns, sales_return_lines: salesReturnLines },
    audit: { tenant_audit_events: auditEvents, client_audit_logs: clientAuditLogs },
    refusals: { client_refusals: refusals },
    visits: { agent_visits: agentVisits, agent_location_pings: agentPings },
    expenses: { expenses, payment_allocations: paymentAllocations },
    bonus_plans: { kpi_groups: kpiGroups, bonus_rules: bonusRules, sales_kpi_plans: salesKpiPlans },
    files: { client_photo_reports: clientPhotoReports },
    extended: {
      product_categories: productCategories,
      product_prices: productPrices,
      suppliers,
      territories,
      roles,
      permissions,
      work_slots: workSlots,
      client_balances: clientBalances,
      supplier_payments: supplierPayments,
      warehouse_corrections: warehouseCorrections,
      stock_takes: stockTakes,
      tenant_tasks: tenantTasks,
      in_app_notifications: inAppNotifications
    }
  };

  const modules: MigrationInventoryRow[] = MIGRATION_MODULES.map((m) => ({
    id: m.id,
    label_uz: m.label_uz,
    label_ru: m.label_ru,
    phase: m.phase,
    export_status: m.export_status,
    import_status: m.import_status,
    import_note_uz: m.import_note_uz,
    counts: countByModule[m.id] ?? {}
  }));

  const totals = {
    records: modules.reduce(
      (sum, m) => sum + Object.values(m.counts).reduce((a, b) => a + b, 0),
      0
    )
  };

  return {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    modules,
    totals
  };
}

export async function isTargetTenantEmptyForImport(tenantId: number): Promise<{
  empty: boolean;
  blockers: Record<string, number>;
}> {
  const [orders, payments, clients, products] = await Promise.all([
    prisma.order.count({ where: { tenant_id: tenantId } }),
    prisma.payment.count({ where: { tenant_id: tenantId } }),
    prisma.client.count({ where: { tenant_id: tenantId } }),
    prisma.product.count({ where: { tenant_id: tenantId } })
  ]);

  const blockers: Record<string, number> = {};
  if (orders > 0) blockers.orders = orders;
  if (payments > 0) blockers.payments = payments;
  if (clients > 0) blockers.clients = clients;
  if (products > 0) blockers.products = products;

  return { empty: Object.keys(blockers).length === 0, blockers };
}
