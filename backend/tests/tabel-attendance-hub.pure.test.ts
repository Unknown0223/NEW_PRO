import { describe, expect, it } from "vitest";
import {
  ALL_ATTENDANCE_STATUSES,
  applyLateAllowance,
  computeDayFromPunches,
  excusedLeft,
  extendedStatusWorkValue,
  normalizeLatenessRules,
  roleForDayMark
} from "../src/modules/tabel/tabel-engine.pure";
import {
  assertVideoPunch,
  maskTabelSettingsForClient,
  normalizeFullTabelSettings,
  pickDayCode,
  retentionToDays
} from "../src/modules/tabel/tabel-settings.pure";
import {
  evaluateGeofenceAgainstLocations,
  evaluateTenLayerAntiFraud,
  haversineMeters,
  validateLivenessSteps
} from "../src/modules/tabel/tabel-antifraud.pure";
import { buildFormulaVars, knownVariableSet, type PayrollCalcInputs } from "../src/modules/payroll/payroll.formula-vars";
import { ZERO_METRICS } from "../src/modules/payroll/payroll-kpi-fact.pure";
import {
  TABEL_GROUP_RU,
  buildStructuredPermissionCatalog,
  permissionDisplayGroup
} from "../src/modules/access/permission-model";
import { matchRule } from "../src/modules/access/route-permission-guard";

describe("Tabel Engine — 15 statuses, punch roles, late allowance", () => {
  it("supports all 15 statuses and correct work values", () => {
    expect(ALL_ATTENDANCE_STATUSES.length).toBe(15);
    expect(extendedStatusWorkValue("worked")).toBe(1);
    expect(extendedStatusWorkValue("trip")).toBe(1);
    expect(extendedStatusWorkValue("overtime")).toBe(1);
    expect(extendedStatusWorkValue("weekend_work")).toBe(1);
    expect(extendedStatusWorkValue("remote")).toBe(1);
    expect(extendedStatusWorkValue("half_day")).toBe(0.5);
    expect(extendedStatusWorkValue("early_leave")).toBe(0.5);
    expect(extendedStatusWorkValue("late", { lateExcused: true })).toBe(1);
    expect(
      extendedStatusWorkValue("late", { lateExcused: false, penalizeUnexcusedLateAsHalfDay: true })
    ).toBe(0.5);
    expect(extendedStatusWorkValue("absent")).toBe(0);
    expect(extendedStatusWorkValue("vacation")).toBe(0);
    expect(extendedStatusWorkValue("sick")).toBe(0);
    expect(extendedStatusWorkValue("not_started")).toBe(0);
  });

  it("assigns in, estimated_out, and out roles to punches", () => {
    expect(roleForDayMark(0, 1, false)).toBe("in");
    expect(roleForDayMark(0, 3, false)).toBe("in");
    expect(roleForDayMark(1, 3, false)).toBe("estimated_out");
    expect(roleForDayMark(2, 3, false)).toBe("estimated_out");
    expect(roleForDayMark(2, 3, true)).toBe("out");
  });

  it("applies monthly late allowance in date order", () => {
    const rules = normalizeLatenessRules({
      excusedEnabled: true,
      excusedPerMonth: 2,
      excusedMaxMinutes: 15
    });
    const days = applyLateAllowance(
      [
        { date: "2026-10-05", status: "late", lateMinutes: 10 },
        { date: "2026-10-02", status: "late", lateMinutes: 12 },
        { date: "2026-10-08", status: "late", lateMinutes: 8 },
        { date: "2026-10-10", status: "late", lateMinutes: 35 }
      ],
      rules
    );
    const byDate = new Map(days.map((d) => [d.date, d]));
    expect(byDate.get("2026-10-02")?.lateExcused).toBe(true);
    expect(byDate.get("2026-10-05")?.lateExcused).toBe(true);
    expect(byDate.get("2026-10-08")?.lateExcused).toBe(false);
    expect(byDate.get("2026-10-10")?.lateExcused).toBe(false);
    expect(excusedLeft(days, rules)).toBe(0);
  });

  it("computes day record from punches and shift times", () => {
    const res = computeDayFromPunches({
      workYmd: "2026-10-20",
      now: new Date("2026-10-20T14:00:00.000Z"), // 19:00 Tashkent
      timeZone: "Asia/Tashkent",
      isWorkingDay: true,
      shift: { start_time: "09:00", end_time: "18:00", break_minutes: 60, grace_minutes: 15 },
      punches: [
        { id: 1, occurred_at: new Date("2026-10-20T04:25:00.000Z"), source: "mobile_photo", is_valid: true }, // 09:25 (+10m late)
        { id: 2, occurred_at: new Date("2026-10-20T08:00:00.000Z"), source: "mobile_photo", is_valid: true }, // 13:00 (estimated_out)
        { id: 3, occurred_at: new Date("2026-10-20T13:10:00.000Z"), source: "mobile_photo", is_valid: true } // 18:10 (official out)
      ]
    });
    expect(res.status).toBe("late");
    expect(res.late_minutes).toBe(10);
    expect(res.early_leave_minutes).toBe(0);
    expect(res.punch_roles.map((r) => r.role_in_day)).toEqual(["in", "estimated_out", "out"]);
  });
});

