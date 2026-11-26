import { describe, expect, it } from "vitest";
import { isShareNotificationCode } from "../src/modules/mobile/share/share-notification-codes";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("share notify wiring", () => {
  it("emit helper + service call sites exist", () => {
    const root = join(__dirname, "../src/modules/mobile/share");
    const notify = readFileSync(join(root, "share-notify.ts"), "utf8");
    expect(notify).toMatch(/emitShareNotification/);
    expect(notify).toMatch(/SHARE_REQUEST_NEW/);
    expect(isShareNotificationCode("SHARE_RETURN_REQUEST")).toBe(true);

    const service = readFileSync(join(root, "share.service.ts"), "utf8");
    expect(service).toMatch(/emitShareNotification/);
    const accept = readFileSync(join(root, "share-accept-handoff.service.ts"), "utf8");
    expect(accept).toMatch(/emitShareNotification/);
    const ret = readFileSync(join(root, "share-return.service.ts"), "utf8");
    expect(ret).toMatch(/emitShareNotification/);
  });
});
