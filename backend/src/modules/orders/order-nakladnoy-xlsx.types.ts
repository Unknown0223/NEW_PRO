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
  clientPhone: string | null;
  clientBalanceNum: Prisma.Decimal | null;
  clientAddress: string;
  /** Mijoz «ориентир» (landmark) — bo‘sh bo‘lsa nakladnoyda chiqmaydi */
  clientLandmark: string | null;
  /** Zakaz izohi — bo‘sh bo‘lsa chiqmaydi */
  orderComment: string | null;
  /** Chegirma summasi — 0 / null bo‘lsa chiqmaydi */
  discountSum: number;
  currencyLabel: string;
  agentLine: string;
  /** Накладные 2.1.7 — legacy bir qator (5.2.0 telefon parse uchun saqlanadi) */
  invoiceAgentLine: string;
  /** 2.1.7: faqat agent F.I.Sh */
  agentName: string | null;
  agentPhone: string | null;
  expeditorLine: string;
  expeditorName: string | null;
  expeditorPhone: string | null;
  territory: string;
  /** 2.1.7 «Территория» qatori (agent hududi, bo‘lmasa mijoz) */
  invoiceTerritory: string;
  warehouseName: string | null;
  agentId: number | null;
  expeditorUserId: number | null;
  isConsignment: boolean;
  paymentMethodRef: string | null;
  /** `order` | `return` | `return_by_order` | … — 5.2.0 «Возврат с полки» guruhi */
  orderType: string;
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
