import { roleLabel } from "@/lib/payroll/payroll-api";

/** Faol xodimi bor rollar. «Другие» ga yig‘ilmaydi. */
export function activeEmployeeRoles(people: Array<{ role: string }>): string[] {
  const ids = new Set<string>();
  for (const p of people) if (p.role) ids.add(p.role);
  return [...ids].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b), "ru"));
}