describe("Video punch, 3-digit code, retention, and 10-layer Anti-Fraud", () => {
  it("picks 3-digit code in 100..999 and validates video punch", () => {
    const code = pickDayCode(new Set([100, 101, 102]));
    expect(code).not.toBeNull();
    expect(code!).toBeGreaterThanOrEqual(100);
    expect(code!).toBeLessThanOrEqual(999);

    expect(
      assertVideoPunch({
        durationSec: 8,
        bytes: 120_000,
        enabled: true,
        codeRequired: true,
        code: 456,
        spokenCode: 456
      }).ok
    ).toBe(true);

    expect(
      assertVideoPunch({
        durationSec: 8,
        bytes: 120_000,
        enabled: true,
        codeRequired: true,
        code: 456,
        spokenCode: 123
      })
    ).toMatchObject({ ok: false, code: "PUNCH_VIDEO_CODE" });
  });

  it("masks telegram botToken and converts retention units", () => {
    const s = normalizeFullTabelSettings({
      telegram: { enabled: true, botToken: "secret-bot-token", defaultChatId: "-1001" }
    });
    const masked = maskTabelSettingsForClient(s);
    expect(masked.telegram.botToken).toBe("");
    expect(masked.telegram.hasBotToken).toBe(true);
    expect(retentionToDays(3, "month")).toBe(90);
    expect(retentionToDays(1, "year")).toBe(365);
  });

  it("evaluates geofence and 10-layer anti-fraud", () => {
    const dist = haversineMeters(40.7821, 72.3442, 40.7822, 72.3443);
    expect(dist).toBeLessThan(30);

    const geoInside = evaluateGeofenceAgainstLocations(
      40.7822,
      72.3443,
      [{ id: 1, name: "Andijon Ofis", lat: 40.7821, lng: 72.3442, radius_m: 150, require_comment_outside: true }]
    );
    expect(geoInside.outsideGeofence).toBe(false);

    const liveness4 = validateLivenessSteps(["left", "right", "up", "down"], 4);
    expect(liveness4.ok).toBe(true);

    const cfg = normalizeFullTabelSettings({}).faceAntifraud;
    const pass = evaluateTenLayerAntiFraud({
      settings: cfg,
      isMockLocation: false,
      accuracyM: 18,
      clientTimestampIso: new Date().toISOString(),
      fromGallery: false,
      faceCount: 1,
      livenessSteps: ["left", "right", "up", "down"],
      faceScore: 0.91,
      hasBackPhotoOrVideo: true,
      expectedDayCode: 512,
      spokenDayCode: 512,
      outsideGeofence: false
    });
    expect(pass.ok).toBe(true);
    expect(pass.layers.length).toBe(10);

    const failFakeGps = evaluateTenLayerAntiFraud({
      settings: cfg,
      isMockLocation: true,
      accuracyM: 15,
      livenessSteps: ["left", "right", "up", "down"],
      faceScore: 0.91,
      hasBackPhotoOrVideo: true
    });
    expect(failFakeGps.ok).toBe(false);
    expect(failFakeGps.failedCode).toBe("FAKE_GPS_DETECTED");

    const failNoFace = evaluateTenLayerAntiFraud({
      settings: cfg,
      isMockLocation: false,
      accuracyM: 15,
      fromGallery: false,
      faceCount: 1,
      livenessSteps: ["left", "right", "up", "down"],
      faceScore: 0,
      skipFaceMatch: false,
      hasBackPhotoOrVideo: true
    });
    expect(failNoFace.ok).toBe(false);
    expect(failNoFace.failedCode).toBe("FACE_MISMATCH");
  });
});

