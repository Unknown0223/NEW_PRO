import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { findLatestZeroFromLedgerEvents } from "../src/modules/returns/returns-filter.balance-zero";

describe("findLatestZeroFromLedgerEvents", () => {
  const to = new Date("2026-05-24T23:59:59.000Z");
  const from = new Date("2026-05-17T00:00:00.000Z");

  it("faqat qarzli zakazlar — 0 topilmaydi", () => {
    const zero = findLatestZeroFromLedgerEvents(
      [
        { sort_at: new Date("2026-05-23T10:00:00.000Z"), delta: new Prisma.Decimal(-765000) },
        { sort_at: new Date("2026-05-24T10:00:00.000Z"), delta: new Prisma.Decimal(-765000) }
      ],
      from,
      to
    );
    expect(zero).toBeNull();
  });

  it("to‘lovdan keyin 0 — nuqta topiladi", () => {
    const payAt = new Date("2026-05-24T12:00:00.000Z");
    const zero = findLatestZeroFromLedgerEvents(
      [
        { sort_at: new Date("2026-05-23T10:00:00.000Z"), delta: new Prisma.Decimal(-765000) },
        { sort_at: payAt, delta: new Prisma.Decimal(765000) }
      ],
      from,
      to
    );
    expect(zero?.toISOString()).toBe(payAt.toISOString());
  });

  it("0 davrdan tashqarida — period rejimida topilmaydi", () => {
    const zero = findLatestZeroFromLedgerEvents(
      [
        { sort_at: new Date("2026-05-10T10:00:00.000Z"), delta: new Prisma.Decimal(-500000) },
        { sort_at: new Date("2026-05-10T11:00:00.000Z"), delta: new Prisma.Decimal(500000) },
        { sort_at: new Date("2026-05-23T10:00:00.000Z"), delta: new Prisma.Decimal(-765000) }
      ],
      from,
      to
    );
    expect(zero).toBeNull();
  });
});
