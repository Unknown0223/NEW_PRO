import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildSummaryOverpaymentsByType,
  paymentAmountsNetMinusUnpaid
} from "../src/modules/client-balances/client-balances.payments.util";

const spr = ["Naqd", "Plastik", "Перечисление"];

function amtMap(rows: Record<string, string>): Map<string, Prisma.Decimal> {
  const m = new Map<string, Prisma.Decimal>();
  for (const [k, v] of Object.entries(rows)) m.set(k.trim().toLowerCase(), new Prisma.Decimal(v));
  return m;
}

describe("paymentAmountsNetMinusUnpaid (qarz vs peredoplata)", () => {
  it("qarzda tip ustunlari 0 — faqat Общийda ko‘rsatiladi", () => {
    const out = paymentAmountsNetMinusUnpaid(
      spr,
      amtMap({ naqd: "3000000" }),
      amtMap({ naqd: "5000000" }),
      "-2000000"
    );
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.every((x) => x.amount === "0")).toBe(true);
  });

  it("nol balansda tip ustunlari 0", () => {
    const out = paymentAmountsNetMinusUnpaid(spr, amtMap({ naqd: "100" }), amtMap({ naqd: "100" }), "0");
    expect(out.every((x) => x.amount === "0")).toBe(true);
  });

  it("peredoplata: tip bo‘yicha yashil surplus (misol 3M to‘lov − 2M qarz → 1M)", () => {
    const out = paymentAmountsNetMinusUnpaid(
      spr,
      amtMap({ naqd: "3000000" }),
      amtMap({ naqd: "2000000" }),
      "1000000"
    );
    expect(Number(out[0]!.amount)).toBe(1000000);
    expect(out.slice(1).every((x) => Number(x.amount) === 0)).toBe(true);
  });

  it("peredoplata bir necha tipga proporsional bo‘linadi", () => {
    const out = paymentAmountsNetMinusUnpaid(
      spr,
      amtMap({ naqd: "600", plastik: "400" }),
      amtMap({}),
      "500"
    );
    const n = Number(out[0]!.amount);
    const p = Number(out[1]!.amount);
    expect(n + p + Number(out[2]!.amount)).toBeCloseTo(500, 2);
    expect(n).toBeCloseTo(300, 0);
    expect(p).toBeCloseTo(200, 0);
  });

  it("surplus yo‘q lekin balans>0 — birinchi tipga to‘liq", () => {
    const out = paymentAmountsNetMinusUnpaid(spr, amtMap({}), amtMap({}), "1500");
    expect(Number(out[0]!.amount)).toBe(1500);
    expect(Number(out[1]!.amount)).toBe(0);
  });
});

describe("buildSummaryOverpaymentsByType", () => {
  it("faqat peredoplatali mijozlar tipini yig‘adi; qarzli mijoz tipga qo‘shilmaydi", () => {
    const summary = buildSummaryOverpaymentsByType(spr, [
      {
        balance: "-2000000",
        payNorm: amtMap({ naqd: "3000000" }),
        unpaidNorm: amtMap({ naqd: "5000000" })
      },
      {
        balance: "1000000",
        payNorm: amtMap({ naqd: "1000000" }),
        unpaidNorm: amtMap({})
      }
    ]);
    expect(Number(summary[0]!.amount)).toBe(1000000);
    expect(Number(summary[1]!.amount)).toBe(0);
  });
});
