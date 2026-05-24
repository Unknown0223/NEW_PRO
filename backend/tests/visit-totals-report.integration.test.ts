import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { compareVisitTotalsWithDashboardVisitReport } from "../src/modules/reports/visit-totals-report.service";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("visit-totals vs dashboard visit_report", () => {
  it("single-day planned / visited / sales match snapshot logic", async () => {
    const agent = await prisma.user.findFirst({
      where: { role: "agent", is_active: true },
      select: { id: true, tenant_id: true }
    });
    if (!agent) return;

    const day = new Date().toISOString().slice(0, 10);
    const r = await compareVisitTotalsWithDashboardVisitReport(agent.tenant_id, day, agent.id);

    expect(r.dashboard_planned).toBe(r.totals_planned);
    expect(r.dashboard_visited_planned).toBe(r.totals_visited_planned);
    expect(r.dashboard_visited_total).toBe(r.totals_visited_total);
    expect(r.dashboard_sales).toBe(r.totals_sales);
  });
});
