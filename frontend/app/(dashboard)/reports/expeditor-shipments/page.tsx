"use client";

/**
 * FlatReport wave-4 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome qisman (matrix→flat cols; no dual header / sticky / zero highlight)
 * · oylik/dialog — · export+RBAC qisman (Excel always if permitted; column set from selected expeditors)
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import { mapMultiOptions } from "@/components/reports/flat-report/flat-report-helpers";
import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

type ShipCell = {
  block_count?: number;
  volume?: string;
  qty?: string;
  amount?: string;
};

function colKey(id: string) {
  return id === "" ? "none" : id;
}

function shipmentsColumns(ctx: {
  applied: Record<string, string | number | string[]>;
  filterOptions: Record<string, unknown> | undefined;
}): FlatReportColumn[] {
  const selected = Array.isArray(ctx.applied.expeditor_ids)
    ? (ctx.applied.expeditor_ids as string[])
    : [];
  const byId = new Map(mapMultiOptions(ctx.filterOptions?.expeditors).map((p) => [p.id, p.title]));
  const cols: FlatReportColumn[] = [
    { key: "product_name", header: "Товар", cellClassName: "font-medium" },
    { key: "category_name", header: "Категория" }
  ];
  for (const id of selected) {
    const title = byId.get(id) ?? id;
    const key = colKey(id);
    cols.push(
      {
        key: `e${id}_block`,
        header: `${title} · Блок`,
        align: "right",
        format: "number",
        valueFrom: (row) => {
          const cells = row.cells as Record<string, ShipCell> | undefined;
          return cells?.[key]?.block_count ?? 0;
        }
      },
      {
        key: `e${id}_volume`,
        header: `${title} · Объём`,
        align: "right",
        format: "number",
        valueFrom: (row) => {
          const cells = row.cells as Record<string, ShipCell> | undefined;
          return cells?.[key]?.volume ?? "0";
        }
      },
      {
        key: `e${id}_qty`,
        header: `${title} · Кол-во`,
        align: "right",
        format: "number",
        valueFrom: (row) => {
          const cells = row.cells as Record<string, ShipCell> | undefined;
          return cells?.[key]?.qty ?? "0";
        }
      },
      {
        key: `e${id}_amount`,
        header: `${title} · Сумма`,
        align: "right",
        format: "money",
        valueFrom: (row) => {
          const cells = row.cells as Record<string, ShipCell> | undefined;
          return cells?.[key]?.amount ?? "0";
        }
      }
    );
  }
  return cols;
}

const config: FlatReportConfig = {
  title: "Отгрузки по экспедиторам",
  apiPath: "expeditor-shipments",
  exportPermission: "reports.otgruzki_ekspeditorov.export",
  exportFilename: "otgruzki-po-ekspeditoram.xlsx",
  exportLimit: 2000,
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "select",
      paramKey: "date_type",
      optionsFrom: "date_types",
      defaultValue: "shipped_date"
    },
    { kind: "search", placeholder: "Товар / категория" },
    {
      kind: "multiSelect",
      paramKey: "expeditor_ids",
      optionsFrom: "expeditors",
      placeholder: "Экспедитор"
    },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория товара"
    },
    {
      kind: "multiSelect",
      paramKey: "product_ids",
      optionsFrom: "products",
      placeholder: "Продукт"
    }
  ],
  columns: shipmentsColumns,
  totalsKeys: [],
  rowKey: "product_id",
  countLabel: "Товаров",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["product_name", "category_name"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportExpeditorShipmentsPage() {
  return <FlatReportPage {...config} />;
}
