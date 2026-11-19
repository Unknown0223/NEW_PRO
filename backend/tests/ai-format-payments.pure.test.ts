/** Pure — to‘lov jadvali ustunlari va preview limti. */
import { describe, expect, it } from "vitest";
import { answerFromRun } from "../src/modules/ai/ai.answer";
import { genericTable } from "../src/modules/ai/ai.format";
import { detectIntent } from "../src/modules/ai/ai.intent";
import { getTool } from "../src/modules/ai/ai.registry";

const samplePayments = {
  data: [
    {
      id: 1,
      number: "1",
      client_id: 10,
      client_name: "Test Mijoz",
      client_legal_name: "LLC",
      client_code: "c1",
      amount: "150000",
      payment_type: "cash",
      paid_at: "2026-11-18T10:00:00.000Z",
      created_at: "2026-11-18T10:00:00.000Z",
      agent_name: "Agent",
      cash_desk_name: "Kassa 1"
    },
    ...Array.from({ length: 12 }, (_, i) => ({
      id: i + 2,
      number: String(i + 2),
      client_id: 10 + i,
      client_name: `Mijoz ${i}`,
      client_legal_name: null,
      client_code: `c${i}`,
      amount: "1000",
      payment_type: "cash",
      paid_at: "2026-11-18T10:00:00.000Z",
      created_at: "2026-11-18T10:00:00.000Z",
      agent_name: "Agent",
      cash_desk_name: "Kassa 1"
    }))
  ],
  total: 13
};

describe("payments table formatting", () => {
  it("tool.format → Summa ustuni bor", () => {
    const tool = getTool("payments.list");
    expect(tool?.format).toBeTruthy();
    const table = tool!.format!(samplePayments, {});
    expect(table.columns).toContain("Summa");
    expect(table.columns).toContain("Mijoz");
    expect(table.summary).toMatch(/jami/i);
  });

  it("answerFromRun tool.format ishlatadi va 10 qatorga kesadi", () => {
    const out = answerFromRun({
      actor: {
        userId: 1,
        tenantId: 1,
        tenantSlug: "test1",
        role: "admin",
        login: "admin",
        authorization: "Bearer x"
      },
      toolId: "payments.list",
      run: {
        tool: "payments.list",
        status: "ok",
        statusCode: 200,
        payload: samplePayments,
        durationMs: 10
      },
      intent: "payments.list",
      slots: {},
      maxRows: 10
    });
    const g = out.groups?.[0];
    expect(g?.columns).toContain("Summa");
    expect(g?.rows.length).toBe(10);
    expect(g?.truncated).toBe(true);
  });

  it("tolovlar → payments.list intent", () => {
    expect(detectIntent("tolovlar").intent).toBe("payments.list");
    expect(detectIntent("to'lovlar ro'yxati").intent).toBe("payments.list");
  });

  it("preferred yo‘q bo‘lsa ham summa ustunlari oldinga chiqadi", () => {
    const table = genericTable(samplePayments, { title: "X" });
    expect(table.columns.some((c) => /summa|to‘lov|amount/i.test(c) || c === "Summa")).toBe(true);
  });
});
