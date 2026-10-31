import { describe, expect, it } from "vitest";
import type { NormDay } from "../src/modules/timesheet/timesheet.agent-norm.pure";
import { applyLeaderMinusRules, type LeaderMinusPerson } from "../src/modules/timesheet/timesheet.leader-minus.pure";
import { orderTimesheetRows } from "../src/modules/timesheet/timesheet.order";

function day(date: string, status: NormDay["status"], manual = false): NormDay {
  return { date, status, source: "auto", manual };
}

function person(
  user_id: number,
  role: string,
  supervisor_user_id: number | null,
  days: NormDay[],
  fio = `U${user_id}`
): LeaderMinusPerson {
  return { user_id, fio, role, supervisor_user_id, days };
}

const month = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"].map((date) =>
  day(date, "worked")
);

describe("applyLeaderMinusRules", () => {
  it("порог 3 по каждому агенту: один агент с 3 минусами даёт руководителю один минус", () => {
    const a1 = person(1, "agent", 10, [
      day("2026-10-01", "absent"),
      day("2026-10-02", "absent"),
      day("2026-10-03", "worked")
    ], "Агент 1");
    const a2 = person(2, "agent", 10, [day("2026-10-01", "absent"), day("2026-10-02", "worked")], "Агент 2");
    const a3 = person(3, "agent", 10, [
      day("2026-10-01", "absent"),
      day("2026-10-02", "absent"),
      day("2026-10-03", "absent"),
      day("2026-10-04", "absent")
    ], "Агент 3");
    const svr = person(10, "supervisor", null, month.map((d) => ({ ...d })), "СВР");
    applyLeaderMinusRules([a1, a2, a3, svr], [
      { id: "r1", enabled: true, role: "supervisor", user_id: null, threshold: 3, mode: "per_agent" }
    ], "2026-10-31");
    const minus = svr.days.filter((d) => d.status === "absent");
    expect(minus).toHaveLength(1);
    expect(minus[0]?.date).toBe("2026-10-03");
    expect(minus[0]?.comment).toContain("Агент 3");
  });

  it("два минуса в один день: второй уходит на предыдущий день с комментарием", () => {
    const mk = (fio: string, id: number) =>
      person(id, "agent", 10, [
        day("2026-10-01", "absent"),
        day("2026-10-02", "absent"),
        day("2026-10-03", "absent")
      ], fio);
    const svr = person(10, "supervisor", null, month.map((d) => ({ ...d })));
    applyLeaderMinusRules([mk("Бета", 2), mk("Альфа", 1), svr], [
      { id: "r1", enabled: true, role: "supervisor", user_id: null, threshold: 3, mode: "per_agent" }
    ], "2026-10-31");
    const minus = svr.days.filter((d) => d.status === "absent").map((d) => d.date);
    expect(minus.sort()).toEqual(["2026-10-02", "2026-10-03"]);
    const shifted = svr.days.find((d) => d.date === "2026-10-02");
    expect(shifted?.comment).toContain("перенесён");
  });

  it("сумма минусов: 6 минусов и порог 3 дают два минуса руководителю", () => {
    const a1 = person(1, "agent", 10, [day("2026-10-01", "absent"), day("2026-10-02", "absent")]);
    const a2 = person(2, "agent", 10, [day("2026-10-01", "absent")]);
    const a3 = person(3, "agent", 10, [
      day("2026-10-03", "absent"),
      day("2026-10-04", "absent"),
      day("2026-10-05", "absent")
    ]);
    const svr = person(10, "supervisor", null, month.map((d) => ({ ...d })));
    applyLeaderMinusRules([a1, a2, a3, svr], [
      { id: "r1", enabled: true, role: "supervisor", user_id: null, threshold: 3, mode: "team_sum" }
    ], "2026-10-31");
    expect(svr.days.filter((d) => d.status === "absent")).toHaveLength(2);
  });

  it("правило аккаунта важнее правила роли, ручной день не затирается", () => {
    const agent = person(1, "agent", 10, [
      day("2026-10-01", "absent"),
      day("2026-10-02", "absent"),
      day("2026-10-03", "absent")
    ]);
    const days = month.map((d) => ({ ...d }));
    days[2] = day("2026-10-03", "worked", true);
    const svr = person(10, "supervisor", null, days);
    applyLeaderMinusRules([agent, svr], [
      { id: "role", enabled: true, role: "supervisor", user_id: null, threshold: 1, mode: "per_agent" },
      { id: "user", enabled: true, role: "supervisor", user_id: 10, threshold: 3, mode: "per_agent" }
    ], "2026-10-31");
    expect(svr.days.find((d) => d.date === "2026-10-03")?.manual).toBe(true);
    expect(svr.days.find((d) => d.date === "2026-10-03")?.status).toBe("worked");
    expect(svr.days.find((d) => d.date === "2026-10-02")?.status).toBe("absent");
  });
});

describe("orderTimesheetRows sales", () => {
  it("агенты внутри СВР идут по сумме продаж, а не по ФИО", () => {
    const rows = [
      { user_id: 10, fio: "SVR", role: "supervisor", supervisor_user_id: null },
      { user_id: 1, fio: "Агент А", role: "agent", supervisor_user_id: 10 },
      { user_id: 2, fio: "Агент Я", role: "agent", supervisor_user_id: 10 }
    ];
    const sales = new Map<number, number>([
      [1, 100],
      [2, 500]
    ]);
    expect(orderTimesheetRows(rows, undefined, sales).map((r) => r.user_id)).toEqual([2, 1, 10]);
  });
});
