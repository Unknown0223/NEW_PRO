import { describe, expect, it } from "vitest";
import { mapPrismaToUserFacingError } from "../src/lib/prisma-user-facing-error";

describe("mapPrismaToUserFacingError", () => {
  it("maps stock_reserved_qty_nonneg", () => {
    const err = new Error(
      'new row for relation "stock" violates check constraint "stock_reserved_qty_nonneg"'
    );
    err.name = "PrismaClientUnknownRequestError";
    const mapped = mapPrismaToUserFacingError(err);
    expect(mapped?.error).toBe("StockReserveConflict");
    expect(mapped?.statusCode).toBe(409);
    expect(mapped?.message).toMatch(/Резерв склада/);
  });

  it("returns null for unrelated errors", () => {
    expect(mapPrismaToUserFacingError(new Error("boom"))).toBeNull();
  });
});
