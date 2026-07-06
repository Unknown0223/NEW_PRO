import { describe, expect, it } from "vitest";
import { compareSemver, resolveAppUpdateBlock } from "../src/modules/mobile/app-release.service";

describe("app-release.service", () => {
  it("compareSemver orders versions", () => {
    expect(compareSemver("3.0.0", "3.1.0")).toBeLessThan(0);
    expect(compareSemver("3.1.0", "3.0.0")).toBeGreaterThan(0);
    expect(compareSemver("3.0.0", "3.0.0")).toBe(0);
  });

  it("resolveAppUpdateBlock marks required below min", () => {
    const block = resolveAppUpdateBlock(
      "2.9.0",
      {
        min_version: "3.0.0",
        latest_version: "3.1.0",
        force_update: false,
        download_url: "https://example.com/app.apk",
        store_url_android: null,
        store_url_ios: null,
        release_notes: null
      },
      "android"
    );
    expect(block.required).toBe(true);
    expect(block.optional).toBe(false);
  });

  it("resolveAppUpdateBlock keeps apk_url when store url is set", () => {
    const block = resolveAppUpdateBlock(
      "3.0.0",
      {
        min_version: "3.0.0",
        latest_version: "3.2.0",
        force_update: true,
        download_url: "https://example.com/api/mobile/apk-download?slug=test1",
        store_url_android: "https://play.google.com/store/apps/details?id=uz.salesdoc",
        store_url_ios: null,
        release_notes: null
      },
      "android"
    );
    expect(block.url).toContain("play.google.com");
    expect(block.apk_url).toContain("apk-download");
    expect(block.required).toBe(true);
  });

  it("resolveAppUpdateBlock marks optional below latest", () => {
    const block = resolveAppUpdateBlock(
      "3.0.0",
      {
        min_version: "3.0.0",
        latest_version: "3.1.0",
        force_update: false,
        download_url: null,
        store_url_android: null,
        store_url_ios: null,
        release_notes: "Yangi funksiyalar"
      },
      "android"
    );
    expect(block.required).toBe(false);
    expect(block.optional).toBe(true);
  });
});
