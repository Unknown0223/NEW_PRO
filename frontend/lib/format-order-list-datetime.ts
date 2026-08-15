import { formatAppDateTimeShort } from "@/lib/app-timezone";

/** Ro‘yxat jadvalidagi sana/vaqt: `24.05 17:19` (Asia/Tashkent) */
export function formatOrderListDateTime(iso: string | null | undefined): string {
  return formatAppDateTimeShort(iso);
}
