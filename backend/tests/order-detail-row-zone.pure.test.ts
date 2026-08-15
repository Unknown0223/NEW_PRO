import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { toDetailRow } from "../src/modules/orders/domain/order.detail-row";
import type { OrderDetailLoaded } from "../src/modules/orders/domain/order.types";

function minimalOrder(client: Partial<OrderDetailLoaded["client"]>): OrderDetailLoaded {
  return {
    id: 1,
    number: "T-1",
    client_id: 10,
    warehouse_id: null,
    agent_id: null,
    expeditor_user_id: null,
    status: "draft",
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
    created_at: new Date("2026-01-15T10:00:00.000Z"),
    client: {
      name: "Client A",
      legal_name: null,
      client_code: "C1",
      phone: null,
      inn: null,
      address: null,
      landmark: null,
      sales_channel: null,
      region: "ANDIJON VILOYATI",
      city: "Asaka",
      district: "Asaka tumani",
      zone: "FV",
      neighborhood: "Mahalla X",
      category: null,
      responsible_person: null,
      gps_text: null,
      latitude: null,
      longitude: null,
      ...client
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

describe("toDetailRow territory zone binding", () => {
  it("maps zone from client.zone (not neighborhood)", () => {
    const row = toDetailRow(minimalOrder({ zone: "FV", neighborhood: "Mahalla X" }));
    expect(row.zone).toBe("FV");
    expect(row.region).toBe("ANDIJON VILOYATI");
    expect(row.city).toBe("Asaka");
  });

  it("keeps zone null when client.zone is null even if neighborhood is set", () => {
    const row = toDetailRow(minimalOrder({ zone: null, neighborhood: "Mahalla only" }));
    expect(row.zone).toBeNull();
  });
});
