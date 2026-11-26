import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

describe("cover routes contract", () => {
  it("registers cover endpoints for agent/SVR", () => {
    const route = readFileSync(
      join(root, "src/modules/mobile/mobile.route.cover.ts"),
      "utf8"
    );
    expect(route).toMatch(/\/api\/:slug\/mobile\/cover/);
    expect(route).toMatch(/\/accept/);
    expect(route).toMatch(/\/face/);
    expect(route).toMatch(/\/active/);
    expect(route).toMatch(/\/end/);
  });

  it("wires cover into mobile.route.ts", () => {
    const main = readFileSync(
      join(root, "src/modules/mobile/mobile.route.ts"),
      "utf8"
    );
    expect(main).toMatch(/registerMobileCoverRoutes/);
  });

  it("blocks agent mutations while covered", () => {
    const orders = readFileSync(
      join(root, "src/modules/mobile/mobile.route.agent.orders.ts"),
      "utf8"
    );
    const clients = readFileSync(
      join(root, "src/modules/mobile/mobile.route.agent.clients.ts"),
      "utf8"
    );
    expect(orders).toMatch(/assertAgentNotUnderActiveCover/);
    expect(clients).toMatch(/assertAgentNotUnderActiveCover/);
    expect(orders).toMatch(/COVER_AGENT_BLOCKED/);
  });

  it("SVR viaCover remaps agent scope on orders/clients/config", () => {
    const orders = readFileSync(
      join(root, "src/modules/mobile/mobile.route.agent.orders.ts"),
      "utf8"
    );
    const clients = readFileSync(
      join(root, "src/modules/mobile/mobile.route.agent.clients.ts"),
      "utf8"
    );
    const config = readFileSync(
      join(root, "src/modules/mobile/mobile.route.agent.config.ts"),
      "utf8"
    );
    const face = readFileSync(
      join(root, "src/modules/mobile/cover/cover.service.ts"),
      "utf8"
    );
    expect(orders).toMatch(/resolveCoverRouteScope/);
    expect(clients).toMatch(/resolveCoverRouteScope/);
    expect(config).toMatch(/resolveCoverRouteScope/);
    expect(config).toMatch(/cover_acting_as_agent_id/);
    expect(face).toMatch(/canTrustCoverFaceOkMark/);
    expect(face).toMatch(/cover_accept/);
  });

  it("enrich responses with agent_name/svr_name in cover service", () => {
    const svc = readFileSync(
      join(root, "src/modules/mobile/cover/cover.service.ts"),
      "utf8"
    );
    expect(svc).toMatch(/agent_name/);
    expect(svc).toMatch(/svr_name/);
    expect(svc).toMatch(/coverPersonDisplayName/);
  });
});
