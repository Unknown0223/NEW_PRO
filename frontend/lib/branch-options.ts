/** Faqat «Настройки → Филиалы» dagi faol filiallar. */
export type BranchRefRow = { name: string; active?: boolean; is_active?: boolean };

function branchIsActive(b: BranchRefRow): boolean {
  const flag = b.active ?? b.is_active;
  return flag !== false;
}

export function activeBranchNamesFromProfile(
  branches: BranchRefRow[] | null | undefined
): string[] {
  return (branches ?? [])
    .filter((b) => branchIsActive(b))
    .map((b) => b.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));
}
