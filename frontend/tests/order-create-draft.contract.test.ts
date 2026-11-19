/**
 * ADR-008 M1.4: composer wires OrderCreateDraft; no local draft god-patterns.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../components/orders/order-create");

describe("OrderCreate M1.4 Draft wiring", () => {
  it("composer imports all three useX; no local qty state / polki pair builder", () => {
    const composer = readFileSync(join(root, "hooks/use-order-create.ts"), "utf8");
    const lines = composer.split(/\r?\n/).length;

    expect(composer).toMatch(/from ["']\.\.\/draft\/use-order-create-draft["']/);
    expect(composer).toMatch(/useOrderCreateDraft\s*\(/);
    expect(composer).toMatch(/from ["']\.\.\/polki-policy\/use-polki-return-policy["']/);
    expect(composer).toMatch(/usePolkiReturnPolicy\s*\(/);
    expect(composer).toMatch(/from ["']\.\.\/bonus-debt\/use-order-create-bonus-debt["']/);
    expect(composer).toMatch(/useOrderCreateBonusDebt\s*\(/);

    expect(composer).not.toMatch(/const \[qtyByProductId,/);
    expect(composer).not.toMatch(/buildPolkiPairRows/);
    expect(composer).not.toMatch(/buildExchangeCreateBody\s*\(/);
    expect(composer).toMatch(/canSubmitOrdinaryBase/);
    expect(composer).toMatch(/from ["']\.\.\/polki-policy\/polki-submit["']/);
    expect(composer).not.toMatch(/draft\/draft\.submit-polki/);

    expect(lines).toBeLessThan(1200);
  });

  it("draft module exposes public surface", () => {
    const hook = readFileSync(join(root, "draft/use-order-create-draft.ts"), "utf8");
    const logic = readFileSync(join(root, "draft/draft.logic.ts"), "utf8");
    const data = readFileSync(join(root, "draft/use-order-create-draft-data.ts"), "utf8");
    const catalog = readFileSync(join(root, "draft/use-order-create-draft-catalog.ts"), "utf8");

    expect(hook).toMatch(/export function useOrderCreateDraft/);
    expect(hook).toMatch(/buildOrdinarySubmit/);
    expect(hook).toMatch(/buildExchangeSubmit/);
    expect(hook).toMatch(/hydrateEdit/);
    expect(hook).toMatch(/setHeader/);
    expect(hook).toMatch(/setQty:/);
    expect(hook).toMatch(/useOrderCreateDraftData/);
    expect(hook).toMatch(/useOrderCreateDraftCatalog/);
    expect(data).toMatch(/export function useOrderCreateDraftData/);
    expect(catalog).toMatch(/export function useOrderCreateDraftCatalog/);
    expect(logic).toMatch(/export function buildOrdinaryItems/);
    expect(logic).toMatch(/export function canSubmitOrdinaryBase/);
  });
});
