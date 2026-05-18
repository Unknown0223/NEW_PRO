import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4.types";
import { parseClientSales4Query } from "./client-sales-4.parse";
import { getClientSales4Report } from "./client-sales-4.report";

export async function exportClientSales4Xlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseClientSales4Query({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getClientSales4Report(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = ["ID клиента", "Клиент", "Агент", "Код агента", "Территория", "Сумма"];
  const rows = report.clients.map((r) => [
    r.client_id,
    r.client_name,
    r.agent_name,
    r.agent_code,
    r.territory,
    Number.parseFloat(r.amount) || 0
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "Клиенты");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
