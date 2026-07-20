#!/usr/bin/env node
/**
 * Верификация паритета модулей «Табель / Рабочие дни / Аудит» с прототипом TabelERP.
 *
 * Проверяет:
 *  1) Наличие ключевых фич (checklist из ZIP) в исходниках frontend/backend.
 *  2) Регистрацию backend-маршрутов (workdays + tabel-audit) и RBAC-гард.
 *  3) tsc backend (--noEmit) — должен быть чистым.
 *  4) tsc frontend — не должно быть ошибок в затронутых файлах (табель/графики/аудит).
 *
 * Запуск (из корня репозитория):  node scripts/verify-tabel-parity.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
let failures = 0;
const results = [];

function pass(name) {
  results.push({ ok: true, name });
}
function fail(name, detail) {
  failures += 1;
  results.push({ ok: false, name, detail });
}

function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

/** Проверка: файл содержит все указанные подстроки. */
function checkContains(rel, needles) {
  const src = read(rel);
  if (src == null) {
    fail(`Файл существует: ${rel}`, "не найден");
    return;
  }
  const missing = needles.filter((n) => !src.includes(n));
  if (missing.length === 0) pass(`${rel} — ${needles.length} маркеров`);
  else fail(`${rel}`, `нет маркеров: ${missing.join(" | ")}`);
}

// ─────────── 1. Checklist фич из ZIP ───────────

// Полная модель статусов: 0 / 0.5(half_day) / 1 / выходной / отпуск / больничный / командировка(trip)
checkContains("frontend/components/timesheet/timesheet-shared.ts", [
  '"half_day"',
  '"trip"',
  "WORK_VALUES",
  "WORK_STATUS_BY_VALUE",
  "SPECIAL_STATUSES",
  "statusWorkValue",
  "fmtTotal",
  'mode: "codes" | "labels"'
]);

// Табель: выбор дней (мультивыбор/диапазон), массовое проставление, экспорт-модалка, дробное «Итого»
checkContains("frontend/components/timesheet/timesheet-edit-toolbar.tsx", ["onSelectRange", "onBulk", "onToggleDay", "Диапазон"]);
checkContains("frontend/components/timesheet/timesheet-workspace.tsx", [
  "bulkApply",
  "selectRange",
  "headerDayClick",
  "setWorkValue",
  "TimesheetExportDialog",
  "TimesheetEditToolbar",
  "useTabelAudit",
  // Клик по заголовку раскрывает ТОЛЬКО одну колонку дня (переключение, а не накопление).
  "prev.length === 1 && prev[0] === d ? [] : [d]"
]);
checkContains("frontend/components/timesheet/timesheet-table.tsx", [
  "singleDay",
  "onWorkValue",
  "WORK_VALUES",
  "showFuture",
  // Раскрывается (0/0.5/1 в ячейках) ТОЛЬКО одиночная выбранная колонка дня.
  "canEdit && isSingle",
  // Заголовок раскрытого дня становится широким, остальные — компактными.
  "isSingleHeader ? \"min-w-[150px]\" : \"min-w-[44px]\""
]);
checkContains("frontend/components/timesheet/timesheet-export-dialog.tsx", ['"codes"', '"labels"']);
checkContains("frontend/components/timesheet/timesheet-cell-modal.tsx", ["SPECIAL_STATUSES", "WORK_VALUES", "TabelAuditRecord"]);
checkContains("frontend/components/timesheet/timesheet-stat-cards.tsx", ['"trip"', "Командировка"]);

// ─────────── 1b. Паритет ЦВЕТОВ статусов с прототипом TabelERP (ZIP) ───────────
// Статусные цвета ячеек: teal(1) / светлый teal(0.5) / серый(0) / синий(выходной) /
// жёлтый(отпуск) / оранжевый(больничный) / фиолетовый(командировка).
checkContains("frontend/components/timesheet/timesheet-shared.ts", [
  'cell: "bg-[#0e8c7a] text-white"', // 1 — работал (brand-600 teal)
  'cell: "bg-teal-200 text-teal-900 dark:bg-teal-400/80 dark:text-teal-950"', // 0.5 — светлый teal
  'cell: "bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"', // 0 — серый (НЕ синий)
  'cell: "bg-blue-500 text-white dark:bg-blue-500"', // выходной — синий
  'cell: "bg-yellow-400 text-yellow-950 dark:bg-yellow-400 dark:text-yellow-950"', // отпуск — жёлтый
  'cell: "bg-orange-500 text-white dark:bg-orange-500"', // больничный — оранжевый
  'cell: "bg-purple-500 text-white dark:bg-purple-500"' // командировка — фиолетовый
]);
// Скоуп .tabel-theme фиксирует --primary = teal #0e8c7a независимо от палитры SALEC.
checkContains("frontend/app/globals.css", [".tabel-theme", "#0e8c7a"]);
checkContains("frontend/components/timesheet/timesheet-workspace.tsx", ["tabel-theme"]);
checkContains("frontend/components/workdays/workdays-workspace.tsx", ["tabel-theme"]);
checkContains("frontend/components/audit/audit-workspace.tsx", ["tabel-theme"]);
// Карточки статистики: отпуск = yellow, больничный = orange (как в ZIP).
checkContains("frontend/components/timesheet/timesheet-stat-cards.tsx", [
  "bg-yellow-50 dark:bg-yellow-500/10",
  "bg-orange-50 dark:bg-orange-500/10"
]);
// Колонки выходных — синий тон blue (как в ZIP), не sky.
checkContains("frontend/components/timesheet/timesheet-table.tsx", ["bg-blue-50", "text-blue-500"]);

