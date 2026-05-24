import { api } from "@/lib/api";
import { exportSheetsToXlsx } from "@/components/dashboard/monitoring/api";
import type { MonitoringDraft, MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { buildMonitoringQuery } from "@/components/dashboard/monitoring/build-monitoring-query";
import { num } from "@/components/dashboard/monitoring/utils";

export async function exportMonitoringXlsx(
  tenantSlug: string,
  applied: MonitoringDraft
): Promise<void> {
  const qs = buildMonitoringQuery(applied);
  const { data: snap } = await api.get<MonitoringSnapshot>(
    `/api/${tenantSlug}/dashboard/sales-monitoring?${qs}`
  );
  if (!snap) return;
  const px = `sales-monitoring-${tenantSlug}-${applied.year}-${String(applied.month).padStart(2, "0")}`;
  await exportSheetsToXlsx(px, [
    {
      name: "Summary",
      rows: [
        ["Показатель", "Значение"],
        ["Заказы", snap.summary?.orders_count ?? ""],
        ["Доставлено", snap.summary?.delivered_orders_count ?? ""],
        ["Успех %", snap.summary?.order_success_pct ?? ""],
        ["Средний чек", snap.summary?.aov ?? ""],
        ["Рост к пр. месяцу %", snap.summary?.growth_vs_prev_month_sales_pct ?? ""],
        ["Рост к пр. году %", snap.summary?.growth_vs_prev_year_sales_pct ?? ""],
        ["Прогноз на конец мес.", snap.summary?.forecast_month_end_sales ?? ""],
        ["Потери возвратов", snap.summary?.return_loss_sum ?? ""],
        ["Активных локаций", snap.summary?.active_territory_keys ?? ""]
      ]
    },
    {
      name: "Филиалы",
      rows: [
        ["Ранг", "Филиал", "АКБ", "ОКБ", "Покрытие %", "Факт"],
        ...snap.branch_performance.map((r) => [
          r.rank ?? "",
          r.branch,
          r.akb,
          r.okb ?? "",
          r.coverage_pct != null ? r.coverage_pct.toFixed(1) : "",
          num(r.fact_sales)
        ])
      ]
    },
    {
      name: "SKU",
      rows: [
        ["Товар", "SKU", "Сумма", "Кол-во", "Возврат %", "Отмена %"],
        ...snap.sku_matrix.map((r) => [
          r.name,
          r.sku,
          num(r.total_sum),
          r.total_qty ?? "",
          r.return_pct ?? "",
          r.cancel_pct ?? ""
        ])
      ]
    }
  ]);
}
