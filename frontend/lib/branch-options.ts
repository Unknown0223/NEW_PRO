/** Faqat «Настройки → Филиалы» dagi faol filiallar. */
export type BranchRefRow = { name: string; active?: boolean };

export function activeBranchNamesFromProfile(
  branches: BranchRefRow[] | null | undefined
): string[] {
  return (branches ?? [])
    .filter((b) => b.active !== false)
    .map((b) => b.name.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));
}
