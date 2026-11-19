/**
 * ADR-008 M1.3: composer wires PolkiReturnPolicy; call site’da qayta polki mantiq yo‘q.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../components/orders/order-create");

describe("OrderCreate M1.3 PolkiReturnPolicy wiring", () => {
  it("composer imports usePolkiReturnPolicy; no local rebalance / max-return helpers", () => {
    const composer = readFileSync(join(root, "hooks/use-order-create.ts"), "utf8");

    expect(composer).toMatch(/from ["']\.\.\/polki-policy\/use-polki-return-policy["']/);
    expect(composer).toMatch(/usePolkiReturnPolicy\s*\(/);
    expect(composer).not.toMatch(/applyPolkiOrderPieceRebalance/);
    expect(composer).not.toMatch(/from ["']\.\.\/view\/polki-shelf-return\/polki-order-composition["']/);
    expect(composer).not.toMatch(/const \[polkiTotalQty,/);
    expect(composer).not.toMatch(/const selectPolkiOrder = useCallback/);
    expect(composer).not.toMatch(/buildPolkiPairRows\(/);
    expect(composer).not.toMatch(/computePolkiDebtHintSum/);
    expect(composer).not.toMatch(/parsePolkiQty/);
    expect(composer).toMatch(/isPolkiAutoBonusOverMax|polkiSubmitSlice/);
  });

  it("polki-policy module exposes public surface", () => {
    const hook = readFileSync(join(root, "polki-policy/use-polki-return-policy.ts"), "utf8");
    const logic = readFileSync(join(root, "polki-policy/polki-return-policy.logic.ts"), "utf8");

    expect(hook).toMatch(/export function usePolkiReturnPolicy/);
    expect(hook).toMatch(/selectOrders|selectPolkiOrder/);
    expect(hook).toMatch(/setReturnQty|setPolkiTotalQty/);
    expect(hook).toMatch(/canShowPolkiGrid/);
    expect(hook).toMatch(/buildPolkiSubmitSlice|polkiSubmitSlice/);
    expect(logic).toMatch(/export function rebalanceComposition/);
    expect(logic).toMatch(/export function maxReturnQty/);
    expect(logic).toMatch(/export function buildPolkiSubmitSlice/);
  });
});