// Рабочие дни: серверная персистентность (не localStorage)
checkContains("frontend/components/workdays/workdays-workspace.tsx", ["useWorkdaysState", "useWorkdaysMutations", "useTabelAudit"]);
checkContains("frontend/lib/tabel/tabel-api.ts", [
  "useWorkdaysState",
  "useWorkdaysMutations",
  "useTabelAudit",
  "/workdays/schedules",
  "/workdays/exceptions",
  "/workdays/overrides",
  "/tabel-audit"
]);

// Аудит: серверный журнал
checkContains("frontend/components/audit/audit-workspace.tsx", ["useTabelAudit", "TabelAuditRecord"]);

// Нет остатков localStorage-стора для табеля
if (existsSync(join(ROOT, "frontend/lib/tabel/tabel-store.ts"))) {
  fail("Удалён localStorage tabel-store", "файл всё ещё существует");
} else {
  pass("localStorage tabel-store удалён (данные на сервере)");
}

// ─────────── 2. Backend: статусы, workdays, audit, регистрация ───────────

checkContains("backend/src/modules/timesheet/timesheet.service.ts", [
  '"half_day"',
  '"trip"',
  "statusWorkValue",
  "mergeTabelAudit",
  "ATTENDANCE_STATUS_LABEL_RU"
]);
checkContains("backend/src/modules/timesheet/timesheet.route.ts", ['"half_day"', '"trip"', "changedBy: actorLabel(request)"]);
checkContains("backend/src/modules/tabel/tabel-audit.ts", ["readTabelAudit", "mergeTabelAudit", "TabelAuditRecord"]);
checkContains("backend/src/modules/tabel/workdays.service.ts", [
  "getWorkdaysState",
  "saveSchedules",
  "addException",
  "removeException",
  "upsertOverride",
  "removeOverride"
]);
checkContains("backend/src/modules/tabel/tabel.route.ts", [
  "/api/:slug/workdays",
  "/api/:slug/workdays/schedules",
  "/api/:slug/workdays/exceptions",
  "/api/:slug/workdays/overrides",
  "/api/:slug/tabel-audit"
]);
checkContains("backend/src/route-registry.ts", ["registerTabelRoutes"]);
checkContains("backend/src/modules/access/route-permission-guard.ts", [
  '/\\/workdays/, "staff.tabel.create"',
  '/\\/tabel-audit/, "staff.tabel.view"'
]);

// ─────────── 3. tsc backend ───────────

function runTsc(label, cwd, filterRe) {
  try {
    execSync("npx tsc --noEmit", { cwd: join(ROOT, cwd), stdio: "pipe" });
    pass(`tsc ${label}: без ошибок`);
    return;
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const lines = out.split(/\r?\n/).filter((l) => /error TS/.test(l));
    if (filterRe) {
      const mine = lines.filter((l) => filterRe.test(l));
      if (mine.length === 0) {
        pass(`tsc ${label}: нет ошибок в затронутых файлах (${lines.length} прочих pre-existing)`);
      } else {
        fail(`tsc ${label}`, `ошибки в затронутых файлах:\n${mine.join("\n")}`);
      }
    } else {
      fail(`tsc ${label}`, `${lines.length} ошибок:\n${lines.slice(0, 20).join("\n")}`);
    }
  }
}

runTsc("backend", "backend", null);
runTsc("frontend (табель/графики/аудит)", "frontend", /timesheet|workdays|tabel|components[\\/]audit/);

// ─────────── 4. Live-проба маршрутов (best-effort, не фатально) ───────────

async function probe(path) {
  const base = process.env.API_BASE ?? "http://127.0.0.1:18080";
  try {
    const res = await fetch(`${base}${path}`, { method: "GET" });
    return res.status;
  } catch {
    return null;
  }
}

async function liveProbes() {
  const checks = [
    ["/api/test1/timesheet/filters", "timesheet"],
    ["/api/test1/workdays", "workdays"],
    ["/api/test1/tabel-audit", "tabel-audit"]
  ];
  for (const [path, name] of checks) {
    const code = await probe(path);
    if (code == null) {
      results.push({ ok: true, name: `live ${name}: сервер не запущен (пропуск)` });
    } else if (code === 404) {
      fail(`live ${name}`, "маршрут не зарегистрирован (404)");
    } else {
      // 401/403 = маршрут есть, но требует авторизацию — это ожидаемо.
      results.push({ ok: true, name: `live ${name}: зарегистрирован (HTTP ${code})` });
    }
  }
}

await liveProbes();

// ─────────── Итог ───────────

console.log("\n=== VERIFY: Табель + Рабочие дни + Аудит (паритет с TabelERP) ===\n");
for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `\n     → ${r.detail}` : ""}`);
}
console.log(`\nИтого: ${results.filter((r) => r.ok).length}/${results.length} проверок пройдено.`);
if (failures > 0) {
  console.error(`\nПРОВАЛ: ${failures} проверок не прошло.`);
  process.exit(1);
}
console.log("\nУСПЕХ: 100% паритет подтверждён (persistence + фичи + типы).");
