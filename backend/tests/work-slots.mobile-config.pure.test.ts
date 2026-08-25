/**
 * Pure tests: staff workplace guard + mobile_config slot-first merge helpers.
 */
import { describe, expect, it } from "vitest";
import {
  inputHasWorkplaceStaffFields,
  WORKPLACE_STAFF_PATCH_KEYS
} from "../src/modules/work-slots/work-slots.staff-guard";
import {
  mergeSlotEntitlementsPreservingMobileConfig,
  personalEntitlementsAfterClearWorkplace,
  slotEntitlementsFromUserEntitlements
} from "../src/modules/work-slots/work-slots.config-mirror";

describe("work-slots.staff-guard", () => {
  it("lists workplace keys including mobile entitlements", () => {
    expect(WORKPLACE_STAFF_PATCH_KEYS).toContain("agent_entitlements");
    expect(WORKPLACE_STAFF_PATCH_KEYS).toContain("warehouse_id");
    expect(WORKPLACE_STAFF_PATCH_KEYS).toContain("cash_desk_id");
    expect(inputHasWorkplaceStaffFields({ login: "x" })).toBe(false);
    expect(inputHasWorkplaceStaffFields({ territory: "A / B" })).toBe(true);
    expect(inputHasWorkplaceStaffFields({ cash_desk_id: 1 })).toBe(true);
  });
});

describe("work-slots.mobile_config slot-first", () => {
  it("mirrors slot mobile_config over user when present", () => {
    const merged = mergeSlotEntitlementsPreservingMobileConfig(
      { mobile_config: { schema_version: 1, client: { can_create: true } } },
      { mobile_config: { schema_version: 1, client: { can_create: false } } }
    );
    expect((merged.mobile_config as { client?: { can_create?: boolean } }).client?.can_create).toBe(
      true
    );
  });

  it("backfill keeps mobile_config on slot entitlements", () => {
    const fromUser = slotEntitlementsFromUserEntitlements({
      price_types: ["R"],
      mobile_config: { schema_version: 1 }
    });
    expect(fromUser.mobile_config).toBeDefined();
  });

  it("clear workplace strips mobile_config from user entitlements", () => {
    expect(
      personalEntitlementsAfterClearWorkplace({
        price_types: ["R"],
        mobile_config: { schema_version: 1 }
      })
    ).toEqual({});
  });
});
