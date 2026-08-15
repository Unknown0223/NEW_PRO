import { Prisma } from "@prisma/client";
import { DATASET_ORDERS_SALES_LINES } from "./report-builder.constants";
import type {
  ReportBuilderDateMode,
  ReportBuilderFieldMeta,
  ReportBuilderMetadataResponse,
  ReportBuilderWdrFieldMeta
} from "./report-builder.types";

/** Faqat registry kalitlari — tashqi ID SQLga kiritilmaydi. */
import { FIELD_REGISTRY_PART1 } from "./report-builder.field-registry.part1";
import { FIELD_REGISTRY_PART2 } from "./report-builder.field-registry.part2";

const FIELD_REGISTRY: Record<
  string,
  { label: string; allowRow: boolean; allowCol: boolean; expr: () => import("@prisma/client").Prisma.Sql }
> = { ...FIELD_REGISTRY_PART1, ...FIELD_REGISTRY_PART2 };

export const REPORT_BUILDER_FIELD_IDS = Object.keys(FIELD_REGISTRY);

export function isReportBuilderFieldId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIELD_REGISTRY, id);
}

export function fieldExprSql(fieldId: string): Prisma.Sql {
  const f = FIELD_REGISTRY[fieldId];
  if (!f) throw new Error("UNKNOWN_FIELD");
  return f.expr();
}

export function listFieldMetaForDataset(datasetId: string): ReportBuilderFieldMeta[] {
  if (datasetId !== DATASET_ORDERS_SALES_LINES) return [];
  return REPORT_BUILDER_FIELD_IDS.map((id) => {
    const r = FIELD_REGISTRY[id]!;
    return { id, label: r.label, allowRow: r.allowRow, allowCol: r.allowCol };
  });
}

/** WebDataRocks `dataSource.fields` / metadata. */
export function listWdrFieldsForDataset(datasetId: string): ReportBuilderWdrFieldMeta[] {
  if (datasetId !== DATASET_ORDERS_SALES_LINES) return [];
  const dims: ReportBuilderWdrFieldMeta[] = REPORT_BUILDER_FIELD_IDS.map((id) => {
    const r = FIELD_REGISTRY[id]!;
    return { uniqueName: id, caption: r.label, type: "string" as const };
  });
  const measures: ReportBuilderWdrFieldMeta[] = [
    { uniqueName: "amount", caption: "Сумма", type: "number" },
    { uniqueName: "qty", caption: "Количество", type: "number" },
    { uniqueName: "volume", caption: "Объём", type: "number" },
    { uniqueName: "price", caption: "Цена", type: "number" },
    { uniqueName: "bonus_line_total", caption: "Бонус сумма (строка)", type: "number" },
    { uniqueName: "order_bonus_sum", caption: "Бонусы сумма (заказ)", type: "number" },
    { uniqueName: "discount_sum", caption: "Сумма скидки", type: "number" },
    { uniqueName: "client_balance", caption: "Баланс", type: "number" },
    { uniqueName: "order_debt", caption: "Долг по заказу", type: "number" },
    { uniqueName: "product_weight_kg", caption: "Вес товара", type: "number" },
    { uniqueName: "retail_stock_qty", caption: "Остаток в ТТ (кол-во)", type: "number" },
    { uniqueName: "retail_stock_sold_qty", caption: "Продажа в ТТ (кол-во)", type: "number" },
    { uniqueName: "retail_stock_amount", caption: "Сумма в ТТ", type: "number" },
    { uniqueName: "client_id", caption: "АКБ (distinct client_id)", type: "number" }
  ];
  return [...dims, ...measures];
}

export function fieldAllowsRow(fieldId: string): boolean {
  return Boolean(FIELD_REGISTRY[fieldId]?.allowRow);
}

export function fieldAllowsCol(fieldId: string): boolean {
  return Boolean(FIELD_REGISTRY[fieldId]?.allowCol);
}

export function getReportBuilderMetadata(): ReportBuilderMetadataResponse {
  return {
    datasets: [{ id: DATASET_ORDERS_SALES_LINES, label: "Продажи (строки заказа)" }],
    dateModes: [
      { id: "order_date", label: "Дата заказа" },
      { id: "shipped_date", label: "Дата отправки" },
      { id: "delivered_date", label: "Дата доставки" },
      { id: "created_date", label: "Дата создания" }
    ],
    fields: listFieldMetaForDataset(DATASET_ORDERS_SALES_LINES),
    metrics: [
      { id: "amount", label: "Сумма" },
      { id: "qty", label: "Количество" },
      { id: "volume", label: "Объём" },
      { id: "akb", label: "АКБ" }
    ]
  };
}

export function dateExprForMode(mode: ReportBuilderDateMode): Prisma.Sql {
  if (mode === "shipped_date") return Prisma.sql`sl.shipped_at`;
  if (mode === "delivered_date") return Prisma.sql`sl.delivered_at`;
  return Prisma.sql`o.created_at`;
}

