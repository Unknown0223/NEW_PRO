import { describe, expect, it } from "vitest";
import {
  compareSemver,
  isOwnApkDownloadUrl,
  resolveAppUpdateBlock,
  withoutBrokenUpdateOffer
} from "../src/modules/mobile/app-release.service";

describe("app-release.service", () => {
  it("compareSemver orders versions", () => {
    expect(compareSemver("3.0.0", "3.1.0")).toBeLessThan(0);
    expect(compareSemver("3.1.0", "3.0.0")).toBeGreaterThan(0);
    expect(compareSemver("3.0.0", "3.0.0")).toBe(0);
  });

  it("isOwnApkDownloadUrl detects server OTA links", () => {
    expect(
      isOwnApkDownloadUrl("https://api.example.com/api/mobile/apk-download?slug=test1", "test1")
    ).toBe(true);
    expect(
      isOwnApkDownloadUrl("https://api.example.com/api/mobile/apk-download?slug=TEST1", "test1")
    ).toBe(true);
    expect(isOwnApkDownloadUrl("https://cdn.example.com/app.apk", "test1")).toBe(false);
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

  it("resolveAppUpdateBlock stays optional when force_update is off and above min", () => {
    const block = resolveAppUpdateBlock(
      "3.1.10",
      {
        min_version: "3.1.0",
        latest_version: "3.1.21",
        force_update: false,
        download_url: "https://example.com/app.apk",
        store_url_android: null,
        store_url_ios: null,
        release_notes: "Soft OTA"
      },
      "android"
    );
    expect(block.required).toBe(false);
    expect(block.optional).toBe(true);
    expect(block.apk_url).toContain("app.apk");
  });

  it("withoutBrokenUpdateOffer drops required when APK is missing", () => {
    const next = withoutBrokenUpdateOffer({
      required: true,
      optional: false,
      current_version: "3.0.9",
      min_version: "3.1.0",
      latest_version: "3.1.21",
      url: "https://backend.example/api/mobile/apk-download?slug=test1",
      apk_url: "https://backend.example/api/mobile/apk-download?slug=test1",
      store_url_android: null,
      store_url_ios: null,
      notes: null
    });
    expect(next.required).toBe(false);
    expect(next.optional).toBe(false);
    expect(next.apk_url).toBeNull();
  });

  it("withoutBrokenUpdateOffer keeps required when APK file is ready", () => {
    const url = "https://backend.example/api/mobile/apk-download?slug=test1";
    const next = withoutBrokenUpdateOffer(
      {
        required: true,
        optional: false,
        current_version: "3.0.9",
        min_version: "3.1.0",
        latest_version: "3.1.21",
        url,
        apk_url: url,
        store_url_android: null,
        store_url_ios: null,
        notes: null
      },
      { apkFileReady: true }
    );
    expect(next.required).toBe(true);
    expect(next.apk_url).toBe(url);
  });
});
