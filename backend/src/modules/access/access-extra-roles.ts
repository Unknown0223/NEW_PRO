import { TENANT_ADMIN_ROLE } from "../../lib/tenant-user-roles";

/**
 * Asosiy `users.role` + qo‘shimcha rol paketlari (`user_roles`).
 * Extra `admin` faqat asosiy rol ham admin bo‘lsa qabul qilinadi —
 * aks holda kassir/agent ga to‘liq admin operatsiyalari yopishib qoladi.
 */
export function composeLinkedRoleKeys(primary: string, extras: readonly string[]): string[] {
  const p = primary.trim();
  const seen = new Set<string>();
  const out: string[] = [];
  if (p) {
    seen.add(p);
    out.push(p);
  }
  for (const raw of extras) {
    const k = String(raw ?? "").trim();
    if (!k || seen.has(k)) continue;
    if (k === TENANT_ADMIN_ROLE && p !== TENANT_ADMIN_ROLE) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** `user_roles` dan asosiy profil kalitini olib tashlab, qo‘shimcha paketlarni qaytaradi. */
export function extraRoleKeysFromLinks(primary: string, linkedKeys: readonly string[]): string[] {
  const p = primary.trim();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of linkedKeys) {
    const k = String(raw ?? "").trim();
    if (!k || k === p || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
