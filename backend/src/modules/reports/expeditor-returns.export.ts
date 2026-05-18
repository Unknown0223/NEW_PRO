import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import * as XLSX from "xlsx";
import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";
import { parseExpeditorReturnsQuery } from "./expeditor-returns.parse";
import { getExpeditorReturnsByClients, getExpeditorReturnsByProducts } from "./expeditor-returns.aggregates";
import { getExpeditorReturnsOrders } from "./expeditor-returns.orders";

const EXPORT_CAP = 8000;

export async function exportExpeditorReturnsXlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const fAll = parseExpeditorReturnsQuery(q);
  const fExport: ExpeditorReturnsFilters = {
    ...fAll,
    page: 1,
    limit: EXPORT_CAP,
    agg_products_limit: null,
    agg_clients_limit: null
  };
  const [ordersBlock, prodBlock, clientBlock] = await Promise.all([
    getExpeditorReturnsOrders(tenantId, fExport, actor),
    getExpeditorReturnsByProducts(tenantId, fExport, actor),
    getExpeditorReturnsByClients(tenantId, fExport, actor)
  ]);
  const truncated = ordersBlock.total > EXPORT_CAP;

  const wb = XLSX.utils.book_new();

  const orderSheet = XLSX.utils.json_to_sheet(
    ordersBlock.rows.map((r) => ({
      "\u2116": r.row_number,
      "Заказ ID": r.order_id,
      "Номер заказа": r.order_number,
      Тип: r.order_type_label,
      "Дата заказа": r.order_date,
      "Дата отгрузки": r.shipped_at ?? "",
      "Дата доставки": r.delivered_at ?? "",
      Клиенты: r.client_name,
      Агент: r.agent_label,
      Экспедитор: r.expeditor_label,
      Статус: r.status_label,
      Заказ: r.qty_ordered,
      Возврат: r.qty_returned,
      "Бонус заказа": r.qty_bonus_ordered,
      "Бонус возврата": r.qty_bonus_returned,
      "Бонус доставки": r.qty_bonus_delivery,
      "Сумма бонус доставки": r.sum_bonus_delivery,
      "Доп. заказ": r.qty_extra_order,
      Доставка: r.qty_delivered,
      "Дата обновления": r.updated_at,
      "Сумма(до)": r.sum_before,
      "Сумма(после)": r.sum_after,
      "Сумма(возврат)": r.sum_return,
      "Причина (агент)": r.reason_agent,
      "Причина (экспедитор)": r.reason_expeditor
    }))
  );
  XLSX.utils.book_append_sheet(wb, orderSheet, "По заказам");

  const um = prodBlock.unit_mode;
  const unitLabel =
    um === "pack" ? "уп." : um === "volume" ? "м³" : um === "weight" ? "кг" : "шт";

  const prodSheet = XLSX.utils.json_to_sheet(
    prodBlock.rows.map((r) => ({
      "\u2116": r.row_number,
      Категория: r.category_name,
      Продукт: r.product_name,
      Код: r.sku,
      [`Заказ (${unitLabel})`]: r.qty_ordered,
      [`Возврат (${unitLabel})`]: r.qty_returned,
      [`Бонус заказа (${unitLabel})`]: r.qty_bonus_ordered,
      [`Бонус возврата (${unitLabel})`]: r.qty_bonus_returned,
      [`Доставка (${unitLabel})`]: r.qty_delivered,
      [`Возврат на склад (${unitLabel})`]: r.qty_return_warehouse
    }))
  );
  XLSX.utils.book_append_sheet(wb, prodSheet, "По товарам");

  const clientSheet = XLSX.utils.json_to_sheet(
    clientBlock.rows.map((r) => ({
      "\u2116": r.row_number,
      Клиенты: r.client_name,
      Категория: r.category_name,
      Продукт: r.product_name,
      Код: r.sku,
      [`Заказ (${unitLabel})`]: r.qty_ordered,
      [`Возврат (${unitLabel})`]: r.qty_returned,
      [`Бонус заказа (${unitLabel})`]: r.qty_bonus_ordered,
      [`Бонус возврата (${unitLabel})`]: r.qty_bonus_returned,
      [`Доставка (${unitLabel})`]: r.qty_delivered,
      [`Возврат на склад (${unitLabel})`]: r.qty_return_warehouse
    }))
  );
  XLSX.utils.book_append_sheet(wb, clientSheet, "По клиентам");

  const buffer = Buffer.from(
    XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellDates: true }) as Buffer
  );
  return { buffer, total: ordersBlock.total, truncated };
}
