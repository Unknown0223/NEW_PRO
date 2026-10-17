import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  STAFF_IMPORT_KINDS,
  STAFF_IMPORT_SHEET_NAME,
  STAFF_IMPORT_TEMPLATE_COLUMNS,
  headerAliasesForKind,
  isStaffImportKind,
  parseStaffImportKindOrAllQuery,
  wantsAllRoles
} from "../src/modules/staff/staff.import.kinds";
import {
  buildStaffImportHeaderMap,
  parseNameFromFio,
  readAllStaffSheetsFromBuffer,
  resolveStaffImportKindFromSheetName,
  suggestLogin,
  yesRu
} from "../src/modules/staff/staff.import.headers";
import {
  buildStaffImportAllRolesTemplateBuffer,
  buildStaffImportTemplateBuffer
} from "../src/modules/staff/staff.import.template";

describe("staff.import.kinds", () => {
  it("recognizes all import kinds", () => {
    for (const k of STAFF_IMPORT_KINDS) {
      expect(isStaffImportKind(k)).toBe(true);
      expect(STAFF_IMPORT_TEMPLATE_COLUMNS[k].length).toBeGreaterThan(3);
      expect(headerAliasesForKind(k).fio).toBeTruthy();
    }
    expect(isStaffImportKind("employee")).toBe(false);
  });

  it("uses UI-aligned canonical headers (Логин, Доступ к приложению)", () => {
    for (const k of STAFF_IMPORT_KINDS) {
      const headers = STAFF_IMPORT_TEMPLATE_COLUMNS[k].map((c) => c.header);
      expect(headers).toContain("Логин");
      expect(headers).toContain("Доступ к приложению");
      expect(headers).not.toContain("Авторизоваться");
      expect(headers).not.toContain("Доступ к приложение");
    }
    expect(STAFF_IMPORT_TEMPLATE_COLUMNS.agent.map((c) => c.header)).toEqual(
      expect.arrayContaining([
        "Филиал",
        "Направление торговли",
        "Склад",
        "Должность",
        "Рабочее место"
      ])
    );
    expect(STAFF_IMPORT_TEMPLATE_COLUMNS.skladchik.map((c) => c.header)).toContain("Склад");
  });
});

describe("staff.import kind/mode query", () => {
  it("accepts mode=all and kind=all for all-roles template/import", () => {
    expect(parseStaffImportKindOrAllQuery({ mode: "all" }).ok).toBe(true);
    expect(parseStaffImportKindOrAllQuery({ kind: "all" }).ok).toBe(true);
    expect(parseStaffImportKindOrAllQuery({ mode: "all", kind: "all" }).ok).toBe(true);
    expect(parseStaffImportKindOrAllQuery({ kind: "agent" }).ok).toBe(true);
    expect(parseStaffImportKindOrAllQuery({ kind: "nope" }).ok).toBe(false);
    expect(wantsAllRoles({ mode: "all" })).toBe(true);
    expect(wantsAllRoles({ kind: "all" })).toBe(true);
    expect(wantsAllRoles({ kind: "agent" })).toBe(false);
    expect(wantsAllRoles({})).toBe(false);
  });
});

describe("staff.import.headers", () => {
  it("maps RU export headers for agents (legacy Авторизоваться)", () => {
    const headers = [
      "Ф.И.О",
      "Авторизоваться",
      "Пароль",
      "Телефон",
      "Код",
      "Рабочее место",
      "ПИНФЛ",
      "Доступ к приложение"
    ];
    const map = buildStaffImportHeaderMap(headers, "agent");
    expect(map.fio).toBe(0);
    expect(map.login).toBe(1);
    expect(map.password).toBe(2);
    expect(map.code).toBe(4);
    expect(map.workSlot).toBe(5);
    expect(map.appAccess).toBe(7);
  });

  it("maps new UI headers Логин / Доступ к приложению", () => {
    const headers = [
      "Ф.И.О",
      "Логин",
      "Пароль",
      "Код",
      "Филиал",
      "Склад",
      "Рабочее место",
      "Доступ к приложению"
    ];
    const map = buildStaffImportHeaderMap(headers, "agent");
    expect(map.login).toBe(1);
    expect(map.branch).toBe(4);
    expect(map.warehouse).toBe(5);
    expect(map.workSlot).toBe(6);
    expect(map.appAccess).toBe(7);
  });

  it("parses FIO as фамилия имя отчество", () => {
    const p = parseNameFromFio("Иванов Иван Иванович");
    expect(p.last_name).toBe("Иванов");
    expect(p.first_name).toBe("Иван");
    expect(p.middle_name).toBe("Иванович");
  });

  it("suggests login and yesRu", () => {
    expect(suggestLogin("agent", "A01", "Test")).toMatch(/^agt_/);
    expect(yesRu("Да")).toBe(true);
    expect(yesRu("нет")).toBe(false);
  });

  it("resolves kind from sheet names and aliases", () => {
    expect(resolveStaffImportKindFromSheetName("Агенты")).toBe("agent");
    expect(resolveStaffImportKindFromSheetName("Экспедиторы")).toBe("expeditor");
    expect(resolveStaffImportKindFromSheetName("agent")).toBe("agent");
    expect(resolveStaffImportKindFromSheetName("агент")).toBe("agent");
    expect(resolveStaffImportKindFromSheetName("Складчики")).toBe("skladchik");
    expect(resolveStaffImportKindFromSheetName("Unknown")).toBeNull();
  });
});

describe("staff.import.template", () => {
  it("builds non-empty xlsx for each kind", () => {
    for (const k of STAFF_IMPORT_KINDS) {
      const buf = buildStaffImportTemplateBuffer(k);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(100);
      // zip signature
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);
    }
  });

  it("all-roles template has field sheets + office role sheets and UI headers", () => {
    const buf = buildStaffImportAllRolesTemplateBuffer();
    const wb = XLSX.read(buf, { type: "buffer" });
    // 6 field roles + 7 office sheets (operator expanded)
    expect(wb.SheetNames).toHaveLength(6 + 7);
    for (const kind of STAFF_IMPORT_KINDS) {
      if (kind === "operator") {
        expect(wb.SheetNames).toContain("Операторы");
        expect(wb.SheetNames).toContain("Менеджеры");
        continue;
      }
      expect(wb.SheetNames).toContain(STAFF_IMPORT_SHEET_NAME[kind].slice(0, 31));
    }
    const sheets = readAllStaffSheetsFromBuffer(buf);
    expect(sheets.length).toBe(13);
    expect(sheets.filter((s) => s.kind === "operator").length).toBe(7);
    expect(sheets.some((s) => s.defaultWebRole === "manager")).toBe(true);

    const agentSheet = sheets.find((s) => s.kind === "agent");
    expect(agentSheet).toBeTruthy();
    const headerRow = (agentSheet!.matrix[0] ?? []).map((c) => String(c ?? ""));
    expect(headerRow).toContain("Логин");
    expect(headerRow).toContain("Доступ к приложению");
    expect(headerRow).toContain("Рабочее место");
    const map = buildStaffImportHeaderMap(headerRow, "agent");
    expect(map.login).toBeDefined();
    expect(map.appAccess).toBeDefined();
    expect(map.workSlot).toBeDefined();

    const mgr = sheets.find((s) => s.defaultWebRole === "manager");
    expect(mgr).toBeTruthy();
    const mgrHeaders = (mgr!.matrix[0] ?? []).map((c) => String(c ?? ""));
    expect(mgrHeaders).toContain("Системная роль");
    expect(mgrHeaders).toContain("Рабочее место");
  });
});
