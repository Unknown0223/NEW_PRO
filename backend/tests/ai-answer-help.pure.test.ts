/** Pure — bo‘sh plan / salom javobi. */
import { describe, expect, it } from "vitest";
import { answerForEmptyPlan } from "../src/modules/ai/ai.answer";
import { detectIntent } from "../src/modules/ai/ai.intent";
import { planFromQuestion } from "../src/modules/ai/ai.plan";

describe("answerForEmptyPlan", () => {
  it("help.capabilities → salom sarlavha, xatolik emas", () => {
    const answer = answerForEmptyPlan({
      intent: "help.capabilities",
      missing: [],
      capabilities: [
        {
          id: "sales.summary",
          kind: "read",
          domain: "sales",
          title: "Savdo",
          description: "test",
          allowed: true
        }
      ],
      durationMs: 12
    });
    expect(answer.title).toMatch(/Salom/i);
    expect(answer.summary.join(" ")).not.toMatch(/Buyruq bajarilmadi/);
    expect(answer.groups[0]?.rows.length).toBe(1);
    expect(answer.meta.tools).toEqual(["help.capabilities"]);
  });

  it("boshqa bo‘sh intent → aniqlashtirish", () => {
    const answer = answerForEmptyPlan({
      intent: "unknown.thing",
      missing: ["savol mavzusi"],
      capabilities: [],
      durationMs: 1
    });
    expect(answer.title).toBe("Aniqlashtirish kerak");
  });
});

describe("salom → help.capabilities plan", () => {
  it("salom intent help.capabilities, calls bo‘sh", () => {
    expect(detectIntent("salom").intent).toBe("help.capabilities");
    const built = planFromQuestion("salom");
    expect(built.intent).toBe("help.capabilities");
    expect(built.plan.calls).toEqual([]);
  });
});
