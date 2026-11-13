import { describe, expect, it } from "vitest";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../src/modules/ai/ai.providers.crypto";
import {
  cooldownSecondsForFailCount,
  markProviderFailure,
  markProviderSuccess,
  mergeProvidersPatch,
  parseAiAssistantSettings,
  pickRuntimeProviders,
  toPublicSettings
} from "../src/modules/ai/ai.providers.pure";
import type { AiProviderStored } from "../src/modules/ai/ai.providers.types";

function provider(partial: Partial<AiProviderStored> & Pick<AiProviderStored, "id" | "name">): AiProviderStored {
  return {
    kind: "openai_compatible",
    tier: "free",
    baseUrl: "https://api.example.com/v1",
    model: "m1",
    apiKeyEnc: encryptApiKey("sk-test-key-123456"),
    enabled: true,
    priority: 1,
    ...partial
  };
}

describe("ai.providers.crypto", () => {
  it("encrypt/decrypt roundtrip", () => {
    const enc = encryptApiKey("sk-secret-abc");
    expect(enc).not.toContain("sk-secret");
    expect(decryptApiKey(enc)).toBe("sk-secret-abc");
    expect(maskApiKey("sk-secret-abc")).toMatch(/^sk-s/);
  });
});

describe("ai.providers.pure failover", () => {
  it("skips cooldown and sorts by priority", () => {
    const stored = {
      enabled: true,
      providers: [
        provider({ id: "b", name: "B", priority: 2 }),
        provider({
          id: "a",
          name: "A",
          priority: 1,
          cooldownUntil: new Date(Date.now() + 60_000).toISOString()
        }),
        provider({ id: "c", name: "C", priority: 3, enabled: false })
      ]
    };
    const runtime = pickRuntimeProviders(stored);
    expect(runtime.map((p) => p.id)).toEqual(["b"]);
  });

  it("merge keeps old key when apiKey empty", () => {
    const current = {
      enabled: true,
      providers: [provider({ id: "a", name: "A" })]
    };
    const next = mergeProvidersPatch(current, {
      providers: [{ id: "a", name: "A2", baseUrl: "https://api.example.com/v1", model: "m2" }]
    });
    expect(decryptApiKey(next.providers[0]!.apiKeyEnc)).toBe("sk-test-key-123456");
    expect(next.providers[0]!.name).toBe("A2");
  });

  it("mark failure sets cooldown; success clears", () => {
    const p = provider({ id: "a", name: "A", failCount: 0 });
    const failed = markProviderFailure(p, "HTTP 429");
    expect(failed.failCount).toBe(1);
    expect(failed.cooldownUntil).toBeTruthy();
    expect(cooldownSecondsForFailCount(1)).toBe(30);
    const ok = markProviderSuccess(failed);
    expect(ok.failCount).toBe(0);
    expect(ok.cooldownUntil).toBeNull();
  });

  it("public settings never expose raw key", () => {
    const stored = parseAiAssistantSettings({
      ai_assistant: {
        enabled: true,
        providers: [provider({ id: "a", name: "Groq" })]
      }
    });
    const pub = toPublicSettings(stored, false);
    expect(pub.providers[0]!.hasApiKey).toBe(true);
    expect(JSON.stringify(pub)).not.toContain("sk-test-key");
  });
});
