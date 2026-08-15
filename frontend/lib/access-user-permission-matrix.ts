/** Matritsa «Операции» — faqat foydalanuvchi ishlata oladigan huquqlar va manba (rol / qo‘shimcha). */

export type AccessMatrixRowLike = {
  key?: string;
  from_role: boolean;
  user_effect: "none" | "allow" | "deny";
  effective: boolean;
};

export type PermissionSourceFilter = "all" | "role" | "extra";

export function isGrantedMatrixRow(row: AccessMatrixRowLike): boolean {
  const key = (row.key ?? "").trim();
  if (key.startsWith("access.grant.")) return false;
  if (key.includes("access.grant.access.grant.")) return false;
  return row.effective;
}

export function permissionSourceLabel(row: AccessMatrixRowLike): "Роль" | "Дополнительно" {
  return row.user_effect === "allow" ? "Дополнительно" : "Роль";
}

export function matchesPermissionSourceFilter(row: AccessMatrixRowLike, filter: PermissionSourceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "extra") return row.user_effect === "allow";
  return row.from_role && row.user_effect !== "allow";
}

export function isMatrixRowBulkSelectable(row: AccessMatrixRowLike): boolean {
  return row.effective;
}

/**
 * Снять эффективный доступ у пользователя.
 * Важно: личный allow поверх роли нельзя «открепить» remove — иначе роль снова даёт доступ,
 * а UI мог скрыть строку через suppress. Для from_role всегда явный deny.
 */
export function buildRevokeEffectiveAccessPatch(row: AccessMatrixRowLike): Record<string, unknown> | null {
  const key = (row.key ?? "").trim();
  if (!key || !row.effective) return null;
  if (row.from_role) {
    return { merge_permissions: true, denied_permissions: [key] };
  }
  if (row.user_effect === "allow") {
    return { remove_permission_keys: [key] };
  }
  return null;
}

/** Подпись кнопки: роль (в т.ч. allow поверх роли) → «Снять»; только личный allow → «Открепить». */
export function revokeEffectiveAccessButtonLabel(row: AccessMatrixRowLike): "Снять" | "Открепить" {
  if (row.from_role) return "Снять";
  return "Открепить";
}
