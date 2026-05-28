import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";

/** ExcelJS uchun yuklangan zakaz (faqat shablon chizish). */
export type NakladnoyLine = {
  productId: number;
  sku: string;
  /** Bo‘sh bo‘lsa SKU chiqadi */
  barcode: string | null;
  name: string;
  qty: number;
  bonusQty: number;
  price: number;
  sum: number;
  groupTitle: string;
  qtyPerBlock: number | null;
};

export type NakladnoyOrderPayload = {
  id: number;
  number: string;
  createdAt: Date;
  /** Bir nechta zakaz birlashtirilganda «Дата по» */
  dateTo?: Date | null;
  tenantName: string;
  tenantPhone: string | null;
  clientName: string;
  clientBalanceNum: Prisma.Decimal | null;
  clientAddress: string;
  currencyLabel: string;
  agentLine: string;
  expeditorLine: string;
  territory: string;
  warehouseName: string | null;
  agentId: number | null;
  expeditorUserId: number | null;
  lines: NakladnoyLine[];
  paidLines: NakladnoyLine[];
  bonusLines: NakladnoyLine[];
};

export type NakladnoyCodeColumn = "sku" | "barcode";
export type NakladnoyGroupBy = "territory" | "agent" | "expeditor";

import type { WarehouseExportOptions } from "./warehouse-templates/warehouse-export-options";

export type NakladnoyBuildOptions = {
  codeColumn: NakladnoyCodeColumn;
  /** true: agent / ekspeditor / hudud bo‘yicha alohida varaqlar (Загрузочный лист) */
  separateSheets: boolean;
  /** separateSheets true bo‘lganda */
  groupBy: NakladnoyGroupBy;
  /** 112 / 410 / 600 — shablon sozlamalari */
  warehouseExport?: WarehouseExportOptions;
};

export const DEFAULT_NAKLADNOY_BUILD_OPTIONS: NakladnoyBuildOptions = {
  codeColumn: "sku",
  separateSheets: false,
  groupBy: "agent"
};
