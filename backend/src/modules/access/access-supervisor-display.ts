/** Hisobot/dashbord: SVR faqat role=supervisor; aks holda «Без супервайзера». */

export const NO_SUPERVISOR_LABEL = "Без супервайзера";
/** Expeditor dashborddagi qisqa yorliq (mavjud matn). */
export const NO_SUPERVISOR_LABEL_SHORT = "Без СВР";

export function isSupervisorRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "supervisor";
}

/**
 * Prisma include / mapper: non-SVR FK bo‘lsa nom chiqmasin (FE «Без супервайзера»).
 */
export function supervisorDisplayNameOrNull(
  supervisor: { name?: string | null; role?: string | null } | null | undefined
): string | null {
  if (!supervisor) return null;
  if (supervisor.role != null && !isSupervisorRole(supervisor.role)) return null;
  const n = (supervisor.name ?? "").trim();
  return n.length > 0 ? n : null;
}

export function supervisorDisplayLabel(
  supervisor: { name?: string | null; role?: string | null } | null | undefined,
  emptyLabel: string = NO_SUPERVISOR_LABEL
): string {
  return supervisorDisplayNameOrNull(supervisor) ?? emptyLabel;
}
