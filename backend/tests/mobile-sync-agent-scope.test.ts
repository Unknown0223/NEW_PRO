import { describe, expect, it } from "vitest";
import { agentScopedClientWhere } from "../src/modules/mobile/mobile.service";

describe("agentScopedClientWhere", () => {
  it("matches legacy agent_id and assignment slots", () => {
    const w = agentScopedClientWhere(1, 5);
    expect(w.tenant_id).toBe(1);
    expect(w.merged_into_client_id).toBeNull();
    expect(w.OR).toEqual([
      { agent_id: 5 },
      { agent_assignments: { some: { agent_id: 5 } } }
    ]);
  });
});
