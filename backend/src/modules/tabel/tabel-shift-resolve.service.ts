/**
 * Xodim roli va filiali bo'yicha faol smenani tanlaydi.
 */
import { prisma } from "../../config/database";
import { expandBranchFilterKeys } from "../tenant-settings/branch-display.pure";
import { loadBranchLabelSources } from "../tenant-settings/tenant-settings.refs";
import type { BranchDto } from "../tenant-settings/tenant-settings.types";
import { DEFAULT_SHIFT_SPEC, type ShiftSpec } from "./tabel-engine.pure";
import { USER_ROLE_TO_WD_ROLE } from "./workday-access";

function roleAliasSet(role: string | null | undefined): Set<string> {
  const raw = (role ?? "").trim().toLowerCase();
  const out = new Set<string>();
  if (!raw) return out;
  out.add(raw);
  const label = USER_ROLE_TO_WD_ROLE[raw];
  if (label) out.add(label.toLowerCase());
  for (const [key, value] of Object.entries(USER_ROLE_TO_WD_ROLE)) {
    if (value.toLowerCase() === raw) out.add(key);
  }
  return out;
}

function rolesMatch(shiftRole: string | null, userRole: string | null | undefined): boolean {
  const left = roleAliasSet(shiftRole);
  if (left.size === 0) return false;
  for (const key of roleAliasSet(userRole)) if (left.has(key)) return true;
  return false;
}

function branchAliasSet(raw: string | null | undefined, catalog: BranchDto[]): Set<string> {
  const t = (raw ?? "").trim();
  if (!t) return new Set();
  return new Set(
    expandBranchFilterKeys([t], catalog)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

function branchesMatch(shiftBranch: string | null, userBranch: string | null | undefined, catalog: BranchDto[]): boolean {
  const left = branchAliasSet(shiftBranch, catalog);
  if (left.size === 0) return false;
  for (const key of branchAliasSet(userBranch, catalog)) if (left.has(key)) return true;
  return false;
}

export async function resolveUserShift(
  tenantId: number,
  role: string | null | undefined,
  branch: string | null | undefined
): Promise<ShiftSpec & { id?: number; name: string }> {
  const [shifts, catalog] = await Promise.all([
    prisma.attendanceShift.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ is_default: "desc" }, { id: "asc" }]
    }),
    loadBranchLabelSources(tenantId)
  ]);
  const exact = shifts.find((s) => rolesMatch(s.role, role) && branchesMatch(s.branch, branch, catalog));
  const byRole = shifts.find((s) => rolesMatch(s.role, role) && !s.branch);
  const byBranch = shifts.find((s) => !s.role && branchesMatch(s.branch, branch, catalog));
  const hit = exact ?? byRole ?? byBranch ?? shifts.find((s) => s.is_default) ?? shifts[0];
  if (!hit) return { ...DEFAULT_SHIFT_SPEC, name: "Стандартная смена (09:00–18:00)" };
  return {
    id: hit.id,
    name: hit.name,
    start_time: hit.start_time,
    end_time: hit.end_time,
    break_minutes: hit.break_minutes,
    grace_minutes: hit.grace_minutes
  };
}
