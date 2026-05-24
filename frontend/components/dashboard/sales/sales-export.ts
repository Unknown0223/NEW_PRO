import { fileToken, formatReasonLabel } from "@/components/dashboard/sales/format";
import type { SalesDashboardSnapshot, SalesFilterDraft } from "@/components/dashboard/sales/types";

async function exportSheetsToXlsx(
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

export function salesExportPrefix(applied: SalesFilterDraft): string {
  return `sales-${fileToken(applied.from)}-${fileToken(applied.to)}`;
}

export type SalesExportResolvers = {
  resolvePayment: (ref: string) => string;
  resolveTerritory: (ref: string) => string;
};

export function createSalesExportHandlers(
  data: SalesDashboardSnapshot,
  prefix: string,
  resolvers: SalesExportResolvers
) {
  const { resolvePayment, resolveTerritory } = resolvers;
  return {
    all: () => exportSalesAll(data, `${prefix}-all`, resolvePayment, resolveTerritory),
    payment: () =>
      exportSheetsToXlsx(`${prefix}-oplata`, [
        {
          name: "Оплаты",
          rows: [
            ["Способ оплаты", "Сумма", "Доля, %"],
            ...data.payment_method_analytics.map((r) => [
              resolvePayment(r.payment_type),
              Number(r.sales_sum),
              r.share_pct
            ])
          ]
        }
      ]),
    ordersRefusals: () =>
      exportSheetsToXlsx(`${prefix}-otkazy`, [
        {
          name: "Отказы",
          rows: [
            ["Показатель", "Значение"],
            ["Принято", data.orders_refusals.accepted],
            ["Отклонено", data.orders_refusals.rejected],
            ["В обработке", data.orders_refusals.pending],
            ["Всего", data.orders_refusals.total],
            ["Конверсия, %", data.orders_refusals.conversion_pct]
          ]
        }
      ]),
    productCategories: () =>
      exportSheetsToXlsx(`${prefix}-kat-prod`, [
        {
          name: "Категории",
          rows: [
            ["Категория", "Сумма", "Доля, %"],
            ...data.product_category_analytics.map((r) => [r.category, Number(r.sales_sum), r.share_pct])
          ]
        }
      ]),
    productGroups: () =>
      exportSheetsToXlsx(`${prefix}-gruppy`, [
        {
          name: "Группы",
          rows: [
            ["Группа", "Сумма", "Доля, %"],
            ...data.product_group_analytics.map((r) => [r.product_group, Number(r.sales_sum), r.share_pct])
          ]
        }
      ]),
    categoryPerformance: () =>
      exportSheetsToXlsx(`${prefix}-effekt`, [
        {
          name: "Эффективность",
          rows: [
            ["Категория", "Сумма продаж", "Кол-во", "Объем", "АКБ", "Доля, %"],
            ...data.category_performance_table.map((r) => [
              r.category,
              Number(r.sales_sum),
              Number(r.sold_qty),
              Number(r.volume),
              r.akb,
              r.share_pct
            ])
          ]
        }
      ]),
    salesDynamics: () =>
      exportSheetsToXlsx(`${prefix}-dinamika`, [
        {
          name: "Динамика",
          rows: [
            ["Период", "Сумма продаж", "Заказы"],
            ...data.sales_dynamics.map((r) => [r.period, Number(r.sales_sum), r.orders_count])
          ]
        }
      ]),
    refusalReasons: () =>
      exportSheetsToXlsx(`${prefix}-prichiny`, [
        {
          name: "Причины",
          rows: [
            ["Причина", "Кол-во", "Доля, %"],
            ...data.refusal_reason_analytics.map((r) => [formatReasonLabel(r.reason), r.count, r.share_pct])
          ]
        }
      ]),
    territory: () =>
      exportSheetsToXlsx(`${prefix}-territorii`, [
        {
          name: "Территории",
          rows: [
            ["Территория", "Сумма", "АКБ", "ОКБ", "Процент ОКБ"],
            ...data.territory_analytics.map((r) => [
              resolveTerritory(r.territory),
              Number(r.sales_sum),
              r.akb,
              r.okb,
              r.coverage_pct
            ])
          ]
        }
      ]),
    agents: () =>
      exportSheetsToXlsx(`${prefix}-agenty`, [
        {
          name: "Агенты",
          rows: [
            ["Агент", "Код", "Сумма продаж", "АКБ", "ОКБ", "Процент ОКБ"],
            ...data.agent_analytics.map((r) => [
              r.agent_name,
              r.agent_code ?? "",
              Number(r.sales_sum),
              r.akb,
              r.okb,
              r.coverage_pct
            ])
          ]
        }
      ])
  };
}

export async function exportSalesAll(
  data: SalesDashboardSnapshot,
  prefix: string,
  resolvePayment: (ref: string) => string,
  resolveTerritory: (ref: string) => string
): Promise<void> {
  const s = data.total_sales_summary;
  const a = data.akb_okb_block;
  await exportSheetsToXlsx(`${prefix}-all`, [
    {
      name: "Сводка",
      rows: [
        ["Показатель", "Значение"],
        ["Общая сумма", Number(s.total_sales_sum)],
        ["Заказы", s.orders_count],
        ["АКБ", a.akb],
        ["ОКБ", a.okb],
        ["Процент ОКБ, %", a.coverage_pct]
      ]
    },
    {
      name: "Оплаты",
      rows: [
        ["Способ оплаты", "Сумма", "Доля, %"],
        ...data.payment_method_analytics.map((r) => [
          resolvePayment(r.payment_type),
          Number(r.sales_sum),
          r.share_pct
        ])
      ]
    },
    {
      name: "Отказы",
      rows: [
        ["Показатель", "Значение"],
        ["Принято", data.orders_refusals.accepted],
        ["Отклонено", data.orders_refusals.rejected],
        ["В обработке", data.orders_refusals.pending],
        ["Всего", data.orders_refusals.total],
        ["Конверсия, %", data.orders_refusals.conversion_pct]
      ]
    },
    {
      name: "Категории",
      rows: [
        ["Категория", "Сумма", "Доля, %"],
        ...data.product_category_analytics.map((r) => [r.category, Number(r.sales_sum), r.share_pct])
      ]
    },
    {
      name: "Группы",
      rows: [
        ["Группа", "Сумма", "Доля, %"],
        ...data.product_group_analytics.map((r) => [r.product_group, Number(r.sales_sum), r.share_pct])
      ]
    },
    {
      name: "Эффективность",
      rows: [
        ["Категория", "Сумма продаж", "Кол-во", "Объем", "АКБ", "Доля, %"],
        ...data.category_performance_table.map((r) => [
          r.category,
          Number(r.sales_sum),
          Number(r.sold_qty),
          Number(r.volume),
          r.akb,
          r.share_pct
        ])
      ]
    },
    {
      name: "Динамика",
      rows: [
        ["Период", "Сумма продаж", "Заказы"],
        ...data.sales_dynamics.map((r) => [r.period, Number(r.sales_sum), r.orders_count])
      ]
    },
    {
      name: "Причины",
      rows: [
        ["Причина", "Кол-во", "Доля, %"],
        ...data.refusal_reason_analytics.map((r) => [formatReasonLabel(r.reason), r.count, r.share_pct])
      ]
    },
    {
      name: "Территории",
      rows: [
        ["Территория", "Сумма", "АКБ", "ОКБ", "Процент ОКБ"],
        ...data.territory_analytics.map((r) => [
          resolveTerritory(r.territory),
          Number(r.sales_sum),
          r.akb,
          r.okb,
          r.coverage_pct
        ])
      ]
    },
    {
      name: "Агенты",
      rows: [
        ["Агент", "Код", "Сумма продаж", "АКБ", "ОКБ", "Процент ОКБ"],
        ...data.agent_analytics.map((r) => [
          r.agent_name,
          r.agent_code ?? "",
          Number(r.sales_sum),
          r.akb,
          r.okb,
          r.coverage_pct
        ])
      ]
    }
  ]);
}
