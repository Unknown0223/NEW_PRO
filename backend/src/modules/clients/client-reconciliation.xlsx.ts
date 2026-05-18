/**
 * Mijoz bo‘yicha akt-sverka: bitta ma’lumot manbai — PDF, JSON API va Excel.
 */
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import { buildClientReconciliationPdf, type ReconciliationPdfPayload } from "./client-reconciliation-pdf";

import type { ClientReconciliationLoaded } from "./client-reconciliation.types";
import { toClientReconciliationJson } from "./client-reconciliation.mappers";
import { safeExcelSheetName } from "./client-reconciliation.shared";

export async function buildClientReconciliationXlsxBuffer(loaded: ClientReconciliationLoaded): Promise<Buffer> {
  const json = toClientReconciliationJson(loaded);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALEC";
  wb.created = new Date();

  const summary = wb.addWorksheet(safeExcelSheetName("Сводка"), { views: [{ state: "frozen", ySplit: 1 }] });
  summary.columns = [{ width: 42 }, { width: 28 }];
  summary.addRow(["Показатель", "Значение"]);
  summary.getRow(1).font = { bold: true };
  const pairs: [string, string][] = [
    ["Организация", json.tenant.name],
    ["Клиент", json.client.name],
    ["Юр. наименование", json.client.legal_name ?? "—"],
    ["Код клиента", json.client.client_code ?? "—"],
    ["Период", `${json.date_from} — ${json.date_to}`],
    ["Сформировано", json.generated_at],
    ["Л/с (текущий баланс)", json.summary.account_balance_current],
    ["Открытые заказы (сумма)", json.summary.outstanding_orders_total],
    ["Кредитный лимит", json.client.credit_limit],
    ["Остаток по движениям л/с на начало", json.summary.opening_balance_movements],
    ["Сумма движений л/с за период", json.summary.period_movements_net],
    ["Остаток по движениям л/с на конец периода", json.summary.closing_balance_movements_at_period_end],
    ["Сумма заказов за период", json.summary.sum_orders_in_period],
    ["Сумма оплат за период", json.summary.sum_payments_in_period]
  ];
  for (const [k, v] of pairs) summary.addRow([k, v]);

  const addTableSheet = (
    name: string,
    headers: string[],
    rows: (string | number | null)[][]
  ) => {
    const ws = wb.addWorksheet(safeExcelSheetName(name), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(r);
    ws.columns = headers.map(() => ({ width: 18 }));
    return ws;
  };

  addTableSheet(
    "Заказы",
    ["Номер", "Дата", "Статус", "Тип", "Сумма"],
    json.orders.map((o) => [o.number, o.created_at, o.status, o.order_type, o.total_sum])
  );

  addTableSheet(
    "Оплаты",
    ["ID", "Дата", "Тип оплаты", "Заказ", "Сумма", "Примечание"],
    json.payments.map((p) => [p.id, p.created_at, p.payment_type, p.order_number ?? "—", p.amount, p.note ?? ""])
  );

  addTableSheet(
    "Движения л/с",
    ["Дата", "Delta", "Примечание"],
    json.balance_movements.map((m) => [m.created_at, m.delta, m.note ?? ""])
  );

  addTableSheet(
    "Хронология",
    ["Тип", "Дата", "Документ", "Дебет", "Кредит", "Описание"],
    json.chronological.map((c) => [
      c.line_type === "order" ? "Заказ" : c.line_type === "payment" ? "Оплата" : "Движение л/с",
      c.at,
      c.ref || "—",
      c.debit,
      c.credit,
      c.description
    ])
  );

  const notesWs = wb.addWorksheet(safeExcelSheetName("Примечания"));
  notesWs.getColumn(1).width = 90;
  json.notes.forEach((n, i) => notesWs.addRow([`${i + 1}. ${n}`]));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
