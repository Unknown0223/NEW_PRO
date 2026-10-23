import { describe, expect, it } from "vitest";
import {
  formatVisitWeekdaysRuAbbrev,
  parseVisitWeekdaysFromCell
} from "../src/modules/clients/clients.visit-weekdays";
import {
  buildAgentAssignmentPatchesFromImportRow,
  type ImportStaffLookup
} from "../src/modules/clients/clients.import.assign";
import { parseVisitWeekdaysJson } from "../src/modules/clients/clients.types";

function emptyStaffLookup(): ImportStaffLookup {
  return { byId: new Map(), byCode: new Map(), byName: new Map(), byPhone: new Map() };
}

describe("visit weekdays — all days", () => {
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

  it("1..7 covers every weekday Mon..Sun", () => {
    expect(parseVisitWeekdaysFromCell("1,2,3,4,5,6,7").days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(formatVisitWeekdaysRuAbbrev([1, 2, 3, 4, 5, 6, 7])).toBe("Пн,Вт,Ср,Чт,Пт,Сб,Вс");
  });

  it("abbrev covers every weekday", () => {
    expect(parseVisitWeekdaysFromCell("Пн,Вт,Ср,Чт,Пт,Сб,Вс").days).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("uzbek names cover every weekday", () => {
    expect(
      parseVisitWeekdaysFromCell("dushanba,seshanba,chorshanba,payshanba,juma,shanba,yakshanba").days
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("rejects 0 and keeps only 1..7 from mixed cell", () => {
    expect(parseVisitWeekdaysFromCell("0")).toEqual({ days: [], unknownTokens: ["0"] });
    expect(parseVisitWeekdaysFromCell("0,1,4")).toEqual({
      days: [1, 4],
      unknownTokens: ["0"]
    });
    expect(parseVisitWeekdaysFromCell("5,0")).toEqual({
      days: [5],
      unknownTokens: ["0"]
    });
  });

  it("Saturday=6 Sunday=7", () => {
    expect(parseVisitWeekdaysFromCell("6")).toEqual({ days: [6], unknownTokens: [] });
    expect(parseVisitWeekdaysFromCell("7")).toEqual({ days: [7], unknownTokens: [] });
    expect(parseVisitWeekdaysFromCell("1,6")).toEqual({ days: [1, 6], unknownTokens: [] });
  });

  it("parses uzbek shanba / russian Сб", () => {
    expect(parseVisitWeekdaysFromCell("shanba")).toEqual({ days: [6], unknownTokens: [] });
    expect(parseVisitWeekdaysFromCell("Сб")).toEqual({ days: [6], unknownTokens: [] });
    expect(parseVisitWeekdaysFromCell("1,shanba")).toEqual({ days: [1, 6], unknownTokens: [] });
  });

  it("parseVisitWeekdaysJson ignores 0", () => {
    expect(parseVisitWeekdaysJson([0, 2, 6])).toEqual([2, 6]);
    expect(parseVisitWeekdaysJson("[0,5]")).toEqual([5]);
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

  it("update: changing only days to include Saturday writes patch", () => {
    const warnings: string[] = [];
    const row = ["1,6"];
    const colIndexByKey = { import_agent_1_days: 0 };
    const current = [
      {
        slot: 1,
        agent_id: 42,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: [1]
      }
    ];
    const out = buildAgentAssignmentPatchesFromImportRow(
      row,
      colIndexByKey,
      emptyStaffLookup(),
      2,
      (m) => warnings.push(m),
      current
    );
    expect(out.updatePatches).toEqual([
      {
        slot: 1,
        agent_id: 42,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: [1, 6]
      }
    ]);
    expect(warnings).toHaveLength(0);
  });

  it("update: applySet without days key ignores day column", () => {
    const current = [
      {
        slot: 1,
        agent_id: 42,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: [1]
      }
    ];
    const out = buildAgentAssignmentPatchesFromImportRow(
      ["6"],
      { import_agent_1_days: 0 },
      emptyStaffLookup(),
      2,
      () => {},
      current,
      new Set(["import_agent_1"])
    );
    expect(out.updatePatches).toEqual([]);
  });
});
