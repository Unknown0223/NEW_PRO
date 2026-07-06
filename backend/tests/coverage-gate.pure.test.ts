import { describe, expect, it } from "vitest";
import {
  ClientEventNames,
  createClientCreatedPayload,
  isClientCreatedPayload,
  isClientMergedPayload
} from "../src/domain/events/client.events";
import {
  createOrderUpdatedPayload,
  isOrderUpdatedPayload,
  OrderEventNames
} from "../src/domain/events/order.events";
import {
  createPaymentCreatedPayload,
  createPaymentVoidedPayload,
  isPaymentCreatedPayload,
  isPaymentVoidedPayload,
  PaymentEventNames
} from "../src/domain/events/payment.events";
import {
  createStockAdjustedPayload,
  isStockAdjustedPayload,
  StockEventNames
} from "../src/domain/events/stock.events";
import {
  GLOBAL_HTTP_BODY_LIMIT_BYTES,
  isMobileFieldRole,
  MOBILE_FIELD_ROLE_NAMES,
  MOBILE_FIELD_ROLES
} from "../src/lib/constants";
import { isLocalhostOrigin } from "../src/lib/cors-options";
import { EXPLICIT_MAP, mapLegacyKeyToStructured } from "../src/modules/access/legacy-key-map";

describe("domain events", () => {
  it("order.updated payload", () => {
    const p = createOrderUpdatedPayload(1, 99);
    expect(p.type).toBe(OrderEventNames.UPDATED);
    expect(isOrderUpdatedPayload(p)).toBe(true);
    expect(isOrderUpdatedPayload({ type: "x" })).toBe(false);
  });

  it("payment created/voided payload", () => {
    const created = createPaymentCreatedPayload(1, 10, 20);
    expect(created.type).toBe(PaymentEventNames.CREATED);
    expect(isPaymentCreatedPayload(created)).toBe(true);
    const voided = createPaymentVoidedPayload(1, 10, 20);
    expect(isPaymentVoidedPayload(voided)).toBe(true);
  });

  it("client created/merged payload", () => {
    const c = createClientCreatedPayload(1, 5);
    expect(c.type).toBe(ClientEventNames.CREATED);
    expect(isClientCreatedPayload(c)).toBe(true);
    expect(
      isClientMergedPayload({
        type: ClientEventNames.MERGED,
        tenant_id: 1,
        source_client_id: 2,
        target_client_id: 3
      })
    ).toBe(true);
  });

  it("stock adjusted payload", () => {
    const s = createStockAdjustedPayload(1, 2, 3, -5);
    expect(s.type).toBe(StockEventNames.ADJUSTED);
    expect(isStockAdjustedPayload(s)).toBe(true);
  });
});

describe("constants", () => {
  it("mobile field roles", () => {
    expect(MOBILE_FIELD_ROLE_NAMES).toEqual(["agent", "expeditor", "supervisor"]);
    expect(MOBILE_FIELD_ROLES.has("agent")).toBe(true);
    expect(isMobileFieldRole("expeditor")).toBe(true);
    expect(isMobileFieldRole("admin")).toBe(false);
  });

  it("global body limit 5MB", () => {
    expect(GLOBAL_HTTP_BODY_LIMIT_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("cors localhost detection", () => {
  it("detects localhost variants", () => {
    expect(isLocalhostOrigin("http://localhost:3000")).toBe(true);
    expect(isLocalhostOrigin("http://127.0.0.1:4000")).toBe(true);
    expect(isLocalhostOrigin("https://panel.example.com")).toBe(false);
  });
});

describe("legacy-key-map EXPLICIT_MAP audit", () => {
  it("har bir explicit kalit strukturali kalitga map bo'ladi", () => {
    for (const [legacy, structured] of Object.entries(EXPLICIT_MAP)) {
      expect(mapLegacyKeyToStructured(legacy)).toBe(structured);
    }
  });
});
