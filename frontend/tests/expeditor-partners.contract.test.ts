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

  it("uses name-only staff pickers (no raw user-id labels)", () => {
    const src = readFileSync(
      join(frontendRoot, "app/(dashboard)/settings/expeditor-partners/page.tsx"),
      "utf8"
    );
    expect(src).toMatch(/staffPickerDisplayName/);
    expect(src).toMatch(/staffPickerSearchText/);
    expect(src).not.toMatch(/Partnyor user id/);
    expect(src).not.toMatch(/Ekspeditor user id/);
  });

  it("appears in Пользователи → КОМАНДА nav next to Экспедиторы", () => {
    const src = readFileSync(
      join(frontendRoot, "components/dashboard/nav-config.ts"),
      "utf8"
    );
    expect(src).toMatch(/\/settings\/expeditor-partners/);
    expect(src).toMatch(/Ulashish partnyorlari/);
  });
});
