/** AI Assistant — tool run → foydalanuvchi javobi (AiAnswer shaklda). */
import { genericTable } from "./ai.format";
import type { AiToolRun } from "./ai.types";
import type { AiActor } from "./ai.types";

export type AnswerFromRunInput = {
  actor: AiActor;
  toolId: string;
  run: AiToolRun;
  intent: string;
  slots: Record<string, unknown>;
};

/**
 * Bajarilgan tool run’ini foydalanuvchi uchun qabul qilinadigan javobga aylantiradi.
 * Barcha javoblar AiAnswer shaklida: { title, lines?, groups? }.
 */
export function answerFromRun(input: AnswerFromRunInput): {
  title: string;
  lines?: string[];
  groups?: Array<{ title: string; summary?: string; columns: string[]; rows: string[][] }>;
  truncated?: boolean;
} {
  const { run, toolId, slots } = input;
  if (run.status === "denied") {
    return { title: "Ruxsat yo‘q", lines: [run.message ?? "Ushbu buyruqni bajarishga ruxsat yo‘q"] };
  }
  if (run.status === "error") {
    return {
      title: "Xatolik",
      lines: [run.message ?? "Buyruq bajarishda xatolik yuz berdi", `Sarflangan vaqt: ${run.durationMs} ms`]
    };
  }
  const payload = run.payload ?? {};
  const title = slotTitle(toolId, slots) ?? "Natija";
  const table = genericTable(payload, { title, source: toolId });
  const lines = table.summary ? [table.summary] : [];
  return { title: table.title, groups: [table], lines };
}

function slotTitle(toolId: string, slots: Record<string, unknown>): string | undefined {
  const labels: Record<string, string> = {
    "sales.summary": "Savdo yig‘indisi",
    "sales.trend": "Savdo trendi",
    "sales.by_agent": "Bo‘yicha agentlar",
    "sales.by_product": "Bo‘yicha mahsulotlar",
    "sales.by_client": "Bo‘yicha mijozlar",
    "finance.receivables": "Qarzdorliklar",
    "finance.expenses": "Rasxodlar",
    "orders.list": "Buyurtmalar",
    "clients.list": "Mijozlar",
    "products.list": "Mahsulotlar",
    "stock.balances": "Ombor qoldig‘lari",
    "staff.list": "Xodimlar",
    "tasks.list": "Vazifalar",
    "payroll.list": "Ish haqlari"
  };
  return labels[toolId];
}
