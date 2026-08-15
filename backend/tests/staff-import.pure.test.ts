import { describe, expect, it } from "vitest";
import {
  STAFF_IMPORT_KINDS,
  STAFF_IMPORT_TEMPLATE_COLUMNS,
  headerAliasesForKind,
  isStaffImportKind
} from "../src/modules/staff/staff.import.kinds";
import {
  buildStaffImportHeaderMap,
  parseNameFromFio,
  suggestLogin,
  yesRu
} from "../src/modules/staff/staff.import.headers";
import { buildStaffImportTemplateBuffer } from "../src/modules/staff/staff.import.template";

describe("staff.import.kinds", () => {
  it("recognizes all import kinds", () => {
    for (const k of STAFF_IMPORT_KINDS) {
      expect(isStaffImportKind(k)).toBe(true);
      expect(STAFF_IMPORT_TEMPLATE_COLUMNS[k].length).toBeGreaterThan(3);
      expect(headerAliasesForKind(k).fio).toBeTruthy();
    }
    expect(isStaffImportKind("employee")).toBe(false);
  });
});

describe("staff.import.headers", () => {
  it("maps RU export headers for agents", () => {
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
});
