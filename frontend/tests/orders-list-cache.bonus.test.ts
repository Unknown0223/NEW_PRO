import { describe, expect, it, vi } from "vitest";
import { applyOrderDetailToListCaches } from "../lib/orders-list-cache";
import type { OrderDetailRow } from "../components/orders/order-detail-view";

describe("applyOrderDetailToListCaches", () => {
  it("ro‘yxat bonus ustunini detail qatorlaridan yangilaydi", () => {
    const detail = {
      id: 95,
      bonus_qty: "1",
      bonus_sum: "0",
      discount_sum: "0",
      total_sum: "327000",
      status: "new",
      items: [
        { id: 1, product_id: 4, qty: "1", is_bonus: false },
        { id: 2, product_id: 5, qty: "1", is_bonus: true }
      ]
    } as unknown as OrderDetailRow;

    const patch = vi.fn();
    const qc = {
      setQueriesData: (_key: unknown, updater: (old: unknown) => unknown) => {
        const next = updater({
          data: [{ id: 95, bonus_qty: "0", bonus_sum: "0", status: "new" }],
          total: 1,
          page: 1,
          limit: 15
        });
        patch(next);
      }
    };

    applyOrderDetailToListCaches(qc as never, "test1", detail);
    const body = patch.mock.calls[0]![0] as { data: { bonus_qty: string }[] };
    expect(body.data[0]!.bonus_qty).toBe("1");
  });

  it("detail.bonus_qty 0 bo‘lsa ham is_bonus qatorlardan oladi", () => {
    const detail = {
      id: 95,
      bonus_qty: "0",
      bonus_sum: "0",
      status: "new",
      items: [
        { id: 1, product_id: 4, qty: "1", is_bonus: false },
        { id: 2, product_id: 5, qty: "1", is_bonus: true }
      ]
    } as unknown as OrderDetailRow;

    const patch = vi.fn();
    const qc = {
      setQueriesData: (_key: unknown, updater: (old: unknown) => unknown) => {
        const next = updater({
          data: [{ id: 95, bonus_qty: "0", bonus_sum: "0", status: "new" }],
          total: 1,
          page: 1,
          limit: 15
        });
        patch(next);
      }
    };

    applyOrderDetailToListCaches(qc as never, "test1", detail);
    const body = patch.mock.calls[0]![0] as { data: { bonus_qty: string }[] };
    expect(body.data[0]!.bonus_qty).toBe("1");
  });
});
