import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { resolveBackendAsset, resolveBackendAssetFrom } from "../src/lib/backend-assets";

describe("resolveBackendAsset", () => {
  it("finds the 5.1.8 template from src and from the compiled dist layout", () => {
    const file = ["nakladnoy", "loading", "518-zagruz-5.1.8.xlsx"] as const;
    const fromSrc = resolveBackendAsset(...file);
    expect(existsSync(fromSrc)).toBe(true);

    const fakeDistFile = join(process.cwd(), "dist/src/modules/orders/warehouse-templates");
    const fromDist = resolveBackendAssetFrom([fakeDistFile], ...file);
    expect(existsSync(fromDist)).toBe(true);
    expect(fromDist.replace(/\\/g, "/")).toBe(fromSrc.replace(/\\/g, "/"));
  });
});
