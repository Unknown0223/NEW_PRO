import { formatAppDate, formatAppDateTime } from "@/lib/app-timezone";

/** Sana-vaqt: `25.05.2026 16:17` (Asia/Tashkent). */
export function formatOrderDetailDateTime(iso: string | null | undefined): string {
  return formatAppDateTime(iso, "—");
}

/** Faqat sana: `25.05.2026` (Asia/Tashkent). */
export function formatOrderDetailDateOnly(iso: string | null | undefined): string {
  return formatAppDate(iso, "—");
}
