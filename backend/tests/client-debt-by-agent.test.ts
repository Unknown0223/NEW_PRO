import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { splitDebtFromOrderRemainders } from "../src/modules/client-balances/client-debt-by-agent";

describe("splitDebtFromOrderRemainders", () => {
  it("Davron 4M legacy + Sardor 2M current with names", () => {
    const r = splitDebtFromOrderRemainders(
      [
        { agent_id: 1, agent_name: "Davron", remainder: new Prisma.Decimal(4_000_000) },
        { agent_id: 2, agent_name: "Sardor", remainder: new Prisma.Decimal(2_000_000) }
      ],
      2
    );
    expect(Number(r.legacy_debt)).toBe(4_000_000);
    expect(Number(r.current_debt)).toBe(2_000_000);
    expect(Number(r.total_debt)).toBe(6_000_000);
    expect(r.legacy_agent_names).toBe("Davron");
    expect(r.current_agent_name).toBe("Sardor");
    expect(r.legacy_agent_ids).toEqual([1]);
  });

  it("after FIFO 5M: legacy 0, current 1M", () => {
    const r = splitDebtFromOrderRemainders(
      [
        { agent_id: 1, agent_name: "Davron", remainder: new Prisma.Decimal(0) },
        { agent_id: 2, agent_name: "Sardor", remainder: new Prisma.Decimal(1_000_000) }
      ],
      2
    );
    expect(Number(r.legacy_debt)).toBe(0);
    expect(Number(r.current_debt)).toBe(1_000_000);
    expect(r.legacy_agent_names).toBeNull();
    expect(r.current_agent_name).toBe("Sardor");
  });

  it("no current agent → all legacy", () => {
    const r = splitDebtFromOrderRemainders(
      [
        { agent_id: 1, agent_name: "A", remainder: new Prisma.Decimal(100) },
        { agent_id: 2, agent_name: "B", remainder: new Prisma.Decimal(50) }
      ],
      null
    );
    expect(Number(r.legacy_debt)).toBe(150);
    expect(Number(r.current_debt)).toBe(0);
    expect(r.legacy_agent_names).toContain("A");
    expect(r.legacy_agent_names).toContain("B");
    expect(r.current_agent_name).toBeNull();
  });

  it("ignores non-positive remainders", () => {
    const r = splitDebtFromOrderRemainders(
      [
        { agent_id: 2, agent_name: "Sardor", remainder: new Prisma.Decimal(0) },
        { agent_id: 1, agent_name: "Davron", remainder: new Prisma.Decimal(-10) },
        { agent_id: 2, agent_name: "Sardor", remainder: new Prisma.Decimal(10) }
      ],
      2
    );
    expect(Number(r.current_debt)).toBe(10);
    expect(Number(r.legacy_debt)).toBe(0);
    expect(r.current_agent_name).toBe("Sardor");
  });

  it("fired old agent debt moves to current workplace agent", () => {
    const r = splitDebtFromOrderRemainders(
      [
        { agent_id: 1, agent_name: "Davron", remainder: new Prisma.Decimal(4_000_000) },
        { agent_id: 2, agent_name: "Sardor", remainder: new Prisma.Decimal(2_000_000) }
      ],
      2,
      {
        inactiveAgentIds: new Set([1]),
        currentAgentName: "Sardor"
      }
    );
    expect(Number(r.legacy_debt)).toBe(0);
    expect(Number(r.current_debt)).toBe(6_000_000);
    expect(r.legacy_agent_names).toBeNull();
    expect(r.legacy_agent_ids).toEqual([]);
    expect(r.current_agent_name).toBe("Sardor");
  });
});
