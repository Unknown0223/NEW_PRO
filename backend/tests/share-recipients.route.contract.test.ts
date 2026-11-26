import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

describe("share recipients + names contract", () => {
  it("exposes mobile recipients endpoint", () => {
    const route = readFileSync(
      join(root, "src/modules/mobile/mobile.route.expeditor.share.ts"),
      "utf8"
    );
    expect(route).toMatch(/\/expeditor\/share\/recipients/);
    expect(route).toMatch(/listEligibleShareRecipients/);
  });

  it("listShareRequests attaches sender_name/receiver_name", () => {
    const svc = readFileSync(
      join(root, "src/modules/mobile/share/share.service.ts"),
      "utf8"
    );
    expect(svc).toMatch(/sender_name/);
    expect(svc).toMatch(/receiver_name/);
    expect(svc).toMatch(/listEligibleShareRecipients/);
  });
});
