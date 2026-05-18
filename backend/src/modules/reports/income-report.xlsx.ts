import * as XLSX from "xlsx";
import type { AccessCtx, IncomeReportQuery } from "./income-report.types";
import { getIncomeReport } from "./income-report.report";

export async function exportIncomeReportXlsx(
  tenantId: number,
  query: IncomeReportQuery,
  ctx: AccessCtx,
  kind: "period" | "territory" | "clients" | "agents"
) {
  const data = await getIncomeReport(tenantId, query, ctx);
  const wb = XLSX.utils.book_new();
  const paymentColumns = [...new Set(data.period.map((r) => r.payment_type))].sort();
  const labelOf = (key: string) => data.paymentTypeLabels?.[key] ?? key;
  const mkAmount = (n: number) => Number.isFinite(n) ? n : 0;
  if (kind === "period") {
    const aoa: (string | number)[][] = [["Способ оплаты", "Сумма"]];
    for (const row of data.period) aoa.push([labelOf(row.payment_type), mkAmount(row.amount)]);
    aoa.push(["Итого", mkAmount(data.summary.total)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Поступления за период");
  } else if (kind === "territory") {
    const aoa: (string | number)[][] = [["Территория", ...paymentColumns.map(labelOf), "Итого"]];
    for (const row of data.territories) {
      aoa.push([row.territory, ...paymentColumns.map((c) => mkAmount(row.byType[c] ?? 0)), mkAmount(row.total)]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "По территории");
  } else if (kind === "clients") {
    const aoa: (string | number)[][] = [["ID клиента", "Название", ...paymentColumns.map(labelOf), "Агент", "Территория", "Итого"]];
    for (const row of data.clients) {
      aoa.push([
        row.client_id,
        row.client_name,
        ...paymentColumns.map((c) => mkAmount(row.byType[c] ?? 0)),
        row.agent_name,
        row.territory,
        mkAmount(row.total)
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Поступления по клиентам");
  } else {
    const aoa: (string | number)[][] = [["Код агента", "Название", ...paymentColumns.map(labelOf), "Итого"]];
    for (const row of data.agents) {
      aoa.push([row.agent_id, row.agent_name, ...paymentColumns.map((c) => mkAmount(row.byType[c] ?? 0)), mkAmount(row.total)]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "По агентам");
  }
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer };
}
