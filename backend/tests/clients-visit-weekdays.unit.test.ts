import { describe, expect, it } from "vitest";
import {
  formatVisitWeekdaysRuAbbrev,
  parseVisitWeekdaysFromCell
} from "../src/modules/clients/clients.visit-weekdays";
import {
  buildAgentAssignmentPatchesFromImportRow,
  type ImportStaffLookup
} from "../src/modules/clients/clients.import.assign";

function emptyStaffLookup(): ImportStaffLookup {
  return { byId: new Map(), byCode: new Map(), byName: new Map(), byPhone: new Map() };
}

describe("visit weekdays import (Пн / Чт abbrev)", () => {
  it("parses Russian 2-letter abbreviations with comma (no spaces)", () => {
    expect(parseVisitWeekdaysFromCell("Чт,Сб,Чт,Пт,Ср,Чт")).toEqual({
      days: [3, 4, 5, 6],
      unknownTokens: []
    });
  });

  it("parses mixed numeric and abbrev", () => {
    expect(parseVisitWeekdaysFromCell("1, Чт, 3")).toEqual({
      days: [1, 3, 4],
      unknownTokens: []
    });
  });

  it("accepts semicolon separator and dots after abbrev", () => {
    expect(parseVisitWeekdaysFromCell("Пн.; Вт; Ср.")).toEqual({
      days: [1, 2, 3],
      unknownTokens: []
    });
  });

  it("formats export as 2-letter Russian abbrev", () => {
    expect(formatVisitWeekdaysRuAbbrev([3, 4, 5, 6])).toBe("Ср,Чт,Пт,Сб");
  });

  it("imports abbrev into agent assignment patch", () => {
    const row = ["", "Чт,Сб,Пт,Ср"];
    const colIndexByKey = { import_agent_1_days: 1 };
    const out = buildAgentAssignmentPatchesFromImportRow(
      row,
      colIndexByKey,
      emptyStaffLookup(),
      2,
      () => {}
    );
    expect(out.createPatches).toEqual([{ slot: 1, visit_weekdays: [3, 4, 5, 6] }]);
    expect(out.touched).toBe(true);
  });
});
