/**
 * `GET /api/:slug/agents` → `StaffRow[]` — ko‘rinadigan ism `fio` da (`name` yo‘q).
 */
import { formatPersonDisplayName, type PersonNameParts } from "@/lib/person-display";

export type AgentListItem = PersonNameParts & {
  id: number;
  login?: string | null;
};

export function agentDisplayName(a: AgentListItem): string {
  const fromParts = formatPersonDisplayName(a);
  if (fromParts) return fromParts;
  const fromLogin = (a.login ?? "").trim();
  if (fromLogin) return fromLogin;
  return `#${a.id}`;
}
