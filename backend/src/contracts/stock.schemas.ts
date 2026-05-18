import { z } from "zod";
import { WAREHOUSE_STOCK_PURPOSES } from "../modules/stock/stock.service";

const balanceViewSchema = z.enum(["summary", "valuation", "by_warehouse"]);

/** GET `/api/:slug/stock/balances` query */
export const stockBalancesQuerySchema = z.object({
  view: balanceViewSchema.optional().default("summary"),
  purpose: z.enum(WAREHOUSE_STOCK_PURPOSES).optional().default("sales"),
  warehouse_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  group_id: z.coerce.number().int().positive().optional(),
  active_only: z.enum(["true", "false"]).optional().default("true"),
  qty_mode: z.enum(["all", "positive", "zero"]).optional().default("all"),
  q: z.string().optional().default(""),
  price_type: z.string().min(1).max(128).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(25),
  sort: z.enum(["name_asc", "name_desc", "available_desc"]).optional().default("name_asc")
});

/** GET `/api/:slug/stock/balances/export` query */
export const stockBalancesExportQuerySchema = stockBalancesQuerySchema.omit({
  page: true,
  limit: true
});
