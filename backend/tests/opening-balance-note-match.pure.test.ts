import { describe, expect, it } from "vitest";
import {
  noteMatchesEntry,
  openingBalanceLedgerNote
} from "../src/modules/opening-balances/opening-balances.write";

describe("noteMatchesEntry", () => {
  it("mos keladi — aniq id", () => {
    expect(noteMatchesEntry("Добавлено через начальный баланс #12 (задолженность)", 12)).toBe(
      true
    );
  });

  it("#12 #123 ga mos kelmasin", () => {
    expect(noteMatchesEntry(openingBalanceLedgerNote(123, "debt"), 12)).toBe(false);
    expect(noteMatchesEntry(openingBalanceLedgerNote(12, "debt"), 123)).toBe(false);
    expect(noteMatchesEntry(openingBalanceLedgerNote(12, "debt"), 12)).toBe(true);
  });

  it("user note qo‘shilgan bo‘lsa ham topadi", () => {
    const note = `${openingBalanceLedgerNote(7, "surplus")}. Старый долг`;
    expect(noteMatchesEntry(note, 7)).toBe(true);
  });
});
