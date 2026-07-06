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
