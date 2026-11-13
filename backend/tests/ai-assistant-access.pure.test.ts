import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assistantFeatureOf,
  gateAssistantFeature,
  hasAssistantChat
} from "../src/modules/ai/ai.assistant-access.pure";
import type { AiToolSpec } from "../src/modules/ai/ai.tool";

function tool(partial: Partial<AiToolSpec> & Pick<AiToolSpec, "id" | "domain">): AiToolSpec {
  return {
    kind: "read",
    title: "t",
    description: "",
    method: "GET",
    anyOf: [],
    schema: z.object({}),
    path: () => "/",
    ...partial
  };
}

describe("assistantFeatureOf", () => {
  it("sales → reports", () => {
    expect(assistantFeatureOf(tool({ id: "sales.summary", domain: "sales" }))).toBe("reports");
  });
  it("tasks → tasks", () => {
    expect(assistantFeatureOf(tool({ id: "tasks.list", domain: "tasks" }))).toBe("tasks");
  });
  it("clients → general", () => {
    expect(assistantFeatureOf(tool({ id: "clients.list", domain: "clients" }))).toBe("general");
  });
});

describe("gateAssistantFeature", () => {
  it("chat yo‘q → rad", () => {
    const r = gateAssistantFeature(tool({ id: "clients.list", domain: "clients" }), {
      unrestricted: false,
      keys: new Set()
    });
    expect(r.allowed).toBe(false);
  });
  it("reports yo‘q → sales rad", () => {
    const r = gateAssistantFeature(tool({ id: "sales.summary", domain: "sales" }), {
      unrestricted: false,
      keys: new Set(["assistant.chat.view"])
    });
    expect(r.allowed).toBe(false);
  });
  it("tasks.create yo‘q → write task rad", () => {
    const r = gateAssistantFeature(
      tool({ id: "write.create_task", domain: "tasks", kind: "write" }),
      { unrestricted: false, keys: new Set(["assistant.chat.view", "assistant.tasks.view"]) }
    );
    expect(r.allowed).toBe(false);
  });
  it("tasks.create bor → ok", () => {
    const r = gateAssistantFeature(
      tool({ id: "write.create_task", domain: "tasks", kind: "write" }),
      {
        unrestricted: false,
        keys: new Set(["assistant.chat.view", "assistant.tasks.view", "assistant.tasks.create"])
      }
    );
    expect(r.allowed).toBe(true);
  });
});

describe("hasAssistantChat", () => {
  it("admin unrestricted", () => {
    expect(hasAssistantChat({ unrestricted: true, keys: new Set() })).toBe(true);
  });
  it("kalit bilan", () => {
    expect(hasAssistantChat({ unrestricted: false, keys: new Set(["assistant.chat.view"]) })).toBe(true);
  });
});
