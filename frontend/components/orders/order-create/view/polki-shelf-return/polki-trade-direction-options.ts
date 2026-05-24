import { POLKI_TRADE_DIRECTION_OPTS } from "../../constants";

/** Tenant `settings_profile.references.trade_directions` — agent sozlamalari bilan bir xil ro‘yxat. */
export function tradeDirectionOptionsFromProfile(
  directions: string[] | undefined
): Array<{ value: string; label: string }> {
  const fromProfile = (directions ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ value: name, label: name }));
  const fallback = POLKI_TRADE_DIRECTION_OPTS.filter((o) => o.value.trim() !== "");
  const list = fromProfile.length > 0 ? fromProfile : fallback;
  return [{ value: "", label: "— выберите —" }, ...list];
}

export function tradeDirectionLabel(
  value: string,
  directions: string[] | undefined
): string {
  const v = value.trim();
  if (!v) return "";
  const hit = tradeDirectionOptionsFromProfile(directions).find((o) => o.value === v);
  return hit?.label ?? v;
}
