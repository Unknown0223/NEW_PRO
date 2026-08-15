import { formatAppDateTimeFull, partsInAppTz } from "@/lib/app-timezone";

/** Tarix sahifasi: `25.05.2026 15:55:24` (Asia/Tashkent) */
export function formatOrderHistoryDateTime(iso: string | null | undefined): string {
  return formatAppDateTimeFull(iso, "");
}

export function formatOrderHistoryDateShort(iso: string | null | undefined): string {
  const p = partsInAppTz(iso);
  if (!p) return "";
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}
