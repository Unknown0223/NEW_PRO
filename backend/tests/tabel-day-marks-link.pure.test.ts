import { describe, expect, it } from "vitest";
import { dayMarksHref, dayMarksLinkQuery } from "../src/modules/tabel/tabel-day-marks-link.pure";
import { buildVisitStaffRows } from "../src/modules/tabel/tabel-visit-staff.pure";

describe("dayMarksLinkQuery", () => {
  it("builds user+day query", () => {
    expect(dayMarksLinkQuery({ userId: 11, dateYmd: "2026-11-22" })).toEqual({
      user_id: "11",
      from: "2026-11-22",
      to: "2026-11-22"
    });
  });

  it("rejects bad input", () => {
    expect(dayMarksLinkQuery({ userId: 0, dateYmd: "2026-11-22" })).toBeNull();
    expect(dayMarksLinkQuery({ userId: 11, dateYmd: "22.11.2026" })).toBeNull();
  });

  it("builds href", () => {
    expect(dayMarksHref({ userId: 5, dateYmd: "2026-01-02" })).toBe(
      "/tabel/marks?user_id=5&from=2026-01-02&to=2026-01-02"
    );
  });
});

describe("buildVisitStaffRows", () => {
  it("lists all people with photo punch and present-first sort", () => {
    const rows = buildVisitStaffRows(
      [
        { id: 1, name: "Beta", branch: "A", role: "agent" },
        { id: 2, name: "Alpha", branch: "A", role: "agent" },
        { id: 3, name: "Gamma", branch: null, role: "agent" }
      ],
      [
        { user_id: 2, status: "worked", late_minutes: 0, late_excused: false },
        { user_id: 1, status: "absent", late_minutes: 0, late_excused: false }
      ],
      [
        {
          id: 99,
          user_id: 2,
          occurred_at: "2026-11-22T04:00:00.000Z",
          direction: "IN",
          photo_front_key: "k1"
        }
      ]
    );
    expect(rows.map((r) => r.id)).toEqual([2, 1, 3]);
    expect(rows[0].has_photo).toBe(true);
    expect(rows[0].punch_id).toBe(99);
    expect(rows[2].status).toBe("no_mark");
  });
});
