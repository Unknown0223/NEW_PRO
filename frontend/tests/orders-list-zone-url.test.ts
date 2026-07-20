import { describe, expect, it } from "vitest";
import {
  buildOrdersSearchParams,
  parseOrdersUrl,
  type OrdersUrlFilters
} from "@/components/orders/orders-list/types";

describe("orders list territory URL binding", () => {
  it("parses client_zone from URL (not neighborhood)", () => {
    const params = new URLSearchParams({
      client_zone: "FV",
      client_region: "ANDIJON VILOYATI",
      client_city: "Asaka",
      neighborhood: "should-be-ignored"
    });
    const f = parseOrdersUrl(params);
    expect(f.client_zone).toBe("FV");
    expect(f.client_region).toBe("ANDIJON VILOYATI");
    expect(f.client_city).toBe("Asaka");
    expect((f as Record<string, unknown>).neighborhood).toBeUndefined();
  });

  it("round-trips client_zone via buildOrdersSearchParams", () => {
    const next = {
      status: "",
      order_type: "",
      page: 1,
      search: "",
      warehouse_id: "",
      agent_id: "",
      expeditor_id: "",
      date_from: "",
      date_to: "",
      client_id: "",
      product_id: "",
      client_category: "",
      client_region: "ANDIJON VILOYATI",
      client_city: "Asaka",
      client_zone: "FV",
      trade_direction: "",
      date_mode: "order",
      is_consignment: "",
      product_category_id: "",
      payment_type: "",
      payment_method_ref: "",
      request_type_ref: "",
      visit_weekday: "",
      price_type: "",
      discount_alert: "",
      bonus_alert: "",
      order_alert: ""
    } as OrdersUrlFilters;
    const qs = buildOrdersSearchParams(next);
    expect(qs.get("client_zone")).toBe("FV");
    expect(qs.get("client_region")).toBe("ANDIJON VILOYATI");
    expect(qs.get("client_city")).toBe("Asaka");
    expect(qs.has("neighborhood")).toBe(false);
    const again = parseOrdersUrl(qs);
    expect(again.client_zone).toBe("FV");
  });
});
