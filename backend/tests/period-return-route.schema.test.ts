import { describe, expect, it } from "vitest";
import { z } from "zod";

/** Mirror `sales-returns.route.write.ts` — erkin polki POST body. */
const periodReturnLine = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive().optional(),
  paid_qty: z.number().min(0).optional(),
  bonus_qty: z.number().min(0).optional(),
  bonus_cash: z.number().min(0).optional(),
  return_qty: z.number().min(0).optional()
});

const periodReturnBody = z.object({
  client_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive().optional(),
  bonus_debt_amount: z.number().min(0).optional(),
  lines: z.array(periodReturnLine).min(1)
});

describe("periodReturnBody zod (erkin polki)", () => {
  it("accepts explicit lines with >24 warehouse units (no document cap in zod)", () => {
    const r = periodReturnBody.safeParse({
      client_id: 1,
      warehouse_id: 1,
      bonus_debt_amount: 33_332,
      lines: [
        { product_id: 1, paid_qty: 20, bonus_qty: 4, return_qty: 24 },
        { product_id: 2, paid_qty: 23, bonus_qty: 0, return_qty: 23 }
      ]
    });
    expect(r.success).toBe(true);
  });
});
