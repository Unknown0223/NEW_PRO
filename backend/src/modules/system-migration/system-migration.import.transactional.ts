import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "../../config/database";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { importFieldActivityTables } from "./system-migration.import.field";
import {
  createManyAndMapByKey,
  createManyAndMapIds,
  createManyChunked
} from "./system-migration.import.batch";
import {
  hydrateDates,
  hydrateDecimals,
  readZipJson,
  remapId,
  stripIdTenant
} from "./system-migration.parse";
type ZipLike = JSZip;

export type TransactionalImportResult = {
  counts: Record<string, number>;
  warnings: string[];
};

function requireMap(maps: MigrationIdMaps, kind: keyof MigrationIdMaps, oldId: unknown, label: string): number | null {
  if (oldId == null) return null;
  const mapped = remapId(maps[kind], oldId);
  if (mapped == null) {
    throw new Error(`MAP_MISSING:${label}:${oldId}`);
  }
  return mapped;
}

export async function importTransactionalTables(
  zip: ZipLike,
  tenantId: number,
  maps: MigrationIdMaps
): Promise<TransactionalImportResult> {
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  const orders = await readZipJson<Record<string, unknown>>(zip, "data/orders.json");
  if (!orders.length) {
    return { counts, warnings: ["data/orders.json bo‘sh — operatsion import o‘tkazilmadi."] };
  }

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
    readZipJson<Record<string, unknown>>(zip, "data/order_items.json"),
    readZipJson<Record<string, unknown>>(zip, "data/order_status_logs.json"),
    readZipJson<Record<string, unknown>>(zip, "data/order_change_logs.json"),
    readZipJson<Record<string, unknown>>(zip, "data/payments.json"),
    readZipJson<Record<string, unknown>>(zip, "data/goods_receipts.json"),
    readZipJson<Record<string, unknown>>(zip, "data/sales_returns.json"),
    readZipJson<Record<string, unknown>>(zip, "data/tenant_audit_events.json"),
    readZipJson<Record<string, unknown>>(zip, "data/client_audit_logs.json")
  ]);

  const goodsReceiptLines = await readZipJson<Record<string, unknown>>(zip, "data/goods_receipt_lines.json");
  const salesReturnLines = await readZipJson<Record<string, unknown>>(zip, "data/sales_return_lines.json");

  await prisma.$transaction(
    async (tx) => {
      const orderRows: Array<{
        oldId: number;
        key: string;
        data: Prisma.OrderUncheckedCreateInput;
      }> = [];
      for (const row of orders) {
        const oldId = Number(row.id);
        const data = hydrateDecimals(
          hydrateDates(stripIdTenant(row), [
            "created_at",
            "updated_at",
            "consignment_due_date"
          ]),
          ["total_sum", "bonus_sum", "discount_sum"]
        );
        const clientId = requireMap(maps, "client", data.client_id, "order.client_id");
        if (clientId == null) throw new Error(`MAP_MISSING:order.client_id:${data.client_id}`);
        const number = String(data.number ?? "").trim();
        if (!number) throw new Error(`MAP_MISSING:order.number:${oldId}`);
        orderRows.push({
          oldId,
          key: number,
          data: {
            ...(data as Prisma.OrderUncheckedCreateInput),
            tenant_id: tenantId,
            client_id: clientId,
            agent_id: remapId(maps.user, data.agent_id) ?? null,
            warehouse_id: remapId(maps.warehouse, data.warehouse_id) ?? null,
            expeditor_user_id: remapId(maps.user, data.expeditor_user_id) ?? null,
            warehouse_block_id: null
          }
        });
      }
      counts.orders = await createManyAndMapByKey(
        (args) => tx.order.createManyAndReturn(args),
        orderRows,
        maps.order
      );

      const orderItemData: Prisma.OrderItemUncheckedCreateInput[] = [];
      for (const row of orderItems) {
        const orderId = requireMap(maps, "order", row.order_id, "order_item.order_id");
        const productId = requireMap(maps, "product", row.product_id, "order_item.product_id");
        if (orderId == null || productId == null) continue;
        const data = hydrateDecimals(stripIdTenant(row), ["qty", "price", "total"]);
        orderItemData.push({
          ...(data as Prisma.OrderItemUncheckedCreateInput),
          order_id: orderId,
          product_id: productId
        });
      }
      counts.order_items = await createManyChunked(
        (args) => tx.orderItem.createMany(args),
        orderItemData
      );

      const statusLogData: Prisma.OrderStatusLogUncheckedCreateInput[] = [];
      for (const row of orderStatusLogs) {
        const orderId = requireMap(maps, "order", row.order_id, "status_log.order_id");
        if (orderId == null) continue;
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        statusLogData.push({
          ...(data as Prisma.OrderStatusLogUncheckedCreateInput),
          order_id: orderId,
          user_id: remapId(maps.user, data.user_id) ?? null
        });
      }
      counts.order_status_logs = await createManyChunked(
        (args) => tx.orderStatusLog.createMany(args),
        statusLogData
      );

      const changeLogData: Prisma.OrderChangeLogUncheckedCreateInput[] = [];
      for (const row of orderChangeLogs) {
        const orderId = requireMap(maps, "order", row.order_id, "change_log.order_id");
        if (orderId == null) continue;
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        changeLogData.push({
          ...(data as Prisma.OrderChangeLogUncheckedCreateInput),
          order_id: orderId,
          user_id: remapId(maps.user, data.user_id) ?? null
        });
      }
      counts.order_change_logs = await createManyChunked(
        (args) => tx.orderChangeLog.createMany(args),
        changeLogData
      );

      const paymentRows: Array<{
        oldId: number;
        data: Prisma.PaymentUncheckedCreateInput;
      }> = [];
      for (const row of payments) {
        const oldId = Number(row.id);
        const clientId = requireMap(maps, "client", row.client_id, "payment.client_id");
        if (clientId == null) continue;
        const data = hydrateDecimals(
          hydrateDates(stripIdTenant(row), [
            "created_at",
            "paid_at",
            "received_at",
            "confirmed_at",
            "deleted_at"
          ]),
          ["amount"]
        );
        paymentRows.push({
          oldId,
          data: {
            ...(data as Prisma.PaymentUncheckedCreateInput),
            tenant_id: tenantId,
            client_id: clientId,
            order_id: remapId(maps.order, data.order_id) ?? null,
            created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
            cash_desk_id: remapId(maps.cashDesk, data.cash_desk_id) ?? null,
            expeditor_user_id: remapId(maps.user, data.expeditor_user_id) ?? null,
            ledger_agent_id: remapId(maps.user, data.ledger_agent_id) ?? null,
            deleted_by_user_id: remapId(maps.user, data.deleted_by_user_id) ?? null
          }
        });
      }
      counts.payments = await createManyAndMapIds(
        (args) => tx.payment.createManyAndReturn(args),
        paymentRows,
        maps.payment
      );

      const receiptRows: Array<{
        oldId: number;
        key: string;
        data: Prisma.GoodsReceiptUncheckedCreateInput;
      }> = [];
      for (const row of goodsReceipts) {
        const oldId = Number(row.id);
        const warehouseId = requireMap(maps, "warehouse", row.warehouse_id, "receipt.warehouse_id");
        if (warehouseId == null) continue;
        const data = hydrateDecimals(
          hydrateDates(stripIdTenant(row), [
            "receipt_at",
            "created_at",
            "updated_at",
            "deleted_at"
          ]),
          ["total_qty", "total_sum", "total_volume_m3", "total_weight_kg"]
        );
        const number = String(data.number ?? "").trim();
        if (!number) continue;
        receiptRows.push({
          oldId,
          key: number,
          data: {
            ...(data as Prisma.GoodsReceiptUncheckedCreateInput),
            tenant_id: tenantId,
            warehouse_id: warehouseId,
            supplier_id: null,
            created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
            deleted_by_user_id: remapId(maps.user, data.deleted_by_user_id) ?? null
          }
        });
      }
      counts.goods_receipts = await createManyAndMapByKey(
        (args) => tx.goodsReceipt.createManyAndReturn(args),
        receiptRows,
        maps.goodsReceipt
      );

      const receiptLineData: Prisma.GoodsReceiptLineUncheckedCreateInput[] = [];
      for (const row of goodsReceiptLines) {
        const receiptId = requireMap(maps, "goodsReceipt", row.receipt_id, "receipt_line.receipt_id");
        const productId = requireMap(maps, "product", row.product_id, "receipt_line.product_id");
        if (receiptId == null || productId == null) continue;
        const data = hydrateDecimals(stripIdTenant(row), [
          "qty",
          "unit_price",
          "line_total",
          "defect_qty",
          "volume_m3",
          "weight_kg"
        ]);
        receiptLineData.push({
          ...(data as Prisma.GoodsReceiptLineUncheckedCreateInput),
          receipt_id: receiptId,
          product_id: productId
        });
      }
      counts.goods_receipt_lines = await createManyChunked(
        (args) => tx.goodsReceiptLine.createMany(args),
        receiptLineData
      );

      const returnRows: Array<{
        oldId: number;
        key: string;
        data: Prisma.SalesReturnUncheckedCreateInput;
      }> = [];
      for (const row of salesReturns) {
        const oldId = Number(row.id);
        const warehouseId = requireMap(maps, "warehouse", row.warehouse_id, "return.warehouse_id");
        if (warehouseId == null) continue;
        const data = hydrateDecimals(
          hydrateDates(stripIdTenant(row), [
            "created_at",
            "accepted_at",
            "date_from",
            "date_to"
          ]),
          ["refund_amount", "bonus_debt_amount"]
        );
        const number = String(data.number ?? "").trim();
        if (!number) continue;
        returnRows.push({
          oldId,
          key: number,
          data: {
            ...(data as Prisma.SalesReturnUncheckedCreateInput),
            tenant_id: tenantId,
            warehouse_id: warehouseId,
            client_id: remapId(maps.client, data.client_id) ?? null,
            order_id: remapId(maps.order, data.order_id) ?? null,
            mirror_order_id: remapId(maps.order, data.mirror_order_id) ?? null,
            created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
            accepted_by_user_id: remapId(maps.user, data.accepted_by_user_id) ?? null
          }
        });
      }
      counts.sales_returns = await createManyAndMapByKey(
        (args) => tx.salesReturn.createManyAndReturn(args),
        returnRows,
        maps.salesReturn
      );

      const returnLineData: Prisma.SalesReturnLineUncheckedCreateInput[] = [];
      for (const row of salesReturnLines) {
        const returnId = requireMap(maps, "salesReturn", row.return_id, "return_line.return_id");
        const productId = requireMap(maps, "product", row.product_id, "return_line.product_id");
        if (returnId == null || productId == null) continue;
        const data = hydrateDecimals(stripIdTenant(row), ["qty", "bonus_qty", "paid_qty"]);
        returnLineData.push({
          ...(data as Prisma.SalesReturnLineUncheckedCreateInput),
          return_id: returnId,
          product_id: productId
        });
      }
      counts.sales_return_lines = await createManyChunked(
        (args) => tx.salesReturnLine.createMany(args),
        returnLineData
      );

      const auditData: Prisma.TenantAuditEventUncheckedCreateInput[] = [];
      for (const row of auditEvents) {
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        auditData.push({
          ...(data as Prisma.TenantAuditEventUncheckedCreateInput),
          tenant_id: tenantId,
          actor_user_id: remapId(maps.user, data.actor_user_id) ?? null
        });
      }
      counts.tenant_audit_events = await createManyChunked(
        (args) => tx.tenantAuditEvent.createMany(args),
        auditData
      );

      const clientAuditData: Prisma.ClientAuditLogUncheckedCreateInput[] = [];
      for (const row of clientAuditLogs) {
        const clientId = requireMap(maps, "client", row.client_id, "client_audit.client_id");
        if (clientId == null) continue;
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        clientAuditData.push({
          ...(data as Prisma.ClientAuditLogUncheckedCreateInput),
          tenant_id: tenantId,
          client_id: clientId,
          user_id: remapId(maps.user, data.user_id) ?? null
        });
      }
      counts.client_audit_logs = await createManyChunked(
        (args) => tx.clientAuditLog.createMany(args),
        clientAuditData
      );

      const fieldCounts = await importFieldActivityTables(tx, zip, tenantId, maps);
      Object.assign(counts, fieldCounts);
      // Fotootchyotlar — import oxirida (applyBackupZip → files stage)
    },
    { timeout: 300_000 }
  );

  return { counts, warnings };
}
