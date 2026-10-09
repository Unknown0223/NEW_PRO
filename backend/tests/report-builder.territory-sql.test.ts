import { describe, expect, it } from "vitest";
import {
  resolvedCitySql,
  resolvedRegionSql,
  resolvedZoneSql
} from "../src/modules/report-builder/report-builder.territory-sql";

function sqlText(fragment: { strings: TemplateStringsArray; values: unknown[] } | { sql?: string; values?: unknown[] }): string {
  // Prisma.Sql exposes .strings / .values (or serialized form depending on version)
  const any = fragment as { strings?: TemplateStringsArray; values?: unknown[]; sql?: string };
  if (typeof any.sql === "string") return any.sql;
  if (any.strings) {
    let out = "";
    for (let i = 0; i < any.strings.length; i++) {
      out += any.strings[i];
      if (i < (any.values?.length ?? 0)) {
        const v = any.values![i];
        if (v && typeof v === "object" && "strings" in (v as object)) {
          out += sqlText(v as { strings: TemplateStringsArray; values: unknown[] });
        } else {
          out += String(v);
        }
      }
    }
    return out;
  }
  return String(fragment);
}

describe("report-builder territory SQL fallback", () => {
  it("resolvedRegionSql prefers client.region then agent workplace oblast (part 2)", () => {
    const text = sqlText(resolvedRegionSql()).replace(/\s+/g, " ");
    expect(text).toContain("c.region");
    expect(text).toContain("agent_ws.territory");
    expect(text).toContain("agent.territory");
    expect(text).toContain("split_part");
    expect(text).toMatch(/' \/ '/);
    expect(text).toContain("2");
  });

  it("resolvedZoneSql uses territory part 1", () => {
    const text = sqlText(resolvedZoneSql()).replace(/\s+/g, " ");
    expect(text).toContain("c.zone");
    expect(text).toContain("1");
  });

  it("resolvedCitySql uses territory part 3", () => {
    const text = sqlText(resolvedCitySql()).replace(/\s+/g, " ");
    expect(text).toContain("c.city");
    expect(text).toContain("3");
  });
});
