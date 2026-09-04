import type { AgentAssignmentPatch } from "./clients.types";
import { assertAgentCanTakeNewWork } from "../work-slots/work-slots.agent-gate";
import { assertExpeditorCanTakeNewWork } from "../work-slots/work-slots.expeditor-gate";

/**
 * Import: ish joyisiz agent/dastavchikni bog‘lamaydi — mijoz o‘zi saqlanadi.
 * UI/API `replaceClientAgentAssignments` da qattiq throw qiladi; import soft-filter.
 */
export async function filterImportAgentPatchesByWorkSlot(
  tenantId: number,
  patches: AgentAssignmentPatch[],
  opts: { excelRow: number; warn: (msg: string) => void }
): Promise<AgentAssignmentPatch[]> {
  if (patches.length === 0) return patches;
  const out: AgentAssignmentPatch[] = [];
  for (const p of patches) {
    let next: AgentAssignmentPatch = p;
    if (p.agent_id != null && Number.isFinite(p.agent_id) && p.agent_id >= 1) {
      try {
        await assertAgentCanTakeNewWork(tenantId, p.agent_id);
      } catch (e) {
        if (e instanceof Error && e.message === "AGENT_NOT_ON_SLOT") {
          opts.warn(
            `Qator ${opts.excelRow}: agent #${p.agent_id} (slot ${p.slot}) рабочее местоga biriktirilmagan — mijoz saqlandi, agent bog‘lanmadi.`
          );
          next = { ...next, agent_id: null };
        } else {
          throw e;
        }
      }
    }
    if (next.expeditor_user_id != null && Number.isFinite(next.expeditor_user_id) && next.expeditor_user_id >= 1) {
      try {
        await assertExpeditorCanTakeNewWork(tenantId, next.expeditor_user_id);
      } catch (e) {
        if (e instanceof Error && e.message === "EXPEDITOR_NOT_ON_SLOT") {
          opts.warn(
            `Qator ${opts.excelRow}: dastavchik #${next.expeditor_user_id} (slot ${next.slot}) рабочее местоga biriktirilmagan — mijoz saqlandi, dastavchik bog‘lanmadi.`
          );
          next = { ...next, expeditor_user_id: null };
        } else {
          throw e;
        }
      }
    }
    if (
      next.agent_id != null ||
      next.expeditor_user_id != null ||
      (next.expeditor_phone != null && next.expeditor_phone !== "") ||
      (next.visit_weekdays?.length ?? 0) > 0
    ) {
      out.push(next);
    }
  }
  return out;
}
