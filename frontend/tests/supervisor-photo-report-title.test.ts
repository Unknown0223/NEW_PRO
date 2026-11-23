import { describe, expect, it } from "vitest";
import { buildSupervisorPhotoReportTitle } from "@/components/dashboard/supervisor/supervisor-photo-report-modal";

describe("buildSupervisorPhotoReportTitle", () => {
  it("omits empty code so title is not 01 — — —", () => {
    expect(
      buildSupervisorPhotoReportTitle({
        agentName: "Agent (seed)",
        agentCode: null,
        date: "2026-11-23"
      })
    ).toBe("Фотоотчет: [Agent (seed)] 23/11/26");
  });

  it("includes code when present", () => {
    expect(
      buildSupervisorPhotoReportTitle({
        agentName: "Дилшод",
        agentCode: "AG-01",
        date: "2026-11-23"
      })
    ).toBe("Фотоотчет: AG-01 · [Дилшод] 23/11/26");
  });
});
