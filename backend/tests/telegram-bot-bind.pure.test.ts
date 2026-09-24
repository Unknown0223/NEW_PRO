import { describe, expect, it } from "vitest";
import {
  asTelegramBotRole,
  decideTelegramBind,
  isTelegramBotAllowedRole,
  normSmartCode,
  telegramBotCanAddClients,
  telegramBotCanDownloadIntake
} from "../src/modules/telegram-bot/telegram-bot.bind";

describe("telegram staff bind", () => {
  it("allows first bind", () => {
    expect(
      decideTelegramBind({
        telegramId: "111",
        staffUserId: 5,
        byTelegramUserId: null,
        boundTelegramId: null
      })
    ).toEqual({ ok: true, alreadyBound: false });
  });

  it("allows same telegram to re-enter same staff", () => {
    expect(
      decideTelegramBind({
        telegramId: "111",
        staffUserId: 5,
        byTelegramUserId: 5,
        boundTelegramId: "111"
      })
    ).toEqual({ ok: true, alreadyBound: true });
  });

  it("blocks another telegram for an already bound staff", () => {
    expect(
      decideTelegramBind({
        telegramId: "222",
        staffUserId: 5,
        byTelegramUserId: null,
        boundTelegramId: "111"
      })
    ).toEqual({ ok: false, reason: "staff_bound_other_telegram" });
  });

  it("blocks a telegram already used by another staff", () => {
    expect(
      decideTelegramBind({
        telegramId: "111",
        staffUserId: 9,
        byTelegramUserId: 5,
        boundTelegramId: null
      })
    ).toEqual({ ok: false, reason: "telegram_taken" });
  });

  it("allows agent, SVR, operator; denies expeditor", () => {
    expect(isTelegramBotAllowedRole("agent")).toBe(true);
    expect(isTelegramBotAllowedRole("supervisor")).toBe(true);
    expect(isTelegramBotAllowedRole("operator")).toBe(true);
    expect(isTelegramBotAllowedRole("admin")).toBe(true);
    expect(isTelegramBotAllowedRole("auditor")).toBe(true);
    expect(isTelegramBotAllowedRole("expeditor")).toBe(false);
    expect(asTelegramBotRole("agent")).toBe("agent");
    expect(asTelegramBotRole("supervisor")).toBe("supervisor");
    expect(asTelegramBotRole("expeditor")).toBeNull();
  });

  it("only agent can add; others download", () => {
    expect(telegramBotCanAddClients("agent")).toBe(true);
    expect(telegramBotCanDownloadIntake("agent")).toBe(false);
    expect(telegramBotCanAddClients("operator")).toBe(false);
    expect(telegramBotCanDownloadIntake("operator")).toBe(true);
    expect(telegramBotCanDownloadIntake("supervisor")).toBe(true);
  });

  it("normalizes smart codes", () => {
    expect(normSmartCode("a-andijon-001")).toBe(normSmartCode("A ANDIJON 001"));
  });
});
