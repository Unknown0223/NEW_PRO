import { describe, expect, it } from "vitest";
import {
  classifyImportClientDbId,
  parseClientDbIdFromCell
} from "../src/modules/clients/clients.import.assign";
import { excelHeaderToImportKey, headerToClientImportKey } from "../src/modules/clients/clients.import.keys";
import { lalakuNewClientTemplateHeaders } from "../src/modules/clients/clients.import.templates";

describe("clients import id column", () => {
  it("maps id / ID / ид / client_db_id headers to client_db_id", () => {
    expect(headerToClientImportKey("id")).toBe("client_db_id");
    expect(headerToClientImportKey("ID")).toBe("client_db_id");
    expect(headerToClientImportKey("ид")).toBe("client_db_id");
    expect(headerToClientImportKey("ИД")).toBe("client_db_id");
    expect(headerToClientImportKey("client_db_id")).toBe("client_db_id");
    expect(headerToClientImportKey("client_id")).toBe("client_db_id");
    expect(excelHeaderToImportKey("db_id")).toBe("client_db_id");
  });

  it("does not map client code aliases to client_db_id", () => {
    expect(headerToClientImportKey("код_клиента")).toBe("client_code");
    expect(headerToClientImportKey("ид_клиента")).toBe("client_code");
  });

  it("classifyImportClientDbId accepts positive ints and rejects bad values", () => {
    expect(classifyImportClientDbId(null)).toEqual({ kind: "absent" });
    expect(classifyImportClientDbId("---")).toEqual({ kind: "absent" });
    expect(classifyImportClientDbId("")).toEqual({ kind: "absent" });
    expect(classifyImportClientDbId("12")).toEqual({ kind: "ok", id: 12 });
    expect(classifyImportClientDbId("12.0")).toEqual({ kind: "ok", id: 12 });
    expect(classifyImportClientDbId("0").kind).toBe("invalid");
    expect(classifyImportClientDbId("-3").kind).toBe("invalid");
    expect(classifyImportClientDbId("abc").kind).toBe("invalid");
    expect(classifyImportClientDbId("1.5").kind).toBe("invalid");
    expect(parseClientDbIdFromCell("99")).toBe(99);
    expect(parseClientDbIdFromCell("nope")).toBeNull();
  });

  it("new-client template includes optional ИД column", () => {
    const headers = lalakuNewClientTemplateHeaders();
    expect(headers[0]).toBe("ИД");
    expect(headers).toContain("Наименование");
  });
});
