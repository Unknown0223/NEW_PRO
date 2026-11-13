/**
 * AI Помощник — Access feature gate (chat / reports / tasks).
 *
 * Domain RBAC (`tool.anyOf`) dan OLDIN tekshiriladi.
 * Kalit yo‘q → shu turdagi tool butunlay yopiladi (rol yoki akkaunt Access da).
 */
import {
  ASSISTANT_CHAT_VIEW,
  ASSISTANT_REPORTS_VIEW,
  ASSISTANT_TASKS_CREATE,
  ASSISTANT_TASKS_VIEW
} from "../access/permission-assistant-sections";
import type { AiToolSpec } from "./ai.tool";

export type AssistantFeature = "chat" | "reports" | "tasks" | "general";

type PermissionState = { unrestricted: boolean; keys: Set<string> };
type ToolGate = { allowed: boolean; reason?: string };

const REPORT_DOMAINS = new Set(["sales", "finance", "dashboard"]);

/** Tool qaysi AI feature ga tegishli. */
export function assistantFeatureOf(tool: AiToolSpec): AssistantFeature {
  if (tool.domain === "tasks" || tool.id === "write.create_task" || tool.id.startsWith("tasks.")) {
    return "tasks";
  }
  if (REPORT_DOMAINS.has(tool.domain)) return "reports";
  if (
    tool.id.startsWith("kpi.") ||
    tool.id === "branch.stats" ||
    tool.id === "inventory.turnover" ||
    tool.id === "tabel.list" ||
    tool.anyOf.some(
      (k) => k.startsWith("reports.") || k.includes(".otchety.") || k === "reports.view"
    )
  ) {
    return "reports";
  }
  return "general";
}

export function hasAssistantChat(state: PermissionState): boolean {
  if (state.unrestricted) return true;
  return state.keys.has(ASSISTANT_CHAT_VIEW);
}

/** Chat + feature (reports/tasks) + mavjud domain anyOf. */
export function gateAssistantFeature(tool: AiToolSpec, state: PermissionState): ToolGate {
  if (state.unrestricted) return { allowed: true };
  if (!state.keys.has(ASSISTANT_CHAT_VIEW)) {
    return { allowed: false, reason: "Помощник o‘chirilgan (assistant.chat.view)" };
  }
  const feature = assistantFeatureOf(tool);
  if (feature === "reports" && !state.keys.has(ASSISTANT_REPORTS_VIEW)) {
    return { allowed: false, reason: "AI otchyotlar yopiq (assistant.reports.view)" };
  }
  if (feature === "tasks") {
    if (tool.kind === "write") {
      if (!state.keys.has(ASSISTANT_TASKS_CREATE)) {
        return { allowed: false, reason: "AI vazifa yaratish yopiq (assistant.tasks.create)" };
      }
    } else if (!state.keys.has(ASSISTANT_TASKS_VIEW)) {
      return { allowed: false, reason: "AI vazifalar yopiq (assistant.tasks.view)" };
    }
  }
  return { allowed: true };
}
