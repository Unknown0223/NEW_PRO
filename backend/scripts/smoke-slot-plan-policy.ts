/**
 * Slot swap plan/KPI ulushi — skriptli smoke test (DB shartsiz).
 * Ishga tushirish: npx tsx scripts/smoke-slot-plan-policy.ts
 */
import {
  applyPlanShare,
  dayKeyInOccupancy,
  DEFAULT_SLOT_PLAN_POLICY,
  readSlotPlanPolicy,
  resolveSlotPlanShare
} from "../src/modules/work-slots/work-slots.plan-policy";

let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  OK  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const monthStart = new Date("2026-07-01T00:00:00.000Z");
const monthEnd = new Date("2026-08-01T00:00:00.000Z");
const working = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"];

console.log("=== Slot plan policy smoke ===\n");

check("default policy name", DEFAULT_SLOT_PLAN_POLICY === "full_for_starter_prorata_for_new");
check(
  "readSlotPlanPolicy fallback",
  readSlotPlanPolicy({}) === DEFAULT_SLOT_PLAN_POLICY
);
check(
  "readSlotPlanPolicy from settings",
  readSlotPlanPolicy({ work_slots: { plan_policy: "prorata_both" } }) === "prorata_both"
);

const starter = resolveSlotPlanShare({
  policy: DEFAULT_SLOT_PLAN_POLICY,
  monthStart,
  monthEnd,
  workingDayKeys: working,
  segments: [
    {
      started_at: new Date("2026-06-01T00:00:00.000Z"),
      ended_at: new Date("2026-07-02T12:00:00.000Z")
    }
  ]
});
check("starter role", starter.role === "starter");
check("starter share FULL", starter.share === 1);
check("starter plan 1e6 stays 1e6", applyPlanShare(1_000_000, starter.share) === 1_000_000);

const incoming = resolveSlotPlanShare({
  policy: DEFAULT_SLOT_PLAN_POLICY,
  monthStart,
  monthEnd,
  workingDayKeys: working,
  segments: [{ started_at: new Date("2026-07-03T00:00:00.000Z"), ended_at: null }]
});
check("incoming role", incoming.role === "incoming");
check("incoming share 0.5", incoming.share === 0.5);
check("incoming plan 1e6 → 5e5", applyPlanShare(1_000_000, incoming.share) === 500_000);
check(
  "incoming route days",
  JSON.stringify(incoming.working_days_for_route) === JSON.stringify(["2026-07-03", "2026-07-04"])
);

const prorataBoth = resolveSlotPlanShare({
  policy: "prorata_both",
  monthStart,
  monthEnd,
  workingDayKeys: working,
  segments: starter.role === "starter"
    ? [
        {
          started_at: new Date("2026-06-01T00:00:00.000Z"),
          ended_at: new Date("2026-07-02T12:00:00.000Z")
        }
      ]
    : []
});
// starter occupied 2 of 4 days under prorata_both
check("prorata_both starter share 0.5", prorataBoth.share === 0.5);

const fullBoth = resolveSlotPlanShare({
  policy: "full_both",
  monthStart,
  monthEnd,
  workingDayKeys: working,
  segments: [{ started_at: new Date("2026-07-03T00:00:00.000Z"), ended_at: null }]
});
check("full_both share 1", fullBoth.share === 1);

const leftDay = "2026-07-02";
const afterLeave = "2026-07-03";
const seg = {
  started_at: new Date("2026-06-01T00:00:00.000Z"),
  ended_at: new Date("2026-07-02T15:00:00.000Z")
};
check("leave day still in occupancy (editable)", dayKeyInOccupancy(leftDay, seg) === true);
check("day after leave NOT in occupancy (blocked)", dayKeyInOccupancy(afterLeave, seg) === false);

const unaffected = resolveSlotPlanShare({
  policy: DEFAULT_SLOT_PLAN_POLICY,
  monthStart,
  monthEnd,
  workingDayKeys: working,
  segments: []
});
check("no slot → share 1", unaffected.share === 1 && unaffected.role === "unaffected");

console.log(`\n=== Natija: ${failed === 0 ? "HAMMASI OK" : `${failed} ta FAIL`} ===`);
process.exit(failed === 0 ? 0 : 1);
