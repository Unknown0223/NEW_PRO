import { describe, expect, it } from "vitest";
import {
  activeValuesFromClientRefEntries,
  resolveClientRefEntries,
  type ClientRefEntryDto
} from "../src/modules/tenant-settings/tenant-settings.refs";

function resolveClientList(
  entries: ClientRefEntryDto[],
  legacy: string[]
): string[] {
  const fromEntries = activeValuesFromClientRefEntries(entries);
  return fromEntries.length > 0 ? fromEntries : legacy;
}

describe("mobile client select refs", () => {
  it("prefers category entries over empty legacy strings", () => {
    const entries = resolveClientRefEntries(
      {
        client_category_entries: [
          { id: "1", name: "A", code: "A", active: true },
          { id: "2", name: "B", code: "B", active: true },
          { id: "3", name: "Z", code: "Z", active: false }
        ]
      },
      "client_category_entries",
      [],
      "cat"
    );
    expect(resolveClientList(entries, [])).toEqual(["A", "B"]);
  });

  it("falls back to legacy type codes when entries missing", () => {
    const entries = resolveClientRefEntries({}, "client_type_entries", ["OPT", "RETAIL"], "typ");
    expect(resolveClientList(entries, ["OPT", "RETAIL"])).toEqual(["OPT", "RETAIL"]);
  });
});
