import { describe, expect, it } from "vitest";

/** mobile.route.ts dagi mobilePhotoReportListOpts nusxasi — test uchun. */
function mobilePhotoReportListOpts(viewer: { role: string }) {
  const viewerRole =
    viewer.role === "agent" || viewer.role === "expeditor" ? viewer.role : null;
  return { viewerRole, todayOnly: true as const };
}

describe("mobile photo report scope", () => {
  it("agent gets agent scope + today only", () => {
    expect(mobilePhotoReportListOpts({ role: "agent" })).toEqual({
      viewerRole: "agent",
      todayOnly: true,
    });
  });

  it("expeditor gets expeditor scope + today only", () => {
    expect(mobilePhotoReportListOpts({ role: "expeditor" })).toEqual({
      viewerRole: "expeditor",
      todayOnly: true,
    });
  });

  it("supervisor has no role filter but still today only", () => {
    expect(mobilePhotoReportListOpts({ role: "supervisor" })).toEqual({
      viewerRole: null,
      todayOnly: true,
    });
  });
});
