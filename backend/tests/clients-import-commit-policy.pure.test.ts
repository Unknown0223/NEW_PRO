import { describe, expect, it } from "vitest";
import {
  buildImportDecisionPreview,
  decideImportWriteAction
} from "../src/modules/clients/clients.import.commit-policy";

describe("decideImportWriteAction", () => {
  it("writes when no errors", () => {
    expect(decideImportWriteAction({ errorCount: 0, validCount: 10 })).toBe("write");
  });

  it("asks when mixed and no decision", () => {
    expect(decideImportWriteAction({ errorCount: 2, validCount: 5 })).toBe("ask");
  });

  it("writes only-valid when accept_valid", () => {
    expect(
      decideImportWriteAction({ errorCount: 2, validCount: 5, commitDecision: "accept_valid" })
    ).toBe("write");
  });

  it("rejects all when reject_all", () => {
    expect(
      decideImportWriteAction({ errorCount: 2, validCount: 5, commitDecision: "reject_all" })
    ).toBe("reject");
  });

  it("rejects when only errors", () => {
    expect(decideImportWriteAction({ errorCount: 3, validCount: 0 })).toBe("reject");
  });
});

describe("buildImportDecisionPreview", () => {
  it("caps samples and counts kinds", () => {
    const preview = buildImportDecisionPreview({
      validCount: 4,
      sampleLimit: 5,
      issues: [
        { excelRow: 2, kind: "error", message: "a", fields: ["name"] },
        { excelRow: 3, kind: "duplicate", message: "d", fields: ["phone"] },
        { excelRow: 4, kind: "error", message: "b", fields: ["import_agent_1"] },
        { excelRow: 5, kind: "error", message: "c", fields: ["inn"] },
        { excelRow: 6, kind: "error", message: "e", fields: ["name"] },
        { excelRow: 7, kind: "error", message: "f", fields: ["name"] }
      ]
    });
    expect(preview.validCount).toBe(4);
    expect(preview.errorCount).toBe(5);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.errorSamples).toHaveLength(5);
    expect(preview.totalErrorMessages).toBe(6);
  });
});
