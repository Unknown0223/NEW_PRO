import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  inferListCreationChannel,
  normalizeStoredCreationChannel,
  orderCreationChannelFromRole,
  resolveOrderCreationChannel
} from "../src/modules/orders/domain/order.creation-channel";
import { toDetailRow } from "../src/modules/orders/domain/order.detail-row";
import type { OrderDetailLoaded } from "../src/modules/orders/domain/order.types";

describe("orderCreationChannelFromRole", () => {
  it("maps agent and expeditor to mobile", () => {
    expect(orderCreationChannelFromRole("agent")).toBe("mobile");
    expect(orderCreationChannelFromRole("AGENT")).toBe("mobile");
    expect(orderCreationChannelFromRole("expeditor")).toBe("mobile");
  });

  it("maps office roles to web", () => {
    expect(orderCreationChannelFromRole("operator")).toBe("web");
    expect(orderCreationChannelFromRole("admin")).toBe("web");
    expect(orderCreationChannelFromRole(null)).toBe("web");
  });
});

describe("resolveOrderCreationChannel", () => {
  it("prefers explicit mobile from the app API", () => {
    expect(resolveOrderCreationChannel({ explicit: "mobile", viewerRole: "operator" })).toBe(
      "mobile"
    );
  });

  it("infers from viewer when explicit is omitted", () => {
    expect(resolveOrderCreationChannel({ viewerRole: "agent" })).toBe("mobile");
    expect(resolveOrderCreationChannel({ viewerRole: "operator" })).toBe("web");
  });
});

describe("normalizeStoredCreationChannel", () => {
  it("keeps stored mobile even when fallback is web", () => {
    expect(normalizeStoredCreationChannel("mobile", "web")).toBe("mobile");
    expect(normalizeStoredCreationChannel("web", "mobile")).toBe("web");
    expect(normalizeStoredCreationChannel(null, "web")).toBe("web");
    expect(normalizeStoredCreationChannel("other", "mobile")).toBe("mobile");
  });
});

describe("inferListCreationChannel", () => {
  it("does not treat a later web cancel as the creation source", () => {
    expect(
      inferListCreationChannel({ firstLogRole: "operator", agentRole: "agent" })
    ).toBe("mobile");
  });

  it("keeps mobile when the first status actor is the agent", () => {
    expect(inferListCreationChannel({ firstLogRole: "agent", agentRole: "agent" })).toBe(
      "mobile"
    );
  });

  it("stays web for office orders without a field agent", () => {
    expect(
      inferListCreationChannel({ firstLogRole: "operator", agentRole: "operator" })
    ).toBe("web");
  });
});

describe("toDetailRow creation_channel", () => {
  function order(channel: string | null): OrderDetailLoaded {
    return {
      id: 1,
      number: "T-1",
      client_id: 10,
      warehouse_id: null,
      agent_id: null,
      expeditor_user_id: null,
      status: "cancelled",
      approval_status: null,
      approval_step: 0,
      total_sum: new Prisma.Decimal(0),
      bonus_sum: new Prisma.Decimal(0),
      discount_sum: new Prisma.Decimal(0),
      applied_auto_bonus_rule_ids: [],
      comment: null,
      request_type_ref: null,
      order_type: "order",
      is_consignment: false,
      consignment_due_date: null,
      payment_method_ref: null,
      warehouse_block_id: null,
      discount_alert: null,
      bonus_alert: null,
      creation_channel: channel,
      created_at: new Date("2026-09-01T10:00:00.000Z"),
      client: {
        name: "Client A",
        legal_name: null,
        client_code: "C1",
        phone: null,
        inn: null,
        address: null,
        landmark: null,
        sales_channel: null,
        region: null,
        city: null,
        district: null,
        zone: null,
        neighborhood: null,
        category: null,
        responsible_person: null,
        gps_text: null,
        latitude: null,
        longitude: null
      },
      warehouse: null,
      warehouse_block: null,
      agent: null,
      expeditor_user: null,
      items: [],
      status_logs: [],
      change_logs: []
    };
  }

  it("uses stored mobile instead of hardcoding web", () => {
    expect(toDetailRow(order("mobile")).creation_channel).toBe("mobile");
  });

  it("falls back to web when stored is empty", () => {
    expect(toDetailRow(order(null)).creation_channel).toBe("web");
  });
});
