/**
 * P0 smoke: territory patch + slot config mapping (DB shartsiz).
 * npx.cmd tsx scripts/smoke-slot-config-migration.ts
 */
import {
  applyTerritoryFieldPatch,
  buildUserTerritory,
  parseUserTerritoryPartsFromHelpers
} from "../src/modules/work-slots/work-slots.config-territory";
import { buildSlotConfigFromUser, hasSlotConfigPatch } from "../src/modules/work-slots/work-slots.config-mirror";
import {
  applyPlanShare,
  DEFAULT_SLOT_PLAN_POLICY,
  resolveSlotPlanShare
} from "../src/modules/work-slots/work-slots.plan-policy";

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  OK  ${name}`);
  else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== Slot config migration smoke (P0) ===\n");

const parts = parseUserTerritoryPartsFromHelpers("Zona / Oblast / City");
check("parse territory", parts.zone === "Zona" && parts.oblast === "Oblast" && parts.city === "City");
check("build territory", buildUserTerritory(parts) === "Zona / Oblast / City");

const next = applyTerritoryFieldPatch("A / B / C", { territory_city: "Yangi" });
check("patch territory city", next === "A / B / Yangi");

check(
  "hasSlotConfigPatch warehouse",
  hasSlotConfigPatch({ warehouse_id: 5 }) === true
);
check("hasSlotConfigPatch empty", hasSlotConfigPatch({}) === false);

const fromUser = buildSlotConfigFromUser({
  territory: "T / R / C",
  warehouse_id: 10,
  return_warehouse_id: null,
  price_type: "opt",
  agent_price_types: ["opt"],
  agent_entitlements: { x: 1 },
  consignment: true,
  consignment_limit_amount: null,
  consignment_ignore_previous_months_debt: false,
  consignment_close_day: 25,
  consignment_close_hour: 0,
  consignment_close_minute: 0,
  supervisor_user_id: null,
  warehouse_staff_entitlements: {},
  expeditor_assignment_rules: {},
  cash_desk_id: 3
});
check("backfill map warehouse", fromUser.warehouse_id === 10);
check("backfill map cash", fromUser.cash_desk_id === 3);
check("backfill map territory", fromUser.territory === "T / R / C");

const monthStart = new Date("2026-07-01T00:00:00.000Z");
const monthEnd = new Date("2026-08-01T00:00:00.000Z");
const working = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"];
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
check("plan policy still FULL for starter", starter.share === 1);
check("plan apply", applyPlanShare(1000, 0.5) === 500);

console.log(`\n=== Natija: ${failed === 0 ? "HAMMASI OK" : `${failed} FAIL`} ===`);
process.exit(failed === 0 ? 0 : 1);
