import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { ORDER_STATUSES, ORDER_TYPES } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-2.types";
import { parseClientSales2Query } from "./client-sales-2.parse";
import { getClientSales2Report } from "./client-sales-2.report";

export async function exportClientSales2Xlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseClientSales2Query({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getClientSales2Report(tenantId, f, actor);
  const truncated = report.total > cap;

  const clientsHeaders = [
    "ID клиента",
    "Название",
    "Дата создания",
    "Категория",
    "Сумма",
    "Кол-во",
    "Объем",
    "Агент",
    "Территория"
  ];
  const clientsRows = report.clients.map((r) => [
    r.client_id,
    r.client_name,
    new Date(r.created_at).toLocaleDateString("ru-RU"),
    r.category,
    Number.parseFloat(r.amount),
    Number.parseFloat(r.qty),
    Number.parseFloat(r.volume),
    r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name,
    r.territory
  ]);

  const agentHeaders = ["Агент", "АКБ", "ОКБ", "% от АКБ", "Кол-во", "Объем", "Сумма"];
  const agentRows = report.agents_summary.map((r) => [
    r.agent_code ? `${r.agent_name} (${r.agent_code})` : r.agent_name,
    r.akb,
    r.okb,
    r.akb_percent,
    Number.parseFloat(r.qty),
    Number.parseFloat(r.volume),
    Number.parseFloat(r.amount)
  ]);

  const wb = XLSX.utils.book_new();
  const wsClients = XLSX.utils.aoa_to_sheet([clientsHeaders, ...clientsRows]);
  wsClients["!cols"] = clientsHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsClients, "Клиенты");

  const wsAgents = XLSX.utils.aoa_to_sheet([agentHeaders, ...agentRows]);
  wsAgents["!cols"] = agentHeaders.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsAgents, "По агентам");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
