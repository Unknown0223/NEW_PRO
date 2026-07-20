/**
 * Mobile "Tabel" (timesheet) — service/DB-level verification.
 *
 * Web `timesheet` moduli va mobil `getMobileAgentTimesheet` bitta manba ekanini,
 * hamda yig'indi invariantlarini tekshiradi (autentifikatsiyasiz, to'g'ridan-to'g'ri DB).
 *
 * Ishlatish: npx tsx scripts/test-mobile-timesheet.ts [slug]
 */
import { prisma } from "../src/config/database";
import { getMobileAgentTimesheet } from "../src/modules/mobile/mobile-agent-timesheet.service";
import {
  listTimesheetMatrix,
  statusWorkValue,
  type AttendanceStatus
} from "../src/modules/timesheet/timesheet.service";

const slug = process.argv[2] ?? "test1";

let failed = 0;
function assert(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`[OK] ${name}`);
  else {
    failed++;
    console.error(`[FAIL] ${name}${detail ? " — " + detail : ""}`);
  }
}

// UI letter <-> backend mapping (Dart tabel_status.dart bilan bir xil).
const LETTER: Record<AttendanceStatus, string> = {
  worked: "A",
  half_day: "S",
  absent: "N",
  holiday: "V",
  vacation: "S",
  sick: "S",
  trip: "S"
};

async function main() {
  // Mapping parity
  assert("letter[worked]=A", LETTER.worked === "A");
  assert("letter[absent]=N", LETTER.absent === "N");
  assert("letter[holiday]=V", LETTER.holiday === "V");
  assert("letter[vacation/sick/trip/half=S]",
    LETTER.vacation === "S" && LETTER.sick === "S" && LETTER.trip === "S" && LETTER.half_day === "S");

  const tenant = await prisma.tenant.findFirst({ where: { slug }, select: { id: true } });
  if (!tenant) {
    console.error(`[FAIL] tenant slug=${slug} topilmadi`);
    process.exit(1);
  }

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, name: true }
  });
  if (!agent) {
    console.error(`[FAIL] tenant ${slug} da faol agent yo'q`);
    process.exit(1);
  }

  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const res = await getMobileAgentTimesheet(tenant.id, agent.id, month);

  assert("month echoed", res.month === month, res.month);
  assert("employee.id matches agent", res.employee.id === agent.id);
  assert("days.length == days_in_month", res.days.length === res.totals.days_in_month,
    `${res.days.length} vs ${res.totals.days_in_month}`);

  const valid: AttendanceStatus[] = ["worked", "half_day", "absent", "holiday", "vacation", "sick", "trip"];
  const bad = res.days.filter((d) => !valid.includes(d.status as AttendanceStatus));
  assert("all statuses valid", bad.length === 0, bad.map((b) => b.status).join(","));

  const t = res.totals;
  const sumCats =
    t.active_days + t.half_days + t.absent_days + t.holiday_days + t.vacation_days + t.sick_days + t.trip_days;
  assert("category counts sum == days", sumCats === res.days.length, `${sumCats} vs ${res.days.length}`);

  const sumSales = res.days.reduce((a, d) => a + d.sales, 0);
  const sumVisits = res.days.reduce((a, d) => a + d.visits, 0);
  const sumMin = res.days.reduce((a, d) => a + d.worked_minutes, 0);
  assert("sales_total matches", Math.abs(sumSales - t.sales_total) < 1);
  assert("visits_total matches", sumVisits === t.visits_total);
  assert("worked_minutes_total matches", sumMin === t.worked_minutes_total);

  const expectWorked = t.active_days + 0.5 * t.half_days;
  assert("worked_days = active + 0.5*half", Math.abs(t.worked_days - expectWorked) < 0.001);

  // Parity: statuses identical to the web timesheet matrix for the same agent/month.
  const matrix = await listTimesheetMatrix(tenant.id, { month, user_id: agent.id });
  const row = matrix.rows[0];
  assert("matrix row present", !!row);
  if (row) {
    const mismatch = res.days.filter((d, i) => row.cells[i]?.status !== d.status);
    assert("statuses match web timesheet matrix", mismatch.length === 0,
      mismatch.map((m) => `${m.date}:${m.status}`).join(","));
    const matrixWorked = row.cells.reduce((a, c) => a + statusWorkValue(c.status), 0);
    assert("worked_days parity with matrix", Math.abs(matrixWorked - t.worked_days) < 0.001);
  }

  const excused = t.vacation_days + t.sick_days + t.trip_days + t.half_days;
  console.log("");
  console.log(
    `Agent: ${res.employee.fio} | Month: ${res.month} | Days: ${res.days.length} | ` +
      `Active: ${t.active_days} | Inactive: ${t.absent_days} | DayOff: ${t.holiday_days} | Excused: ${excused}`
  );
  console.log(`Sales: ${t.sales_total} | Visits: ${t.visits_total} | Minutes: ${t.worked_minutes_total}`);

  await prisma.$disconnect();
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll timesheet service tests passed.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
