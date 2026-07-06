import { describe, expect, it } from "vitest";
import {
  buildManualPeresortLines,
  buildPeresortReturnLines,
  type ManualPeresortRequest,
  type PeresortPreviewLine,
  type PeresortRequest
} from "../src/modules/mobile/mobile.expeditor.peresort";

function previewLine(p: Partial<PeresortPreviewLine> & { product_id: number }): PeresortPreviewLine {
  return {
    product_id: p.product_id,
    paid_qty: p.paid_qty ?? 0,
    bonus_qty: p.bonus_qty ?? 0,
    bonus_warehouse_product_id: p.bonus_warehouse_product_id ?? p.product_id,
    bonus_debt_amount: p.bonus_debt_amount ?? 0,
    peresort_debt_amount: p.peresort_debt_amount ?? 0
  };
}

describe("buildPeresortReturnLines (AUTO)", () => {
  it("manzilsiz: savdo + bonus manba mahsulotda qoladi", () => {
    const { lines, bonusDebt } = buildPeresortReturnLines({
      previewLines: [previewLine({ product_id: 1, paid_qty: 4, bonus_qty: 1 })],
      reqByProduct: new Map<number, PeresortRequest>([[1, { return_qty: 4 }]]),
      orderBonusPool: new Map([[1, 2]]),
      orderPaidPool: new Map([[1, 16]])
    });
    expect(lines).toEqual([{ product_id: 1, paid_qty: 4, bonus_qty: 1 }]);
    expect(bonusDebt).toBe(0);
  });

  it("qo'lda manzil: SAVDO va BONUS birgalikda manzilga yo'naltiriladi", () => {
    const { lines } = buildPeresortReturnLines({
      previewLines: [previewLine({ product_id: 1, paid_qty: 4, bonus_qty: 1 })],
      reqByProduct: new Map<number, PeresortRequest>([[1, { return_qty: 4, target: 2 }]]),
      orderBonusPool: new Map([
        [1, 2],
        [2, 5]
      ]),
      orderPaidPool: new Map([
        [1, 16],
        [2, 10]
      ])
    });
    // Hammasi 2-mahsulotga: 4 savdo + 1 bonus.
    expect(lines).toEqual([{ product_id: 2, paid_qty: 4, bonus_qty: 1 }]);
  });

  it("manzil pullik qoldig'i yetmasa: oshig'i manbada qoladi", () => {
    const { lines } = buildPeresortReturnLines({
      previewLines: [previewLine({ product_id: 1, paid_qty: 4, bonus_qty: 1 })],
      reqByProduct: new Map<number, PeresortRequest>([[1, { return_qty: 4, target: 2 }]]),
      orderBonusPool: new Map([
        [1, 2],
        [2, 5]
      ]),
      orderPaidPool: new Map([
        [1, 16],
        [2, 1]
      ])
    });
    const byId = new Map(lines.map((l) => [l.product_id, l]));
    expect(byId.get(2)).toEqual({ product_id: 2, paid_qty: 1, bonus_qty: 1 });
    expect(byId.get(1)).toEqual({ product_id: 1, paid_qty: 3, bonus_qty: 0 });
  });
});

describe("buildManualPeresortLines (MANUAL «По продуктам»)", () => {
  it("kiritilgan savdo/bonus aynan hurmat qilinadi (долг yo'q)", () => {
    const { lines } = buildManualPeresortLines({
      manualReq: new Map<number, ManualPeresortRequest>([[1, { paid_qty: 2, bonus_qty: 0 }]]),
      orderBonusPool: new Map([[1, 2]]),
      orderPaidPool: new Map([[1, 16]])
    });
    expect(lines).toEqual([{ product_id: 1, paid_qty: 2, bonus_qty: 0 }]);
  });

  it("qo'lda manzil: savdo + bonus manzilga yo'naltiriladi", () => {
    const { lines } = buildManualPeresortLines({
      manualReq: new Map<number, ManualPeresortRequest>([
        [1, { paid_qty: 3, bonus_qty: 1, target: 2 }]
      ]),
      orderBonusPool: new Map([
        [1, 2],
        [2, 4]
      ]),
      orderPaidPool: new Map([
        [1, 16],
        [2, 8]
      ])
    });
    expect(lines).toEqual([{ product_id: 2, paid_qty: 3, bonus_qty: 1 }]);
  });
});
