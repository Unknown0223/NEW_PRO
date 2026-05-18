import { z } from "zod";

export const createCategoryBody = z.object({
  name: z.string().min(1).max(500),
  parent_id: z.number().int().positive().nullable().optional(),
  code: z.string().max(24).nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
  default_unit: z.string().max(64).nullable().optional(),
  is_active: z.boolean().optional(),
  comment: z.string().max(4000).nullable().optional()
});

export const patchCategoryBody = z
  .object({
    name: z.string().min(1).max(500).optional(),
    parent_id: z.number().int().positive().nullable().optional(),
    code: z.string().max(24).nullable().optional(),
    sort_order: z.number().int().nullable().optional(),
    default_unit: z.string().max(64).nullable().optional(),
    is_active: z.boolean().optional(),
    comment: z.string().max(4000).nullable().optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

const warehouseLinkSchema = z.object({
  user_id: z.number().int().positive(),
  link_role: z.enum([
    "agent",
    "cashier",
    "manager",
    "operator",
    "storekeeper",
    "supervisor",
    "expeditor"
  ])
});

const warehouseStockPurposeSchema = z.enum(["sales", "return", "reserve"]);

export const createWarehouseBody = z.object({
  name: z.string().min(1).max(300),
  type: z.string().max(200).nullable().optional(),
  stock_purpose: warehouseStockPurposeSchema.optional(),
  address: z.string().max(500).nullable().optional(),
  code: z.string().max(40).nullable().optional(),
  payment_method: z.string().max(200).nullable().optional(),
  van_selling: z.boolean().optional(),
  is_active: z.boolean().optional(),
  links: z.array(warehouseLinkSchema).optional()
});

export const patchWarehouseBody = z
  .object({
    name: z.string().min(1).max(300).optional(),
    type: z.string().max(200).nullable().optional(),
    stock_purpose: warehouseStockPurposeSchema.optional(),
    address: z.string().max(500).nullable().optional(),
    code: z.string().max(40).nullable().optional(),
    payment_method: z.string().max(200).nullable().optional(),
    van_selling: z.boolean().optional(),
    is_active: z.boolean().optional(),
    links: z.array(warehouseLinkSchema).optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });
