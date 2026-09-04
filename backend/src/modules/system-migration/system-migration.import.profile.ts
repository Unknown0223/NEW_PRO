import type { BranchDto, TenantProfileDto } from "../tenant-settings/tenant-settings.types";
import { prisma } from "../../config/database";

/**
 * Backup profil patch.
 * Filial cash_desk_id(lar)i hozircha olib tashlanadi — ular eski tenant ID;
 * kassalar importidan keyin `remapBranchIdsInTenantSettings` qayta bog‘laydi.
 * Aks holda assertBranchCashDeskAssignments → INVALID_BRANCH_CASH_DESK.
 */
export function profilePatchFromBackup(profile: TenantProfileDto) {
  const references = profile.references
    ? {
        ...profile.references,
        branches: Array.isArray(profile.references.branches)
          ? profile.references.branches.map((b: BranchDto) => {
              const { cash_desk_id: _c, cash_desk_ids: _cs, ...rest } = b as BranchDto & {
                cash_desk_id?: unknown;
                cash_desk_ids?: unknown;
              };
              return { ...rest, cash_desk_id: null, cash_desk_ids: [] } as BranchDto;
            })
          : profile.references.branches
      }
    : profile.references;

  return {
    name: profile.name,
    phone: profile.phone,
    address: profile.address,
    logo_url: profile.logo_url,
    feature_flags: profile.feature_flags,
    return_filter: profile.return_filter,
    references
  };
}

function countTerritoryRoots(refs: TenantProfileDto["references"] | undefined): number {
  const nodes = refs?.territory_nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

/** Bo‘sh/zaif profil backup orqali jonli spravochnikni o‘chirmasin. */
export async function assertBackupProfileNotThin(
  targetTenantId: number,
  profile: TenantProfileDto
): Promise<void> {
  const row = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: { settings: true }
  });
  const prevRef =
    row?.settings != null && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? ((row.settings as Record<string, unknown>).references as Record<string, unknown> | undefined)
      : undefined;
  const nextRef = (profile.references ?? {}) as Record<string, unknown>;

  const prevNodes = prevRef?.territory_nodes;
  const prevLen = Array.isArray(prevNodes) ? prevNodes.length : 0;
  const nextLen = countTerritoryRoots(profile.references);
  if (prevLen > 0 && nextLen === 0) {
    throw new Error(
      "THIN_PROFILE_BACKUP:Backup dagi territory_nodes bo‘sh — mavjud territoriya o‘chib ketmasin. force yoki to‘liq backup kerak."
    );
  }

  const catalogKeys = [
    "unit_measures",
    "branches",
    "currency_entries",
    "payment_method_entries",
    "price_type_entries",
    "client_format_entries",
    "client_type_entries",
    "client_category_entries",
    "payment_types",
    "regions"
  ] as const;
  for (const key of catalogKeys) {
    const prev = prevRef?.[key];
    const next = nextRef[key];
    const prevN = Array.isArray(prev) ? prev.length : 0;
    const nextN = Array.isArray(next) ? next.length : 0;
    if (prevN > 0 && nextN === 0) {
      throw new Error(
        `THIN_PROFILE_BACKUP:Backup dagi ${key} bo‘sh — mavjud spravochnik o‘chib ketmasin. force yoki to‘liq backup kerak.`
      );
    }
  }
}
