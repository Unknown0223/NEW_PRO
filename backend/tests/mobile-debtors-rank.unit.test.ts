import { describe, expect, it } from "vitest";
import { pickMobileDebtorsByBalance } from "../src/modules/mobile/mobile-debtors-rank";

describe("pickMobileDebtorsByBalance", () => {
  it("filters non-debtors and sorts deepest debt first", () => {
    const rows = [
      { id: 1, name: "A", balance: -100 },
      { id: 2, name: "B", balance: 50 },
      { id: 3, name: "C", balance: -500 },
      { id: 4, name: "D", balance: 0 },
      { id: 5, name: "E", balance: -0.005 }
    ];
    const picked = pickMobileDebtorsByBalance(rows, 10);
    expect(picked.map((r) => r.id)).toEqual([3, 1]);
  });

  it("does not drop deep debtors that would fall after alphabetical take:200", () => {
    // Eski bug: name ASC + take 200, keyin filter — Z* mijozlar yo‘qolardi.
    const rows = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      name: `Client ${String(i + 1).padStart(3, "0")}`,
      balance: i < 200 ? 0 : -(i + 1) * 1000
    }));
    // Alphabetically first 200 all have balance 0; debtors are ids 201–250.
    const alphabeticalThenFilter = rows
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200)
      .filter((c) => c.balance < -0.01);
    expect(alphabeticalThenFilter).toHaveLength(0);

    const picked = pickMobileDebtorsByBalance(rows, 500);
    expect(picked).toHaveLength(50);
    expect(picked[0]?.id).toBe(250);
    expect(picked.at(-1)?.id).toBe(201);
  });

  it("respects limit after sort", () => {
    const rows = [
      { id: 1, balance: -10 },
      { id: 2, balance: -30 },
      { id: 3, balance: -20 }
    ];
    expect(pickMobileDebtorsByBalance(rows, 2).map((r) => r.id)).toEqual([2, 3]);
  });
});
