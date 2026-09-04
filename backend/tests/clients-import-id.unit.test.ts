import { describe, expect, it } from "vitest";
import {
  classifyFlexibleImportId,
  classifyImportClientDbId,
  normalizeExternalDocNumber,
  parseClientDbIdFromCell
} from "../src/modules/clients/clients.import.flexible-id";
import { excelHeaderToImportKey, headerToClientImportKey } from "../src/modules/clients/clients.import.keys";
import { lalakuNewClientTemplateHeaders } from "../src/modules/clients/clients.import.templates";

describe("clients import flexible id (ks_1652 style)", () => {
  it("maps id / ID / ид headers to client_db_id", () => {
    expect(headerToClientImportKey("id")).toBe("client_db_id");
    expect(headerToClientImportKey("ИД")).toBe("client_db_id");
    expect(excelHeaderToImportKey("db_id")).toBe("client_db_id");
  });

  it("accepts numeric DB ids and any string codes", () => {
    expect(classifyFlexibleImportId(null)).toEqual({ kind: "absent" });
    expect(classifyFlexibleImportId("---")).toEqual({ kind: "absent" });
    expect(classifyFlexibleImportId("12")).toEqual({ kind: "ok_db", id: 12 });
    expect(classifyFlexibleImportId("12.0")).toEqual({ kind: "ok_db", id: 12 });
    expect(classifyFlexibleImportId("ks_1652")).toEqual({ kind: "ok_code", code: "ks_1652" });
    expect(classifyFlexibleImportId("np_8697")).toEqual({ kind: "ok_code", code: "np_8697" });
    expect(classifyFlexibleImportId("ya_2113")).toEqual({ kind: "ok_code", code: "ya_2113" });
    expect(classifyFlexibleImportId("g3_516")).toEqual({ kind: "ok_code", code: "g3_516" });
    expect(classifyFlexibleImportId("ABC-01")).toEqual({ kind: "ok_code", code: "ABC-01" });
    expect(classifyFlexibleImportId("0").kind).toBe("invalid");
  });

  it("legacy classifyImportClientDbId still accepts numbers only via parseClientDbIdFromCell", () => {
    expect(parseClientDbIdFromCell("99")).toBe(99);
    expect(parseClientDbIdFromCell("ks_1652")).toBeNull();
    expect(classifyImportClientDbId("15")).toEqual({ kind: "ok", id: 15 });
  });

  it("normalizeExternalDocNumber keeps any string doc id", () => {
    expect(normalizeExternalDocNumber("ks_1652")).toBe("ks_1652");
    expect(normalizeExternalDocNumber("  ORD-9  ")).toBe("ORD-9");
    expect(normalizeExternalDocNumber("---")).toBeNull();
    expect(normalizeExternalDocNumber("")).toBeNull();
  });

  it("new-client template includes optional ИД column", () => {
    const headers = lalakuNewClientTemplateHeaders();
    expect(headers[0]).toBe("ИД");
  });
});
