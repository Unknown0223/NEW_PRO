/** Pure logic tests — AI guard (no DB). */
import { describe, it, expect } from "vitest";
import { gateWrite, gateTool, applyDataScope, canWriteEntity } from "../src/modules/ai/ai.guard";
import { AI_CONFIG } from "../src/modules/ai/ai.config";
import type { AiToolSpec } from "../src/modules/ai/ai.tool";
import { z } from "zod";

const readTool: AiToolSpec = {
  id: "read.test",
  kind: "read",
  domain: "sales",
  title: "Test",
  description: "",
  method: "GET",
  anyOf: ["reports.view"],
  schema: z.object({}),
  path: () => "/test"
};

const writeTool: AiToolSpec = {
  id: "write.test",
  kind: "write",
  domain: "staff",
  title: "Test write",
  description: "",
  method: "POST",
  anyOf: ["staff.agent.create"],
  schema: z.object({}),
  path: () => "/agents",
  body: () => ({})
};

function actor(role: string, userId = 100): any {
  return { userId, tenantId: 1, tenantSlug: "t", role, login: "u", authorization: "Bearer x" };
}

describe("gateWrite", () => {
  it("admin → ruxsat bor", () => {
    expect(gateWrite(writeTool, actor("admin"), { unrestricted: true, keys: new Set() }).allowed).toBe(true);
  });
  it("agent → yozish ruxsati yo‘q", () => {
    const r = gateWrite(writeTool, actor("agent"), { unrestricted: false, keys: new Set(["staff.agent.create"]) });
    expect(r.allowed).toBe(false);
  });
  it("director + kalit → ruxsat bor", () => {
    const r = gateWrite(writeTool, actor("director"), {
      unrestricted: false,
      keys: new Set(["assistant.chat.view", "staff.agent.create"])
    });
    expect(r.allowed).toBe(true);
  });
  it("AI_WRITE_ENABLED=0 → rad etiladi", () => {
    const saved = AI_CONFIG.writeEnabled;
    // @ts-ignore — test-only override
    Object.defineProperty(AI_CONFIG, "writeEnabled", { get: () => false, configurable: true });
    const r = gateWrite(writeTool, actor("director"), { unrestricted: true, keys: new Set() });
    expect(r.allowed).toBe(false);
    Object.defineProperty(AI_CONFIG, "writeEnabled", { get: () => saved, configurable: true });
  });
});

describe("gateTool", () => {
  it("kalit yo‘q → read uchun rad etiladi", () => {
    expect(gateTool(readTool, { unrestricted: false, keys: new Set() }).allowed).toBe(false);
  });
  it("admin → har doim ruxsat", () => {
    expect(gateTool(readTool, { unrestricted: true, keys: new Set() }).allowed).toBe(true);
  });
  it("chat+reports+domain → ruxsat", () => {
    const keys = new Set(["assistant.chat.view", "assistant.reports.view", "reports.view"]);
    expect(gateTool(readTool, { unrestricted: false, keys }).allowed).toBe(true);
  });
  it("faqat domain, chat yo‘q → rad", () => {
    const keys = new Set(["reports.view"]);
    expect(gateTool(readTool, { unrestricted: false, keys }).allowed).toBe(false);
  });
  it("chat bor, reports yo‘q → sales tool rad", () => {
    const keys = new Set(["assistant.chat.view", "reports.view"]);
    expect(gateTool(readTool, { unrestricted: false, keys }).allowed).toBe(false);
  });
});

describe("applyDataScope", () => {
  it("agent → user_id o‘ziga tenglanadi", () => {
    const out = applyDataScope({ user_id: 999, agent_id: 5 }, actor("agent", 42));
    expect(out.user_id).toBe(42);
    expect(out.agent_id).toBe(42);
  });
  it("admin → o‘zgarmaydi", () => {
    const out = applyDataScope({ user_id: 999 }, actor("admin", 42));
    expect(out.user_id).toBe(999);
  });
});

describe("canWriteEntity", () => {
  it("agent boshqa xodimni o‘zgartira olmaydi", () => {
    expect(canWriteEntity(actor("agent", 7), { agent_id: 8 })).toBe(false);
    expect(canWriteEntity(actor("agent", 7), { agent_id: 7 })).toBe(true);
    expect(canWriteEntity(actor("director", 7), { agent_id: 8 })).toBe(true);
  });
});
