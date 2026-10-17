/** Mobil yangilanish kimga chiqadi. Versiya raqamiga tegmaydi. */
export const MOBILE_RELEASE_ROLES = ["agent", "expeditor", "supervisor"] as const;

export type MobileReleaseRole = (typeof MOBILE_RELEASE_ROLES)[number];

function isReleaseRole(value: string): value is MobileReleaseRole {
  return (MOBILE_RELEASE_ROLES as readonly string[]).includes(value);
}

/**
 * `null` — maydon yo‘q: hamma mobil rol (eski siyosat).
 * Bo‘sh massiv — hech kimga chiqmaydi.
 */
export function normalizeTargetRoles(raw: unknown): MobileReleaseRole[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: MobileReleaseRole[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const role = item.trim().toLowerCase();
    if (!isReleaseRole(role) || out.includes(role)) continue;
    out.push(role);
  }
  return out;
}

export function roleReceivesAppUpdate(
  targetRoles: MobileReleaseRole[] | null | undefined,
  role: string | null | undefined
): boolean {
  if (targetRoles == null) return true;
  if (!role) return false;
  return targetRoles.includes(role as MobileReleaseRole);
}

/** Rol berilmagan ochiq so‘rov: faqat hamma rol tanlangan bo‘lsa oyna chiqadi. */
export function anonymousReleaseVisible(targetRoles: MobileReleaseRole[] | null | undefined): boolean {
  if (targetRoles == null) return true;
  return MOBILE_RELEASE_ROLES.every((role) => targetRoles.includes(role));
}

export function applyReleaseRoleGate<T extends { required: boolean; optional: boolean }>(
  block: T,
  targetRoles: MobileReleaseRole[] | null | undefined,
  role?: string | null
): T {
  const visible = role
    ? roleReceivesAppUpdate(targetRoles, role)
    : anonymousReleaseVisible(targetRoles);
  if (visible || (!block.required && !block.optional)) return block;
  return { ...block, required: false, optional: false };
}
