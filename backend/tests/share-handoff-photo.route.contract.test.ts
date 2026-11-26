import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

describe("share handoff photo upload", () => {
  it("registers handoff-photo route and rejects capture: keys", () => {
    const main = readFileSync(
      join(root, "src/modules/mobile/mobile.route.expeditor.share.ts"),
      "utf8"
    );
    const handoff = readFileSync(
      join(root, "src/modules/mobile/mobile.route.expeditor.share.handoff.ts"),
      "utf8"
    );
    expect(main).toMatch(/registerMobileExpeditorShareHandoffRoutes/);
    expect(handoff).toMatch(/handoff-photo/);
    expect(handoff).toMatch(/uploadShareHandoffPhoto/);
    expect(handoff).toMatch(/SHARE_PHOTO_UPLOAD_REQUIRED/);
    expect(handoff).toMatch(/capture:/);
  });

  it("stores under tenants/.../share-handoff prefix", () => {
    const svc = readFileSync(
      join(root, "src/modules/mobile/share/share-handoff-photo.service.ts"),
      "utf8"
    );
    expect(svc).toMatch(/share-handoff/);
    expect(svc).toMatch(/storagePut/);
  });
});
