/** AI Помощник — Access katalogi (rol / akkaunt). */
import type { PermissionAction, PermissionSectionDef } from "./permission-model";

const VIEW_ONLY: PermissionAction[] = ["view"];
const VIEW_CREATE: PermissionAction[] = ["view", "create"];

/**
 * `assistant.chat` — yordamchini ochish / savol berish.
 * `assistant.reports` — AI orqali otchyot/analitika (savdo, moliya, KPI…).
 * `assistant.tasks` — AI orqali vazifalar (ko‘rish / yaratish).
 *
 * Ikkalasini (reports+tasks) olib tashlasa — shu imkoniyatlar AI da yo‘qoladi;
 * `chat` ni olib tashlasa — «Помощник» menyu va /ai/ask butunlay yopiladi.
 */
export const ASSISTANT_PERMISSION_SECTIONS: PermissionSectionDef[] = [
  {
    module: "assistant",
    section: "chat",
    labelRu: "Помощник — чат",
    actions: VIEW_ONLY
  },
  {
    module: "assistant",
    section: "reports",
    labelRu: "Помощник — отчёты и аналитика",
    actions: VIEW_ONLY
  },
  {
    module: "assistant",
    section: "tasks",
    labelRu: "Помощник — задачи",
    actions: VIEW_CREATE
  }
];

export const ASSISTANT_CHAT_VIEW = "assistant.chat.view";
export const ASSISTANT_REPORTS_VIEW = "assistant.reports.view";
export const ASSISTANT_TASKS_VIEW = "assistant.tasks.view";
export const ASSISTANT_TASKS_CREATE = "assistant.tasks.create";
