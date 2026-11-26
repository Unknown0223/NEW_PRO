import type { CellFormatState } from "@/components/reports/virtual-pivot-format-dialogs";

/** Live «Образец» for Формат ячеек dialog. */
export function formatCellFormatSample(
  state: CellFormatState,
  raw = -1234.5
): string {
  if (raw === 0 && state.nullValue) return state.nullValue;
  const places = Math.max(0, Math.min(4, Number(state.decimalPlaces) || 0));
  let n = state.asPercent || state.formatType === "percent" ? raw * 100 : raw;
  const neg = n < 0;
  n = Math.abs(n);
  const fixed = n.toFixed(places);
  const [intPart, frac = ""] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, state.thousands === "space" ? " " : state.thousands);
  let body = places > 0 ? `${grouped}${state.decimalSep}${frac}` : grouped;
  if (state.formatType === "currency" && !state.asPercent) {
    body = `${body} ${state.currency}`;
  } else if (state.asPercent || state.formatType === "percent") {
    body = `${body}%`;
  }
  if (neg) body = state.negatives === "(1)" ? `(${body})` : `-${body}`;
  return body;
}
