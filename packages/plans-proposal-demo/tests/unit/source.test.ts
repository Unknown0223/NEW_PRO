import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, calculateMultiProposal, cloneConfig } from "@salec/plans-proposal";
import { buildMultiDemoInput, INITIAL_CONTEXT } from "../../src/data/demo-data";
import { acceptedPreviousPlan, hasUsableFact } from "../../src/lib/source";

const context = { ...INITIAL_CONTEXT, source: { year: 2026, month: 10 } };
const configs = Object.fromEntries(
  [1, 2, 3].map((id) => [String(id), cloneConfig(DEFAULT_CONFIG)])
);
const result = calculateMultiProposal(buildMultiDemoInput(context, configs, [1, 2, 3]));
const rowOf = (id: number) =>
  result.kpis[0]!.result.rows.find((r) => r.key === `${id}:${1000 + id}`)!;

describe("fakt yo‘q bo‘lganda eski rejani ko‘rsatish", () => {
  it("manfiy va nol faktni yaroqsiz deb topadi", () => {
    expect(hasUsableFact(rowOf(1))).toBe(true);
    expect(hasUsableFact(rowOf(9))).toBe(false); // manfiy net
    expect(hasUsableFact(rowOf(11))).toBe(false); // fakt yo‘q
    expect(hasUsableFact(rowOf(8))).toBe(false); // nol fakt
  });

  it("fakt yo‘q katakda tasdiqlangan eski reja qiymatini qaytaradi", () => {
    expect(acceptedPreviousPlan(rowOf(11))?.value).toBeTruthy();
    expect(BigInt(acceptedPreviousPlan(rowOf(9))!.value)).toBeGreaterThan(0n);
  });

  it("yangi agentda fakt ham eski reja ham yo‘q", () => {
    expect(hasUsableFact(rowOf(7))).toBe(false);
    expect(acceptedPreviousPlan(rowOf(7))).toBeNull();
  });

  it("eski reja 0 bo‘lsa asos sifatida taklif qilinmaydi", () => {
    expect(acceptedPreviousPlan(rowOf(8))).toBeNull();
  });

  it("pending_approval faqat official maqom filtrida qabul qilinadi", () => {
    const pending = rowOf(14);
    expect(pending.employee.previousPlan?.status).toBe("pending_approval");
    expect(acceptedPreviousPlan(pending)).toBeNull();
    expect(acceptedPreviousPlan(pending, "official")?.value).toBeTruthy();
  });
});
