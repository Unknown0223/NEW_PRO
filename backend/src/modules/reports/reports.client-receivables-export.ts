import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { ClientReceivablesResult } from "./reports.client-receivables";
import { getClientReceivables } from "./reports.client-receivables";

export async function exportClientReceivablesXlsx(
  tenantId: number,
  opts: {
    search?: string;
    only_over_limit?: boolean;
    active_only?: boolean;
    maxRows?: number;
  }
): Promise<{ buffer: Buffer; truncated: boolean; total: number }> {
  const cap = Math.min(10000, Math.max(1, opts.maxRows ?? 5000));
  const batch = await getClientReceivables(tenantId, {
    page: 1,
    limit: cap,
    search: opts.search,
    only_over_limit: opts.only_over_limit,
    active_only: opts.active_only
  });
  const truncated = batch.total > cap;
  const headers = [
    "ID",
    "Mijoz",
    "Telefon",
    "Faol",
    "Kredit limiti",
    "Hisob saldosi",
    "Ochiq zakazlar",
    "Headroom",
    "Qoldiq",
    "Limit oshgan"
  ];
  const rows: (string | number)[][] = batch.data.map((r) => [
    r.client_id,
    r.name,
    r.phone ?? "",
    r.is_active ? "Ha" : "Yo‘q",
    Number.parseFloat(r.credit_limit) || 0,
    Number.parseFloat(r.account_balance) || 0,
    Number.parseFloat(r.outstanding) || 0,
    Number.parseFloat(r.headroom) || 0,
    Number.parseFloat(r.headroom_remaining) || 0,
    r.over_limit ? "Ha" : "Yo‘q"
  ]);
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 16 },
    { wch: 6 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Qarzdorlik");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, truncated, total: batch.total };
}

