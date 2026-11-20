"use client";

/**
 * FlatReport wave-2 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "По ценам",
  apiPath: "prices",
  exportPermission: "reports.po_cenam.export",
  exportFilename: "po-cenam.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Товар / SKU" },
    {
      kind: "multiSelect",
      paramKey: "price_types",
      optionsFrom: "price_types",
      placeholder: "Тип цены"
    },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория"
    },
    { kind: "multiSelect", paramKey: "brand_ids", optionsFrom: "brands", placeholder: "Бренд" },
    {
      kind: "multiSelect",
      paramKey: "product_ids",
      optionsFrom: "products",
      placeholder: "Товар"
    }
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "changed_at", header: "Дата" },
    { key: "product_name", header: "Товар", cellClassName: "font-medium" },
    { key: "sku", header: "SKU" },
    { key: "category_name", header: "Категория" },
    { key: "brand_name", header: "Бренд" },
    { key: "price_type_label", header: "Тип цены" },
    { key: "price", header: "Цена", align: "right", format: "money" },
    { key: "currency", header: "Валюта" },
    { key: "previous_price", header: "Предыдущая", align: "right", format: "money" },
    { key: "diff", header: "Разница", align: "right", format: "money" }
  ],
  totalsKeys: ["change_count", "product_count"],
  totalsLabels: { change_count: "Изменений", product_count: "Товаров" },
  rowKey: "row_number",
  countLabel: "Строк",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["product_name", "sku", "category_name", "brand_name", "price_type_label"],
    placeholder: "Фильтр в таблице…"
  },
  formatters: {
    changed_at: (v) => {
      const s = String(v ?? "");
      if (!s) return "—";
      return s.slice(0, 16).replace("T", " ");
    }
  }
};

export default function ReportPricesPage() {
  return <FlatReportPage {...config} />;
}
