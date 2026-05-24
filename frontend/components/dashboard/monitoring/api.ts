import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { api } from "@/lib/api";

export async function fetchMonitoringSummary(tenantSlug: string, qs: string) {
  const { data } = await api.get(`/api/${tenantSlug}/dashboard/sales-monitoring/summary?${qs}`);
  return data as Partial<MonitoringSnapshot>;
}

export async function fetchMonitoringCharts(tenantSlug: string, qs: string) {
  const { data } = await api.get(`/api/${tenantSlug}/dashboard/sales-monitoring/charts?${qs}`);
  return data as Partial<MonitoringSnapshot>;
}

export async function fetchMonitoringTables(
  tenantSlug: string,
  qs: string,
  page: number,
  limit: number,
  table: "sku_matrix" | "branch" | "supervisor" | "client_daily"
) {
  const { data } = await api.get(
    `/api/${tenantSlug}/dashboard/sales-monitoring/tables?${qs}&page=${page}&limit=${limit}&table=${table}`
  );
  return data as {
    branch_performance: MonitoringSnapshot["branch_performance"];
    supervisor_performance: MonitoringSnapshot["supervisor_performance"];
    sku_matrix: MonitoringSnapshot["sku_matrix"];
    sku_total: number;
    client_daily_sales: MonitoringSnapshot["client_daily_sales"];
  };
}

export async function exportSheetsToXlsx(
  fileName: string,
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: "xlsx", compression: true });
}
