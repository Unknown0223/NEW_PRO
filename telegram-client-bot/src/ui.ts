export const HTML = { parse_mode: "HTML" as const };

export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function htmlKb(markup: unknown): { parse_mode: "HTML"; reply_markup: unknown } {
  return { parse_mode: "HTML", reply_markup: markup };
}

export function progressBar(step: number, total: number, width = 8): string {
  const filled = Math.max(0, Math.min(width, Math.round((step / Math.max(1, total)) * width)));
  return `${"🟩".repeat(filled)}${"⬜".repeat(width - filled)}  <code>${step}/${total}</code>`;
}

export function card(title: string, body: string): string {
  return `${title}\n\n${body}`;
}

export const CANCEL_REPLY_TEXTS = new Set(["❌ Bekor", "Bekor", "❌ BEKOR", "❌ bekor"]);
