import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildClientWhere,
  buildOrderCreatedLocalDateClause,
  loadTenantPaymentRefs,
  sqlIntIdToNumber,
  type ClientBalanceListQuery
} from "../client-balances/client-balances.service";
import { resolvePaymentMethodRefToLabel } from "../tenant-settings/finance-refs";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import type { OrderDebtsListQuery } from "./order-debts.types";

const PAYMENT_NOT_PENDING = Prisma.sql`COALESCE(p.workflow_status, 'confirmed') <> 'pending_confirmation'`;
import * as XLSX from "xlsx";

import { listOrderDebtsReport } from "./order-debts.list";

export async function exportOrderDebtsXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>
): Promise<{ buffer: Buffer; truncated: boolean; total: number }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const q = { ...rawQ, page: "1", limit: String(cap), large_export: "1" };
  const batch = await listOrderDebtsReport(tenantId, q);
  const truncated = batch.total > cap;
  const staffLabel = (name: string | null | undefined, code: string | null | undefined): string => {
    const n = (name ?? "").trim();
    const c = (code ?? "").trim();
    if (!n && !c) return "";
    if (!c) return n;
    if (!n) return c;
    return `${n} (${c})`;
  };
  const headers = [
    "Заказ ID",
    "Номер",
    "Статус заказа",
    "Клиент",
    "Валюта",
    "Адрес",
    "Ориентир",
    "Телефон",
    "Агент",
    "Экспедитор",
    "Склад",
    "Сумма заказа",
    "Оплачено по заказу",
    "Способ оплаты",
    "Дата отгрузки",
    "Срок консигнации",
    "Остаток по заказу",
    "Нераспр. по клиенту",
    "Баланс клиента"
  ];
  const rows: (string | number)[][] = batch.data.map((r) => [
    r.order_id,
    r.order_number,
    r.order_status,
    r.client_name,
    r.currency,
    r.address ?? "",
    r.landmark ?? "",
    r.phone ?? "",
    staffLabel(r.agent_name, r.agent_code),
    staffLabel(r.expeditor_name, r.expeditor_code),
    r.warehouse_name ?? "",
    Number.parseFloat(r.total_sum) || 0,
    Number.parseFloat(r.allocated_sum) || 0,
    r.payment_method_label ?? "",
    r.shipped_at ? new Date(r.shipped_at).toLocaleDateString("ru-RU") : "",
    r.consignment_due_date ? new Date(r.consignment_due_date).toLocaleDateString("ru-RU") : "",
    Number.parseFloat(r.remainder) || 0,
    Number.parseFloat(r.unallocated) || 0,
    Number.parseFloat(r.client_balance) || 0
  ]);
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Debts");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, truncated, total: batch.total };
}

