/**
 * Табель qatorlarini tartiblash:
 * - bitta rol → tekis ro‘yxat (FIO)
 * - SVR + agent (yoki «все») → agentlar guruhlab, ostida SVR; bog‘lanmagan rollar oxirida
 */

export type TimesheetOrderable = {
  user_id: number;
  fio: string;
  role: string;
  is_departed?: boolean;
  supervisor_user_id?: number | null;
};

const FIELD_HIERARCHY_ROLES = new Set(["agent", "supervisor"]);

/** Kassir, ombor va boshqa «mustaqil» rollar — hierarxiya oxirida. */
export function isUnlinkedStaffRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  if (!r) return true;
  if (FIELD_HIERARCHY_ROLES.has(r)) return false;
  return true;
}

export function shouldGroupSupervisorAgents(selectedRoles: string[] | undefined): boolean {
  if (!selectedRoles || selectedRoles.length === 0) return true;
  const set = new Set(selectedRoles.map((r) => r.trim().toLowerCase()).filter(Boolean));
  return set.has("supervisor") && set.has("agent");
}

function byFio(a: TimesheetOrderable, b: TimesheetOrderable): number {
  return a.fio.localeCompare(b.fio, "ru");
}

function departedLast<T extends TimesheetOrderable>(rows: T[]): T[] {
  const active = rows.filter((r) => !r.is_departed);
  const departed = rows.filter((r) => r.is_departed);
  return [...active, ...departed];
}

/**
 * SVR→agent guruhlash: har bir SVR uchun avval uning agentlari, keyin SVR qatori.
 * Agentlar SVRsiz — alohida blok; qolgan rollar — oxirida (faqat tanlangan rollar ichida).
 */
export function orderTimesheetRows<T extends TimesheetOrderable>(
  rows: T[],
  selectedRoles?: string[]
): T[] {
  if (rows.length <= 1) return rows;

  const selectedNorm = selectedRoles?.map((r) => r.trim().toLowerCase()).filter(Boolean);
  const selectedSet = selectedNorm?.length ? new Set(selectedNorm) : null;

  // Explicit role filter → qat'iy; auditor kabi "others" sizib kirmasin.
  const scoped = selectedSet ? rows.filter((r) => selectedSet.has(r.role.trim().toLowerCase())) : rows;
  if (scoped.length <= 1) return scoped;

  if (!shouldGroupSupervisorAgents(selectedNorm)) {
    const sorted = [...scoped].sort((a, b) => {
      if (Boolean(a.is_departed) !== Boolean(b.is_departed)) return a.is_departed ? 1 : -1;
      const roleCmp = a.role.localeCompare(b.role, "ru");
      if (roleCmp !== 0) return roleCmp;
      return byFio(a, b);
    });
    return sorted;
  }

  const supervisors = scoped.filter((r) => r.role.trim().toLowerCase() === "supervisor");
  const agents = scoped.filter((r) => r.role.trim().toLowerCase() === "agent");
  const others = scoped.filter((r) => {
    if (!isUnlinkedStaffRole(r.role)) return false;
    // «Все» — barcha bog‘lanmagan; tanlangan rollar — faqat shu ro‘yxatdagilar.
    if (!selectedSet) return true;
    return selectedSet.has(r.role.trim().toLowerCase());
  });

  const usedAgentIds = new Set<number>();
  const out: T[] = [];

  const svrs = [...supervisors].sort(byFio);
  for (const svr of svrs) {
    const team = agents.filter((a) => a.supervisor_user_id === svr.user_id).sort(byFio);
    for (const a of team) {
      usedAgentIds.add(a.user_id);
      out.push(a);
    }
    out.push(svr);
  }

  const orphanAgents = agents.filter((a) => !usedAgentIds.has(a.user_id)).sort(byFio);
  out.push(...orphanAgents);

  const otherSorted = [...others].sort((a, b) => {
    const roleCmp = a.role.localeCompare(b.role, "ru");
    if (roleCmp !== 0) return roleCmp;
    return byFio(a, b);
  });
  out.push(...otherSorted);

  return departedLast(out);
}

/** `roles=a,b` yoki bitta `role` query → massiv. */
export function parseTimesheetRoleFilter(role?: string, rolesCsv?: string): string[] | undefined {
  const fromCsv = (rolesCsv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromCsv.length > 0) return [...new Set(fromCsv)];
  const single = role?.trim();
  if (single) return [single];
  return undefined;
}
