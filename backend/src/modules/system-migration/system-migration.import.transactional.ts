import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "../../config/database";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { importBonusPlansTables } from "./system-migration.import.bonus-plans";
import { importFieldActivityTables } from "./system-migration.import.field";
import { importClientPhotoReports } from "./system-migration.import.files";
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

        const created = await tx.order.create({
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
        maps.order.set(oldId, created.id);
      }
      counts.orders = orders.length;

      for (const row of orderItems) {
        const orderId = requireMap(maps, "order", row.order_id, "order_item.order_id");
        const productId = requireMap(maps, "product", row.product_id, "order_item.product_id");
        if (orderId == null || productId == null) continue;
        const data = hydrateDecimals(stripIdTenant(row), ["qty", "price", "total"]);
        await tx.orderItem.create({
          data: {
            ...(data as Prisma.OrderItemUncheckedCreateInput),
            order_id: orderId,
            product_id: productId
          }
        });
      }
      counts.order_items = orderItems.length;

      for (const row of orderStatusLogs) {
        const orderId = requireMap(maps, "order", row.order_id, "status_log.order_id");
        if (orderId == null) continue;
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        await tx.orderStatusLog.create({
          data: {
            ...(data as Prisma.OrderStatusLogUncheckedCreateInput),
            order_id: orderId,
            user_id: remapId(maps.user, data.user_id) ?? null
          }
        });
      }
      counts.order_status_logs = orderStatusLogs.length;

      for (const row of orderChangeLogs) {
        const orderId = requireMap(maps, "order", row.order_id, "change_log.order_id");
        if (orderId == null) continue;
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        await tx.orderChangeLog.create({
          data: {
            ...(data as Prisma.OrderChangeLogUncheckedCreateInput),
            order_id: orderId,
            user_id: remapId(maps.user, data.user_id) ?? null
          }
        });
      }
      counts.order_change_logs = orderChangeLogs.length;

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
        const created = await tx.payment.create({
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
        maps.payment.set(oldId, created.id);
      }
      counts.payments = payments.length;
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
        const created = await tx.goodsReceipt.create({
          data: {
            ...(data as Prisma.GoodsReceiptUncheckedCreateInput),
            tenant_id: tenantId,
            warehouse_id: warehouseId,
            supplier_id: null,
            created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
            deleted_by_user_id: remapId(maps.user, data.deleted_by_user_id) ?? null
          }
        });
        maps.goodsReceipt.set(oldId, created.id);
      }
      counts.goods_receipts = goodsReceipts.length;

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
        await tx.goodsReceiptLine.create({
          data: {
            ...(data as Prisma.GoodsReceiptLineUncheckedCreateInput),
            receipt_id: receiptId,
            product_id: productId
          }
        });
      }
      counts.goods_receipt_lines = goodsReceiptLines.length;

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
        const created = await tx.salesReturn.create({
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
        maps.salesReturn.set(oldId, created.id);
      }
      counts.sales_returns = salesReturns.length;

      for (const row of salesReturnLines) {
        const returnId = requireMap(maps, "salesReturn", row.return_id, "return_line.return_id");
        const productId = requireMap(maps, "product", row.product_id, "return_line.product_id");
        if (returnId == null || productId == null) continue;
        const data = hydrateDecimals(stripIdTenant(row), ["qty", "bonus_qty", "paid_qty"]);
        await tx.salesReturnLine.create({
          data: {
            ...(data as Prisma.SalesReturnLineUncheckedCreateInput),
            return_id: returnId,
            product_id: productId
          }
        });
      }
      counts.sales_return_lines = salesReturnLines.length;

      for (const row of auditEvents) {
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        await tx.tenantAuditEvent.create({
          data: {
            ...(data as Prisma.TenantAuditEventUncheckedCreateInput),
            tenant_id: tenantId,
            actor_user_id: remapId(maps.user, data.actor_user_id) ?? null
          }
        });
      }
      counts.tenant_audit_events = auditEvents.length;

      for (const row of clientAuditLogs) {
        const clientId = requireMap(maps, "client", row.client_id, "client_audit.client_id");
        if (clientId == null) continue;
        const data = hydrateDates(stripIdTenant(row), ["created_at"]);
        await tx.clientAuditLog.create({
          data: {
            ...(data as Prisma.ClientAuditLogUncheckedCreateInput),
            tenant_id: tenantId,
            client_id: clientId,
            user_id: remapId(maps.user, data.user_id) ?? null
          }
        });
      }
      counts.client_audit_logs = clientAuditLogs.length;

      const fieldCounts = await importFieldActivityTables(tx, zip, tenantId, maps);
      Object.assign(counts, fieldCounts);

      const photoCount = await importClientPhotoReports(tx, zip, tenantId, maps);
      if (photoCount > 0) counts.client_photo_reports = photoCount;
    },    { timeout: 300_000 }
  );

  return { counts, warnings };
}
