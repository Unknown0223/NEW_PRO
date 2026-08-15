import { describe, expect, it } from "vitest";
import {
  chunkNumericIds,
  humanizeImportDbError,
  IMPORT_ID_LOOKUP_CHUNK
} from "../src/modules/clients/clients.import.runtime";

describe("clients.import.runtime", () => {
  it("chunkNumericIds splits large id lists", () => {
    const ids = Array.from({ length: 12_001 }, (_, i) => i + 1);
    const chunks = chunkNumericIds(ids, 5000);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(5000);
    expect(chunks[1]).toHaveLength(5000);
    expect(chunks[2]).toHaveLength(2001);
    expect(chunks.flat()).toEqual(ids);
  });

  it("chunkNumericIds uses safe default chunk size", () => {
    expect(IMPORT_ID_LOOKUP_CHUNK).toBeLessThanOrEqual(10_000);
  });

  it("humanizeImportDbError maps bind variable overflow", () => {
    const msg = humanizeImportDbError(
      new Error(
        "Assertion violation on the database: `too many bind variables in prepared statement, expected maximum of 32767, received 32768`"
      )
    );
    expect(msg).toContain("worker");
    expect(msg).not.toContain("prisma.client.findMany");
  });
});
