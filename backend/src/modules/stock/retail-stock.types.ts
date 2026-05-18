import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


export type RetailStockView = "products" | "categories";

export type RetailStockListQuery = {
  date_from?: string;
  date_to?: string;
  agent_id?: number;
  category_id?: number;
  product_id?: number;
  price_type?: string;
  territory_1?: string;
  territory_2?: string;
  territory_3?: string;
  view: RetailStockView;
  page: number;
  limit: number;
};

export type RetailStockDetailedRow = {
  stock_date: string;
  client_id: number;
  client_name: string;
  territory: string;
  agent_id: number | null;
  agent_name: string | null;
  category_id: number | null;
  category_name: string | null;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: string;
  sold_quantity: string;
  volume: string | null;
  amount: string;
  price_type: string | null;
  comment: string | null;
};

export type RetailStockCategoryRow = {
  stock_date: string;
  category_id: number | null;
  category_name: string;
  quantity: string;
  sold_quantity: string;
  amount: string;
  coverage_clients: number;
};

export type RetailStockListResult = {
  view: RetailStockView;
  page: number;
  limit: number;
  total: number;
  kpi: {
    base_presence_rate: string;
    sales_coefficient: string;
  };
  data: RetailStockDetailedRow[] | RetailStockCategoryRow[];
};
