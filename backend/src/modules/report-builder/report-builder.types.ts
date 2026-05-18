export type ReportBuilderDatasetId = "orders_sales_lines";

export type ReportBuilderDateMode = "order_date" | "shipped_date" | "delivered_date" | "created_date";

export type ReportBuilderMetricsFlags = {
  amount: boolean;
  qty: boolean;
  volume: boolean;
  akb: boolean;
};

/** Qo'shimcha filtrlar (universal hisobot panellari). */
export type ReportBuilderExtraFilters = {
  warehouseIds: number[];
  productIds: number[];
  categoryIds: number[];
  productGroupIds: number[];
  brandIds: number[];
  expeditorUserIds: number[];
  supervisorUserIds: number[];
  tradeDirectionIds: number[];
  kpiGroupIds: number[];
  clientIds: number[];
  paymentMethodRefs: string[];
  priceTypeRefs: string[];
  branchValues: string[];
  /** `clients.category` matn qiymatlari */
  clientCategoryValues: string[];
  territoryLevel1Values: string[];
  territoryLevel2Values: string[];
  territoryLevel3Values: string[];
};

/** API / saqlash uchun konfig (JSON). */
export type ReportBuilderConfigPayload = {
  datasetId: ReportBuilderDatasetId;
  dateMode: ReportBuilderDateMode;
  dateFrom: string;
  dateTo: string;
  agentIds: number[];
  statuses: string[];
  orderTypes: string[];
  rowFieldIds: string[];
  colFieldIds: string[];
  metrics: ReportBuilderMetricsFlags;
} & ReportBuilderExtraFilters;

export type ReportBuilderFieldMeta = {
  id: string;
  label: string;
  /** Qator o‘qi sifatida */
  allowRow: boolean;
  /** Ustun o‘qi (pivot) */
  allowCol: boolean;
};

export type ReportBuilderMetadataResponse = {
  datasets: Array<{ id: ReportBuilderDatasetId; label: string }>;
  dateModes: Array<{ id: ReportBuilderDateMode; label: string }>;
  fields: ReportBuilderFieldMeta[];
  metrics: Array<{ id: keyof ReportBuilderMetricsFlags; label: string }>;
};

export type ReportBuilderPreviewResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  totalRowCount: number;
};

/** Pivot UI uchun: noyob ustun qiymatlari + matrix (bir metrika: sum_amount). */
export type ReportBuilderMatrixView = {
  enabled: boolean;
  rowLabels: string[];
  colKeys: string[];
  /** Har bir qator: [col0, col1, ...] */
  cells: (number | null)[][];
  metric: "sum_amount" | "sum_qty" | "sum_volume" | "akb" | null;
};

/** WebDataRocks uchun maydon meta (JSON API). */
export type ReportBuilderWdrFieldMeta = {
  uniqueName: string;
  caption: string;
  type: "string" | "number";
};

/** `/dataset` so‘rovi — faqat filtrlar (GROUP BY yo‘q). */
export type ReportBuilderDatasetRequest = {
  datasetId: ReportBuilderDatasetId;
  dateMode: ReportBuilderDateMode;
  dateFrom: string;
  dateTo: string;
  agentIds: number[];
  statuses: string[];
  orderTypes: string[];
} & ReportBuilderExtraFilters;

export type ReportBuilderFilterOptionRef = { id: string; label: string };

export type ReportBuilderFilterOptionsResponse = {
  agents: Array<{
    id: number;
    name: string;
    code: string | null;
    supervisor_user_id: number | null;
    trade_direction_id: number | null;
    branch: string | null;
  }>;
  statuses: ReportBuilderFilterOptionRef[];
  order_types: ReportBuilderFilterOptionRef[];
  warehouses: Array<{ id: number; name: string; code: string | null }>;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    category_id: number | null;
    product_group_id: number | null;
    brand_id: number | null;
  }>;
  product_categories: Array<{ id: number; name: string }>;
  product_groups: Array<{ id: number; name: string; code: string | null }>;
  brands: Array<{ id: number; name: string; code: string | null }>;
  expeditors: Array<{ id: number; name: string; code: string | null }>;
  supervisors: Array<{ id: number; name: string; code: string | null }>;
  trade_directions: Array<{ id: number; name: string; code: string | null }>;
  kpi_groups: Array<{ id: number; name: string; code: string | null }>;
  clients: Array<{ id: number; name: string; code: string | null }>;
  payment_methods: ReportBuilderFilterOptionRef[];
  price_types: ReportBuilderFilterOptionRef[];
  branches: ReportBuilderFilterOptionRef[];
  client_categories: ReportBuilderFilterOptionRef[];
  territory_level_1: ReportBuilderFilterOptionRef[];
  territory_level_2: ReportBuilderFilterOptionRef[];
  territory_level_3: ReportBuilderFilterOptionRef[];
  territory_2_by_1: Record<string, string[]>;
  territory_3_by_2: Record<string, string[]>;
};

export type ReportBuilderDatasetResponse = {
  fields: ReportBuilderWdrFieldMeta[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  totalRowCount: number;
  cap: number;
};
