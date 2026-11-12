/** AI Assistant — tool registri (allow-list). */
import { READ_TOOLS_FINANCE } from "./ai.tools.read";
import { READ_TOOLS_OPS } from "./ai.tools.read.ops";
import { READ_TOOLS_EXTRA } from "./ai.tools.read.extra";
import { WRITE_TOOLS } from "./ai.tools.write";
import { gateTool } from "./ai.guard";
import type { PermissionState } from "./ai.guard";
import type { AiToolSpec } from "./ai.tool";

const ALL: AiToolSpec[] = [...READ_TOOLS_FINANCE, ...READ_TOOLS_OPS, ...READ_TOOLS_EXTRA, ...WRITE_TOOLS];

const BY_ID = new Map<string, AiToolSpec>(ALL.map((tool) => [tool.id, tool]));

export const ALL_TOOLS: ReadonlyArray<AiToolSpec> = ALL;
export const READ_TOOLS: ReadonlyArray<AiToolSpec> = ALL.filter((tool) => tool.kind === "read");
export const WRITE_TOOL_LIST: ReadonlyArray<AiToolSpec> = ALL.filter((tool) => tool.kind === "write");

export function getTool(id: string): AiToolSpec | undefined {
  return BY_ID.get(id);
}

export type CapabilityItem = {
  id: string;
  kind: "read" | "write";
  domain: string;
  title: string;
  description: string;
  allowed: boolean;
  reason?: string;
};

/** Foydalanuvchi uchun ruxsat etilgan imkoniyatlar ro'yxati. */
export function listCapabilities(state: PermissionState): CapabilityItem[] {
  return ALL.map((tool) => {
    const gate = gateTool(tool, state);
    return {
      id: tool.id,
      kind: tool.kind,
      domain: tool.domain,
      title: tool.title,
      description: tool.description,
      allowed: gate.allowed,
      reason: gate.reason
    };
  });
}

/** UI uchun tayyor savol namunalari (uz/ru). */
export const AI_EXAMPLES: ReadonlyArray<{ question: string; hint: string }> = [
  { question: "Umumiy holat: savdo, qarz, kassa", hint: "Boshlang‘ich umumiy ma’lumot" },
  { question: "Bugun savdo qancha bo‘ldi?", hint: "Bugungi savdo yakuni" },
  { question: "Shu oy savdo va top agentlar", hint: "Oy bo‘yicha savdo" },
  { question: "Qarzdorlar ro‘yxati Excelda", hint: "Qarzdorlik + fayl" },
  { question: "Oxirgi 7 kun to‘lovlar", hint: "To‘lovlar ro‘yxati" },
  { question: "Rasxodlar va foyda shu oy", hint: "Moliya" },
  { question: "Ombordagi qoldiq", hint: "Ombor" },
  { question: "Agentlar ro‘yxati", hint: "Xodimlar" },
  { question: "Ish haqi shu oy", hint: "Payroll" },
  { question: "SKU-001 narxini 150000 qil", hint: "Narx o‘zgartirish (tasdiqlash bilan)" },
  { question: "Buyurtma #123 tafsilotlari", hint: "Buyurtma haqiqiyligi" },
  { question: "Konsignatsiya qarzlari", hint: "Konsignatsiya" },
  { question: "Filial bo'yicha statistika", hint: "Filial" },
  { question: "Tabel shu oy", hint: "Ish kunlari" },
  { question: "KPI plan-rasto", hint: "Plan vs fact" },
  { question: "Narx matritsasi", hint: "Mahsulot narxlari" },
  { question: "Ombor aylanishi", hint: "Ombor aylanishi" }
];
