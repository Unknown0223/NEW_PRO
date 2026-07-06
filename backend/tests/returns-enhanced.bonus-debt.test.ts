import { describe, expect, it } from "vitest";
import { bonusDebtNote, BONUS_DEBT_MOVEMENT_NOTE } from "../src/modules/returns/returns-enhanced.bonus-debt";

describe("returns-enhanced.bonus-debt", () => {
  it("bonusDebtNote without return number", () => {
    expect(bonusDebtNote(null)).toBe(BONUS_DEBT_MOVEMENT_NOTE);
    expect(bonusDebtNote("")).toBe(BONUS_DEBT_MOVEMENT_NOTE);
  });

  it("bonusDebtNote with return number", () => {
    expect(bonusDebtNote("VR-2026-001")).toBe("Долг бонус · VR-2026-001");
  });
});