describe("Payroll formula variables & RBAC integration", () => {
  it("exposes new attendance variables in Payroll formulas", () => {
    const known = knownVariableSet([]);
    expect(known.has("кечиккан_кун")).toBe(true);
    expect(known.has("кечиккан_дақиқа")).toBe(true);
    expect(known.has("эрта_кетган_дақиқа")).toBe(true);
    expect(known.has("прогул_кун")).toBe(true);
    expect(known.has("қўшимча_соат")).toBe(true);

    const inp: PayrollCalcInputs = {
      base_full: 4_000_000,
      base_salary: 4_000_000,
      plan_days: 25,
      worked_days: 24,
      vacation_days: 0,
      sick_days: 0,
      trip_days: 1,
      absent_days: 1,
      half_days: 0,
      late_unexcused_days: 2,
      late_minutes: 45,
      early_leave_minutes: 20,
      overtime_hours: 6,
      fact_total: { ...ZERO_METRICS },
      fact_by_group: new Map(),
      returned_sum: 0,
      plan_total: { ...ZERO_METRICS },
      plan_by_group: new Map(),
      expeditor: { delivered_count: 0, delivered_sum: 0, delivered_volume: 0, clients: 0 },
      team_total: null,
      team_by_group: null,
      advances_paid: 0
    };
    const vars = buildFormulaVars(inp, null, new Map(), { allowances: 0, deductions: 0 });
    expect(vars.get("кечиккан_кун")).toBe(2);
    expect(vars.get("кечиккан_дақиқа")).toBe(45);
    expect(vars.get("эрта_кетган_дақиқа")).toBe(20);
    expect(vars.get("прогул_кун")).toBe(1);
    expect(vars.get("қўшимча_соат")).toBe(6);
  });

  it("groups Tabel & Attendance permissions under TABEL_GROUP_RU and guards routes", () => {
    const catalog = buildStructuredPermissionCatalog();
    expect(catalog.some((c) => c.key === "tabel.otmetki.view")).toBe(true);
    expect(catalog.some((c) => c.key === "tabel.smeny.create")).toBe(true);
    expect(catalog.some((c) => c.key === "tabel.zayavki.approve")).toBe(true);
    expect(catalog.some((c) => c.key === "tabel.obhodnye.approve")).toBe(true);
    expect(catalog.some((c) => c.key === "tabel.ustroystva.assign")).toBe(true);
    expect(catalog.some((c) => c.key === "tabel.statistika.view")).toBe(true);
    expect(catalog.some((c) => c.key === "tabel.mobilnaya_otmetka.create")).toBe(true);
    expect(catalog.some((c) => c.key === "settings.tabel_pravila.update")).toBe(true);
    expect(catalog.some((c) => c.key === "settings.timezone.update")).toBe(true);
    expect(catalog.some((c) => c.key === "settings.prichiny.update")).toBe(true);
    expect(permissionDisplayGroup("tabel.otmetki.view")).toBe(TABEL_GROUP_RU);
    expect(permissionDisplayGroup("tabel.statistika.view")).toBe(TABEL_GROUP_RU);
    expect(permissionDisplayGroup("tabel.mobilnaya_otmetka.view")).toBe(TABEL_GROUP_RU);
    expect(permissionDisplayGroup("staff.tabel.view")).toBe(TABEL_GROUP_RU);

    expect(matchRule("GET", "/api/:slug/tabel/marks")?.anyOf).toContain("tabel.otmetki.view");
    expect(matchRule("GET", "/api/:slug/tabel/analytics")?.anyOf).toContain("tabel.statistika.view");
    expect(matchRule("PUT", "/api/:slug/settings/tabel")?.anyOf).toContain("settings.tabel_pravila.update");
    expect(matchRule("GET", "/api/:slug/mobile/attendance/state")?.anyOf).toContain("tabel.mobilnaya_otmetka.view");
    expect(matchRule("POST", "/api/:slug/mobile/attendance/punch")?.anyOf).toContain("tabel.mobilnaya_otmetka.create");
    expect(matchRule("POST", "/api/:slug/mobile/attendance/device-ingest")).toBeNull();
    expect(matchRule("GET", "/api/:slug/mobile/clients")).toBeNull();
    expect(matchRule("PATCH", "/api/:slug/settings/profile")?.anyOf).toContain("settings.timezone.update");
    expect(matchRule("PATCH", "/api/:slug/settings/profile")?.anyOf).toContain("settings.prichiny.update");
  });
});
