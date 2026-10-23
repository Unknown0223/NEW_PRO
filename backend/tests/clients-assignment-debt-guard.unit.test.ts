import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  enforceAssignmentDebtLocks,
  formatAssignmentDebtBlockMessage,
  formatAssignmentDebtBlockMessageUz,
  hasBlockingAssignmentDebt
} from "../src/modules/clients/clients.assignment-debt-guard";

async function mockSum(
  _tenantId: number,
  _clientId: number,
  person: { kind: string; userId: number }
): Promise<Prisma.Decimal> {
  if (person.kind === "agent" && person.userId === 10) return new Prisma.Decimal("150.50");
  if (person.kind === "expeditor" && person.userId === 20) return new Prisma.Decimal("80.00");
  /** Agent 40: peredoplata — SQL GREATEST → 0 */
  if (person.kind === "agent" && person.userId === 40) return new Prisma.Decimal(0);
  /** Agent 41: tiny positive still blocks (faqat aniq 0) */
  if (person.kind === "agent" && person.userId === 41) return new Prisma.Decimal("0.01");
  return new Prisma.Decimal(0);
}

describe("hasBlockingAssignmentDebt", () => {
  it("blocks only when unpaid > 0; zero and negative (peredoplata raw) allow", () => {
    expect(hasBlockingAssignmentDebt(new Prisma.Decimal(0))).toBe(false);
    expect(hasBlockingAssignmentDebt(new Prisma.Decimal("0.00"))).toBe(false);
    expect(hasBlockingAssignmentDebt(new Prisma.Decimal("-25.00"))).toBe(false);
    expect(hasBlockingAssignmentDebt(new Prisma.Decimal("0.01"))).toBe(true);
    expect(hasBlockingAssignmentDebt(new Prisma.Decimal("100"))).toBe(true);
  });
});

describe("assignment debt guard messages", () => {
  it("formats RU/UZ messages with role, id, slot, amount and zero rule", () => {
    const block = {
      kind: "agent" as const,
      userId: 10,
      slot: 1,
      amount: "150.50",
      messageRu: ""
    };
    const ru = formatAssignmentDebtBlockMessage(block);
    expect(ru).toContain("агента #10");
    expect(ru).toContain("слот 1");
    expect(ru).toContain("150.50");
    expect(ru).toContain("остатке 0");

    const uz = formatAssignmentDebtBlockMessageUz({ ...block, kind: "expeditor" });
    expect(uz).toContain("ekspeditor");
    expect(uz).toContain("#10");
    expect(uz).toContain("150.50");
    expect(uz).toContain("qoldiq 0");
  });
});

describe("enforceAssignmentDebtLocks", () => {
  it("keeps previous agent/expeditor when unpaid debt exists; allows other slot changes", async () => {
    const prevBySlot = new Map([
      [1, { agent_id: 10, expeditor_user_id: 20 }],
      [2, { agent_id: 30, expeditor_user_id: null }]
    ]);

    const { rows, blocks } = await enforceAssignmentDebtLocks({
      tenantId: 1,
      clientId: 100,
      prevBySlot,
      nextRows: [
        { slot: 1, agent_id: 99, expeditor_user_id: 88 },
        { slot: 2, agent_id: 31, expeditor_user_id: null }
      ],
      sumUnpaid: mockSum
    });

    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.kind).sort()).toEqual(["agent", "expeditor"]);
    expect(blocks.find((b) => b.kind === "agent")?.amount).toBe("150.50");
    expect(blocks.find((b) => b.kind === "expeditor")?.amount).toBe("80.00");

    const s1 = rows.find((r) => r.slot === 1)!;
    expect(s1.agent_id).toBe(10);
    expect(s1.expeditor_user_id).toBe(20);

    const s2 = rows.find((r) => r.slot === 2)!;
    expect(s2.agent_id).toBe(31);
  });

  it("allows change when unpaid is exactly zero", async () => {
    const { rows, blocks } = await enforceAssignmentDebtLocks({
      tenantId: 1,
      clientId: 100,
      prevBySlot: new Map([[1, { agent_id: 30, expeditor_user_id: null }]]),
      nextRows: [{ slot: 1, agent_id: 31, expeditor_user_id: null }],
      sumUnpaid: mockSum
    });
    expect(blocks).toHaveLength(0);
    expect(rows[0]?.agent_id).toBe(31);
  });

  it("allows change when peredoplata → unpaid 0 for that agent", async () => {
    const { rows, blocks } = await enforceAssignmentDebtLocks({
      tenantId: 1,
      clientId: 100,
      prevBySlot: new Map([[1, { agent_id: 40, expeditor_user_id: null }]]),
      nextRows: [{ slot: 1, agent_id: 99, expeditor_user_id: null }],
      sumUnpaid: mockSum
    });
    expect(blocks).toHaveLength(0);
    expect(rows[0]?.agent_id).toBe(99);
  });

  it("blocks even 0.01 remainder (faqat aniq 0)", async () => {
    const { rows, blocks } = await enforceAssignmentDebtLocks({
      tenantId: 1,
      clientId: 100,
      prevBySlot: new Map([[1, { agent_id: 41, expeditor_user_id: null }]]),
      nextRows: [{ slot: 1, agent_id: 99, expeditor_user_id: null }],
      sumUnpaid: mockSum
    });
    expect(blocks).toHaveLength(1);
    expect(rows[0]?.agent_id).toBe(41);
  });

  it("restores omitted debt-locked slot when next rows clear it", async () => {
    const { rows, blocks } = await enforceAssignmentDebtLocks({
      tenantId: 1,
      clientId: 100,
      prevBySlot: new Map([[1, { agent_id: 10, expeditor_user_id: null }]]),
      nextRows: [],
      sumUnpaid: mockSum
    });
    expect(blocks).toHaveLength(1);
    expect(rows).toEqual([{ slot: 1, agent_id: 10, expeditor_user_id: null }]);
  });

  it("soft-import scenario: debt on slot1, free change on slot2, expeditor with debt locked", async () => {
    const { rows, blocks } = await enforceAssignmentDebtLocks({
      tenantId: 1,
      clientId: 55,
      prevBySlot: new Map([
        [1, { agent_id: 10, expeditor_user_id: 20 }],
        [2, { agent_id: 40, expeditor_user_id: null }]
      ]),
      nextRows: [
        { slot: 1, agent_id: null, expeditor_user_id: null },
        { slot: 2, agent_id: 77, expeditor_user_id: null }
      ],
      sumUnpaid: mockSum
    });
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(rows.find((r) => r.slot === 1)?.agent_id).toBe(10);
    expect(rows.find((r) => r.slot === 1)?.expeditor_user_id).toBe(20);
    expect(rows.find((r) => r.slot === 2)?.agent_id).toBe(77);
  });
});
