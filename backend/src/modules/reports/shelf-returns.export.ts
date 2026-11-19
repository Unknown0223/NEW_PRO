import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseShelfReturnsQuery } from "./shelf-returns.parse";
import { getShelfReturnsReport } from "./shelf-returns.report";

export async function exportShelfReturnsXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseShelfReturnsQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getShelfReturnsReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "Клиент",
    "Ид клиента",
    "Код клиента",
    "Юр. наз. клиента",
    "Кат-я клиента",
    "Территория",
    "Количество",
    "Экспедитор",
    "Ид заказа",
    "Номер заказа",
    "Способ оплаты",
    "Тип цены",
    "Склад",
    "Дата заявки",
    "Дата отгрузки",
    "Статус",
    "Направление торговли",
    "Объем",
    "Сумма",
    "Агент",
    "Код агента",
    "Супервайзер",
    "Код супервайзера",
    "Ид товара",
    "Код товара",
    "Товар",
    "Группа товара",
    "Кат-я товара",
    "Кол-во в упаковке",
    "Объем товара",
    "Причина возврата"
  ];

  const rows = report.rows.map((r) => [
    r.client_name,
    r.client_id,
    r.client_code,
    r.client_legal_name,
    r.client_category,
    r.territory,
    Number.parseFloat(r.qty),
    r.expeditor_name,
    r.order_id,
    r.order_number,
    r.payment_method,
    r.price_type,
    r.warehouse_name,
    new Date(r.order_date).toLocaleString("ru-RU"),
    r.shipped_at ? new Date(r.shipped_at).toLocaleString("ru-RU") : "",
    r.status_label,
    r.trade_direction,
    Number.parseFloat(r.volume),
    Number.parseFloat(r.amount),
    r.agent_name,
    r.agent_code,
    r.supervisor_name,
    r.supervisor_code,
    r.product_id,
    r.product_sku,
    r.product_name,
    r.product_group,
    r.product_category,
    Number.parseFloat(r.pack_qty) || 0,
    Number.parseFloat(r.product_volume),
    r.return_reason
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "Возврат с полки");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
