import { describe, expect, it } from "vitest";
import {
  decodeStoredPhotoContent,
  isInlineHeavyPhotoUrl,
  resolvePhotoUrlForClient,
  supervisorPhotoContentPath
} from "../src/modules/dashboard/dashboard.supervisor.photo-reports";

describe("supervisor photo report url helpers", () => {
  it("detects heavy inline base64 / data urls", () => {
    expect(isInlineHeavyPhotoUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isInlineHeavyPhotoUrl("https://cdn.example.com/a.jpg")).toBe(false);
    expect(isInlineHeavyPhotoUrl("/api/x/content")).toBe(false);
    expect(isInlineHeavyPhotoUrl("a".repeat(500))).toBe(true);
  });

  it("builds proxy path for heavy images", () => {
    expect(supervisorPhotoContentPath("demo", 42)).toBe(
      "/api/demo/dashboard/supervisor/photo-reports/42/content"
    );
    expect(resolvePhotoUrlForClient("demo", 7, "data:image/png;base64,abc")).toBe(
      "/api/demo/dashboard/supervisor/photo-reports/7/content"
    );
    expect(resolvePhotoUrlForClient("demo", 7, "https://cdn/x.jpg")).toBe("https://cdn/x.jpg");
  });

  it("decodes data-url photos", () => {
    const raw = Buffer.from("hello").toString("base64");
    const decoded = decodeStoredPhotoContent(`data:image/png;base64,${raw}`);
    expect(decoded?.contentType).toBe("image/png");
    expect(decoded?.buffer.toString("utf8")).toBe("hello");
  });
});
