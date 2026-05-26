import { orderListStatusLabel } from "@/lib/order-list-status-labels";

/** Holat o‘tishida modal sarlavhasi. */
export function orderStatusDatetimeDialogTitle(
  targetStatus: string,
  orderType: string | null | undefined
): string {
  const label = orderListStatusLabel(targetStatus, orderType);
  return `Дата и время: ${label}`;
}

export function orderMilestoneDatetimeDialogTitle(): string {
  return "Ожидаемая дата отгрузки";
}

export function defaultDatetimeLocalValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` → ISO (server). */
export function datetimeLocalToIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid datetime");
  return d.toISOString();
}
