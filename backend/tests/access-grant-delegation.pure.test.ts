import { describe, expect, it } from "vitest";
import {
  canGrantOperationToOthers,
  fromGrantDelegationKey,
  isCorruptedGrantArtifactKey,
  isGrantDelegationKey,
  isMatrixOperationKey,
  toGrantDelegationKey
} from "../src/modules/access/access-grant-delegation";

describe("access grant delegation keys", () => {
  it("round-trips operation key", () => {
    expect(toGrantDelegationKey("automation.status.change")).toBe("access.grant.automation.status.change");
    expect(fromGrantDelegationKey("access.grant.automation.status.change")).toBe("automation.status.change");
  });

  it("strips nested grant prefix", () => {
    expect(toGrantDelegationKey("access.grant.access.grant.orders.view")).toBe("access.grant.orders.view");
    expect(fromGrantDelegationKey("access.grant.access.grant.orders.view")).toBe("orders.view");
  });

  it("detects delegation keys", () => {
    expect(isGrantDelegationKey("access.grant.orders.view")).toBe(true);
    expect(isGrantDelegationKey("orders.view")).toBe(false);
  });

  it("matrix excludes grant delegation artifacts", () => {
    expect(isMatrixOperationKey("orders.view")).toBe(true);
    expect(isMatrixOperationKey("access.grant.orders.view")).toBe(false);
    expect(isCorruptedGrantArtifactKey("access.grant.access.grant.foo")).toBe(true);
    expect(isMatrixOperationKey("access.grant.access.grant.foo")).toBe(false);
  });

  it("canGrantOperationToOthers reads user allow only", () => {
    const map = new Map<string, "allow" | "deny">([
      [toGrantDelegationKey("orders.view"), "allow"]
    ]);
    expect(canGrantOperationToOthers(map, "orders.view")).toBe(true);
    expect(canGrantOperationToOthers(map, "orders.create")).toBe(false);
  });
});
