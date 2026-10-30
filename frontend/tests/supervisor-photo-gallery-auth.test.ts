import { describe, expect, it } from "vitest";

/**
 * Mirrors lightbox helpers — bare <img src="/api/..."> cannot send Bearer JWT.
 * Public/blob URLs may be used as-is; API paths must be fetched via axios.
 */
function needsAuthBlobFetch(src: string): boolean {
  if (!src) return false;
  return !(
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  );
}

describe("supervisor photo gallery auth image URLs", () => {
  it("API content paths need authenticated blob fetch", () => {
    expect(
      needsAuthBlobFetch("/api/test1/dashboard/supervisor/photo-reports/12/content")
    ).toBe(true);
  });

  it("blob/data/https do not need auth fetch", () => {
    expect(needsAuthBlobFetch("blob:http://localhost/x")).toBe(false);
    expect(needsAuthBlobFetch("data:image/png;base64,abc")).toBe(false);
    expect(needsAuthBlobFetch("https://cdn.example/p.jpg")).toBe(false);
  });
});
