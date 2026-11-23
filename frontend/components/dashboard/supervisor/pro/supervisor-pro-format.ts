import { formatNumberGrouped } from "@/lib/format-numbers";

export function parseSupervisorProAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function formatSupervisorProMoney(value: number): string {
  return formatNumberGrouped(Math.round(value), { maxFractionDigits: 0, minFractionDigits: 0 });
}

export function compactSupervisorProMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)} млн`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1000)} тыс.`;
  }
  return String(Math.round(value));
}

export function formatSupervisorProNumber(value: number): string {
  return formatNumberGrouped(Math.round(value), { maxFractionDigits: 0, minFractionDigits: 0 });
}

export function formatSupervisorProPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function supervisorProDateLabel(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length < 3) return ymd;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function downloadSupervisorProCsv(filename: string, rows: (string | number)[][]) {
  const csv = `\ufeff${rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const COLORS = ["#12bd95", "#287cf4", "#9147ed", "#f7b62d", "#ff768f", "#4c91f7", "#ae5ce8", "#38c7ad"];

export function supervisorProColor(index: number): string {
  return COLORS[index % COLORS.length]!;
}
