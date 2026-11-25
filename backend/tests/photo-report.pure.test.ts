import { describe, expect, it } from "vitest";
import { photoContentCacheKey } from "../src/modules/dashboard/dashboard.supervisor.photo-content";
import { buildPhotoReportThumbUrl } from "../src/modules/reports/photo-report.content";

describe("photoContentCacheKey", () => {
  it("includes tenantId so tenants cannot share cache slots", () => {
    expect(photoContentCacheKey(3, 9, true)).toBe("3:9:t");
    expect(photoContentCacheKey(1, 9, true)).toBe("1:9:t");
    expect(photoContentCacheKey(3, 9, true)).not.toBe(photoContentCacheKey(1, 9, true));
  });
});

describe("buildPhotoReportThumbUrl", () => {
  it("returns null when purged or archived", () => {
    expect(buildPhotoReportThumbUrl("aksit", 9, true)).toBeNull();
  });

  it("points at reports content with thumb=1", () => {
    expect(buildPhotoReportThumbUrl("aksit", 9, false)).toBe(
      "/api/aksit/reports/photo/9/content?thumb=1"
    );
  });
});
