import { describe, expect, it } from "vitest";
import {
  buildDailyKpiUserWhere,
  type DailyKpiAgentScope
} from "../src/modules/plans/plans.daily-kpi.scope";

const EMPTY_SCOPE: DailyKpiAgentScope = {
  supervisor_ids: [],
  agent_ids: [],
  branch_codes: [],
  territory_1_list: [],
  territory_2_list: [],
  territory_3_list: []
};

function idFilter(where: ReturnType<typeof buildDailyKpiUserWhere>) {
  const and = (where.AND ?? []) as Array<Record<string, unknown>>;
  return and.find((c) => "id" in c)?.id as { in: number[] } | undefined;
}

describe("buildDailyKpiUserWhere — Dostup scope", () => {
  it("admin (null) — agent cheklovi yo‘q", () => {
    expect(idFilter(buildDailyKpiUserWhere(1, EMPTY_SCOPE, undefined, null, null))).toBeUndefined();
  });

  it("faqat ruxsat etilgan agentlar", () => {
    expect(idFilter(buildDailyKpiUserWhere(1, EMPTY_SCOPE, undefined, null, [3, 5]))).toEqual({
      in: [3, 5]
    });
  });

  it("filtr ∩ hudud ∩ Dostup", () => {
    const scope = { ...EMPTY_SCOPE, agent_ids: [1, 3, 5, 7] };
    expect(idFilter(buildDailyKpiUserWhere(1, scope, undefined, [3, 5, 7], [5, 7, 9]))).toEqual({
      in: [5, 7]
    });
  });

  it("hech narsa biriktirilmagan — hech kim ko‘rinmaydi", () => {
    expect(idFilter(buildDailyKpiUserWhere(1, EMPTY_SCOPE, undefined, null, []))).toEqual({
      in: [-1]
    });
  });
});
