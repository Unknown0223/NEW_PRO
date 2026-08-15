import { redirect } from "next/navigation";

/** Eski stack-strategiya sahifasi — endi alohida «Стратегия бонусов и скидок». */
export default function LegacyBonusRulesStrategyRedirect() {
  redirect("/settings/bonus-strategies");
}
