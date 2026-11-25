import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");

describe("photo report workspace contract", () => {
  it("photo page is table list + agent photo gallery (not mosaic home)", () => {
    const page = readFileSync(
      join(frontendRoot, "app/(dashboard)/reports/photo/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/PhotoReportWorkspace/);
    expect(page).not.toMatch(/FlatReportPage/);

    const wsPath = join(frontendRoot, "components/reports/photo/photo-report-workspace.tsx");
    const galleryPath = join(frontendRoot, "components/reports/photo/photo-report-agent-gallery.tsx");
    const cfgPath = join(frontendRoot, "components/reports/photo/photo-report-config.ts");
    expect(existsSync(wsPath)).toBe(true);
    expect(existsSync(galleryPath)).toBe(true);
    expect(existsSync(cfgPath)).toBe(true);
    const ws = readFileSync(wsPath, "utf8");
    expect(ws).toMatch(/PhotoReportAgentGallery/);
    expect(ws).toMatch(/Клиент/);
    expect(ws).toMatch(/Пользователь/);
    expect(ws).toMatch(/agent_photo_count/);
    expect(ws).not.toMatch(/Открыть/);
    expect(ws).not.toMatch(/Мозаика/);
    expect(ws).not.toMatch(/view === "mosaic"/);
    const cfg = readFileSync(cfgPath, "utf8");
    expect(cfg).toMatch(/filterGridCols:\s*6/);
    expect(cfg).not.toMatch(/kind:\s*"search"/);
  });
});
