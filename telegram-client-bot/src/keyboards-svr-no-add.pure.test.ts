import { describe, expect, it } from "vitest";
import { mainMenuKb, svrMenuKb, BTN } from "./keyboards.js";

describe("telegram bot menus — role capabilities", () => {
  it("agent menu has Yangi klient", () => {
    const labels = mainMenuKb({
      role: "agent",
      can_add_clients: true,
      can_download_intake: false
    })
      .keyboard.flat()
      .map((b) => ("text" in b ? b.text : ""));
    expect(labels).toContain(BTN.add);
    expect(labels).toContain(BTN.my);
  });

  it("operator/SVR menu has only stats + excel + out", () => {
    for (const role of ["supervisor", "operator", "admin"]) {
      const labels = mainMenuKb({
        role,
        can_add_clients: false,
        can_download_intake: true
      })
        .keyboard.flat()
        .map((b) => ("text" in b ? b.text : ""));
      expect(labels).not.toContain(BTN.add);
      expect(labels).not.toContain(BTN.my);
      expect(labels).toContain(BTN.stats);
      expect(labels).toContain(BTN.excel);
      expect(labels).toContain(BTN.out);
    }
  });

  it("legacy inline SVR menu has no add", () => {
    const texts = svrMenuKb()
      .inline_keyboard.flat()
      .map((b) => ("text" in b ? b.text : ""));
    expect(texts).not.toContain(BTN.add);
    expect(texts).toContain(BTN.stats);
    expect(texts).toContain(BTN.excel);
  });
});
