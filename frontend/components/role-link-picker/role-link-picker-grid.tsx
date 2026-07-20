"use client";

export type RolePickerUser = { id: number; name: string; login: string };

export type RolePickerColumn = { role: string; label: string; pool: string };

export function emptySetsForRoles(roleOrder: string[]): Record<string, Set<number>> {
  const o: Record<string, Set<number>> = {};
  for (const r of roleOrder) o[r] = new Set();
  return o;
}

export function cloneRoleSets(
  roleOrder: string[],
  src: Record<string, Set<number>>
): Record<string, Set<number>> {
  const o = emptySetsForRoles(roleOrder);
  for (const r of roleOrder) {
    o[r] = new Set(src[r] ?? []);
  }
  return o;
}

export function toggleUserOneRoleColumn(
  roleOrder: string[],
  sets: Record<string, Set<number>>,
  role: string,
  userId: number,
  on: boolean
): Record<string, Set<number>> {
  const next = cloneRoleSets(roleOrder, sets);
  if (on) {
    for (const r of roleOrder) {
      if (r !== role) next[r].delete(userId);
    }
    next[role].add(userId);
  } else {
    next[role].delete(userId);
  }
  return next;
}

export function setsFromRoleLinks(
  roleOrder: string[],
  links: { link_role: string; user_id: number }[]
): Record<string, Set<number>> {
  const m = emptySetsForRoles(roleOrder);
  for (const l of links) {
    if (m[l.link_role]) m[l.link_role].add(l.user_id);
  }
  return m;
}

export function linksFromRoleSets(
  roleOrder: string[],
  sets: Record<string, Set<number>>
): { user_id: number; link_role: string }[] {
  const out: { user_id: number; link_role: string }[] = [];
  for (const role of roleOrder) {
    sets[role]?.forEach((uid) => out.push({ user_id: uid, link_role: role }));
  }
  return out;
}
