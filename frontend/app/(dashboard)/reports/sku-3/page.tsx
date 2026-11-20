"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome qisman (matrix → flat product cols; no dual header / need_products banner)
 * · oylik/dialog — · export+RBAC qisman (Excel always if permitted; product_ids gate lost)
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import { mapMultiOptions } from "@/components/reports/flat-report/flat-report-helpers";
import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

type SkuCell = { amount?: string; qty?: string };

function sku3Columns(ctx: {
  applied: Record<string, string | number | string[]>;
  filterOptions: Record<string, unknown> | undefined;
}): FlatReportColumn[] {
  const selected = Array.isArray(ctx.applied.product_ids)
    ? (ctx.applied.product_ids as string[])
    : [];
  const byId = new Map(mapMultiOptions(ctx.filterOptions?.products).map((p) => [p.id, p.title]));
  const cols: FlatReportColumn[] = [
    { key: "client_name", header: "Торговая точка", cellClassName: "font-medium" }
  ];
  for (const id of selected) {
    const title = byId.get(id) ?? id;
    cols.push(
      {
        key: `p${id}_amount`,
        header: `${title} · Сумма`,
        align: "right",
        format: "money",
        valueFrom: (row) => {
          const cells = row.cells as Record<string, SkuCell> | undefined;
          return cells?.[id]?.amount ?? "0";
        }
      },
      {
        key: `p${id}_qty`,
        header: `${title} · Кол-во`,
        align: "right",
        format: "number",
        valueFrom: (row) => {
          const cells = row.cells as Record<string, SkuCell> | undefined;
          return cells?.[id]?.qty ?? "0";
        }
      }
    );
  }
  return cols;
}

const config: FlatReportConfig = {
  title: "По Sku 3.0",
  apiPath: "sku-3",
  exportPermission: "reports.po_sku_3.export",
  exportFilename: "po-sku-3.xlsx",
  exportLimit: 2000,
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Клиент" },
    {
      kind: "multiSelect",
      paramKey: "product_ids",
      optionsFrom: "products",
      placeholder: "Продукты"
    },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "expeditor_ids",
      optionsFrom: "expeditors",
      placeholder: "Экспедитор"
    },
    {
      kind: "multiSelect",
      paramKey: "price_types",
      optionsFrom: "price_types",
      placeholder: "Тип цены"
    },
    {
      kind: "multiSelect",
      paramKey: "client_categories",
      optionsFrom: "client_categories",
      placeholder: "Категория клиента"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_1_list",
      optionsFrom: "territory_1",
      placeholder: "Зона"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_2_list",
      optionsFrom: "territory_2",
      placeholder: "Область"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_3_list",
      optionsFrom: "territory_3",
      placeholder: "Город"
    }
  ],
  columns: sku3Columns,
  totalsKeys: ["okb", "akb"],
  totalsLabels: { okb: "ОКБ", akb: "АКБ" },
  rowKey: "client_id",
  countLabel: "Клиентов в таблице",
  showTableFooter: false
};

export default function ReportSku3Page() {
  return <FlatReportPage {...config} />;
}
