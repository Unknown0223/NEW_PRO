import { describe, expect, it } from "vitest";
import {
  isShareNotificationCode,
  SHARE_NOTIFICATION_CODES
} from "../src/modules/mobile/share/share-notification-codes";

describe("share notification codes", () => {
  it("recognizes SHARE_REQUEST_NEW", () => {
    expect(isShareNotificationCode("SHARE_REQUEST_NEW")).toBe(true);
    expect(SHARE_NOTIFICATION_CODES.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects unknown", () => {
    expect(isShareNotificationCode("FOO")).toBe(false);
  });
});
