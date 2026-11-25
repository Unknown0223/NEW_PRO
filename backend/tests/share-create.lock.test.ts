import { describe, expect, it } from "vitest";
import {
  SHARE_HANDOFF_INCOMPLETE,
  SHARE_ORDER_ALREADY_LOCKED,
  SHARE_SENDER_CANNOT_ACT
} from "../src/modules/mobile/share/share-codes";
import {
  assertOrderShareActionAllowed,
  type ShareLockRow
} from "../src/modules/mobile/share/share-lock.pure";

describe("assertOrderShareActionAllowed", () => {
  const lockedToReceiver: ShareLockRow = {
    orderId: 10,
    locked: true,
    receiverUserId: 2,
    senderUserId: 1,
    status: "faol"
  };

  it("receiver may act on locked faol order", () => {
    expect(() =>
      assertOrderShareActionAllowed({
        orderId: 10,
        actorUserId: 2,
        locks: [lockedToReceiver]
      })
    ).not.toThrow();
  });

  it("sender cannot act when locked to receiver", () => {
    expect(() =>
      assertOrderShareActionAllowed({
        orderId: 10,
        actorUserId: 1,
        locks: [lockedToReceiver]
      })
    ).toThrow(SHARE_SENDER_CANNOT_ACT);
  });

  it("receiver cannot act before faol (handoff incomplete)", () => {
    expect(() =>
      assertOrderShareActionAllowed({
        orderId: 10,
        actorUserId: 2,
        locks: [{ ...lockedToReceiver, status: "yuk_kutilmoqda" }]
      })
    ).toThrow(SHARE_HANDOFF_INCOMPLETE);
  });

  it("no lock → allowed", () => {
    expect(() =>
      assertOrderShareActionAllowed({
        orderId: 99,
        actorUserId: 1,
        locks: [lockedToReceiver]
      })
    ).not.toThrow();
  });

  it("creating share rejects if order already locked", () => {
    expect(() =>
      assertOrderShareActionAllowed({
        orderId: 10,
        actorUserId: 1,
        locks: [lockedToReceiver],
        mode: "create_share"
      })
    ).toThrow(SHARE_ORDER_ALREADY_LOCKED);
  });
});
