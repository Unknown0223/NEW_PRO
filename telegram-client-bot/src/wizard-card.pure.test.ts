import { describe, expect, it } from "vitest";
import { shouldEditWizard } from "./flow.js";
import { wizardScreen } from "./texts.js";
import type { ClientDraft } from "./types.js";

function draft(p: Partial<ClientDraft>): Partial<ClientDraft> {
  return p;
}

describe("wizard single card", () => {
  it("first step has empty Klient and asks name", () => {
    const t = wizardScreen({}, "name");
    expect(t).toContain("Klient:</b> —");
    expect(t).toContain("Nomi");
    expect(t).toContain("hozir");
    expect(t).toContain("Lotin BOSH HARF");
  });

  it("after name shows Klient: and your written name", () => {
    const t = wizardScreen(draft({ name: "ANVARBEK MCHJ" }), "legal_name");
    expect(t).toContain("Klient:</b> <code>ANVARBEK MCHJ</code>");
    expect(t).toContain("✅");
    expect(t).toContain("ANVARBEK MCHJ");
    expect(t).toContain("Yuridik");
  });

  it("second field updates the same card with previous steps", () => {
    const t = wizardScreen(
      draft({ name: "ANVARBEK MCHJ", legal_name: "ANVARBEK MK", address: "LUAUL" }),
      "phone"
    );
    expect(t).toContain("Klient:</b> <code>ANVARBEK MCHJ</code>");
    expect(t).toContain("ANVARBEK MK");
    expect(t).toContain("LUAUL");
    expect(t).toContain("Telefon");
    expect(t).toContain("hozir");
    expect(t.match(/👤 <b>Klient:/g)?.length).toBe(1);
  });

  it("keeps skipped optional steps visible", () => {
    const t = wizardScreen(draft({ name: "AAA SHOP", address: "STREET 1" }), "phone");
    expect(t).toContain("o‘tkazildi");
    expect(t).toContain("Yuridik");
  });

  it("confirm lists filled data without asking a field", () => {
    const t = wizardScreen(
      draft({
        name: "AAA SHOP",
        address: "STREET 1",
        phone: "+998901112233",
        city: "AD_ANDIJON",
        city_label: "Andijon",
        lat: 41.3,
        lon: 69.2
      }),
      "confirm"
    );
    expect(t).toContain("Tekshiring");
    expect(t).toContain("AAA SHOP");
    expect(t).toContain("+998901112233");
    expect(t).not.toContain("— hozir");
  });

  it("shows validation error on the same card", () => {
    const t = wizardScreen({}, "name", "", "Kiril va kichik harf o‘tkazilmaydi.");
    expect(t).toContain("🔴");
    expect(t).toContain("Kiril");
  });
});

describe("wizard message edit policy", () => {
  it("edits in place when keyboard kind is unchanged", () => {
    expect(shouldEditWizard("wizard", "wizard")).toBe(true);
  });

  it("sends a new card only when switching to GPS keyboard", () => {
    expect(shouldEditWizard("wizard", "location")).toBe(false);
    expect(shouldEditWizard("", "wizard")).toBe(false);
  });
});

describe("my list", () => {
  it("shows the confirmed client name", async () => {
    const { formatMyList } = await import("./texts.js");
    const t = formatMyList([{ payload: { name: "AZIZBEK", phone: "+998901112233" } }]);
    expect(t).toContain("AZIZBEK");
    expect(t).toContain("1</b> ta");
    expect(t).not.toMatch(/Tasdiqlangan klientlaringiz: <b>1<\/b> ta\.$/);
  });
});
