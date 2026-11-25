import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("expeditor-partners page contract", () => {
  it("documents empty→own warehouse vs partners mode", () => {
    const src = readFileSync(
      join(frontendRoot, "app/(dashboard)/settings/expeditor-partners/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/Ulashish partnyorlari/);
    expect(src).toMatch(/own_warehouse/);
    expect(src).toMatch(/share-partners/);
    expect(src).toMatch(/o‘z ombori/);
  });
});
