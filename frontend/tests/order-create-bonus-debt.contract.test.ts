/**
 * ADR-008 M1.2: composer wires OrderCreateBonusDebt; call site’da qayta mantiq yo‘q.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../components/orders/order-create");

describe("OrderCreate M1.2 BonusDebt wiring", () => {
  it("composer imports useOrderCreateBonusDebt; no local bonus-preview / debt hint", () => {
    const composer = readFileSync(join(root, "hooks/use-order-create.ts"), "utf8");

    expect(composer).toMatch(/from ["']\.\.\/bonus-debt\/use-order-create-bonus-debt["']/);
    expect(composer).toMatch(/useOrderCreateBonusDebt\s*\(/);
    expect(composer).toMatch(/openBonusPreview/);
    expect(composer).not.toMatch(/orders\/bonus-preview/);
    expect(composer).not.toMatch(/computePolkiDebtHintSum/);
    expect(composer).not.toMatch(/shouldConfirmBonusOnWebNewEdit/);
    expect(composer).not.toMatch(/const \[bonusConfirmOpen,/);
  });

  it("bonus-debt module exposes public surface", () => {
    const hook = readFileSync(join(root, "bonus-debt/use-order-create-bonus-debt.ts"), "utf8");
    const logic = readFileSync(join(root, "bonus-debt/bonus-debt.logic.ts"), "utf8");

    expect(hook).toMatch(/openBonusPreview/);
    expect(hook).toMatch(/confirmBonus/);
    expect(hook).toMatch(/computeDebtAmounts/);
    expect(hook).toMatch(/bonusConfirmOpen/);
    expect(logic).toMatch(/export function computeDebtAmounts/);
  });
});
