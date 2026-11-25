import { describe, expect, it } from "vitest";
import { SHARE_SENDER_CANNOT_ACT } from "../src/modules/mobile/share/share-codes";
import { assertOrderShareActionAllowed } from "../src/modules/mobile/share/share-lock.pure";

/** T5: status/pay/return hooks use the same lock gate as create_share act mode. */
describe("share sender cannot act on faol lock", () => {
  it("sender blocked on locked faol (deliver/pay path)", () => {
    expect(() =>
      assertOrderShareActionAllowed({
        orderId: 7,
        actorUserId: 100,
        locks: [
          {
            orderId: 7,
            locked: true,
            senderUserId: 100,
            receiverUserId: 200,
            status: "faol"
          }
        ]
      })
    ).toThrow(SHARE_SENDER_CANNOT_ACT);
  });
});
