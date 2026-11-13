import { prisma } from "../../config/database";

export type AccessSidRow = {
  user_id: number;
  revoked_at: Date | null;
  expires_at: Date;
  family_id: string | null;
};

/** Pure: refresh rotation sibling bilan. */
export function decideAccessSidActive(
  sess: AccessSidRow | null,
  userId: number,
  now: Date,
  hasActiveSibling: boolean
): boolean {
  if (!sess || sess.user_id !== userId) return false;
  if (sess.revoked_at == null && sess.expires_at > now) return true;
  return Boolean(sess.family_id) && hasActiveSibling;
}

/**
 * Access JWT dagi `sid` (= refresh_tokens.id) hali yaroqlimi.
 * Refresh rotation eski qatorni revoke qiladi — oilada yangi aktiv token
 * bo‘lsa, access muddati tugaguncha so‘rovni SESSION_REVOKED qilmaslik kerak.
 * Logout / boshqa qurilma oilani butunlay revoke qilsa — false.
 */
export async function isAccessSidActive(
  userId: number,
  sid: number,
  now: Date = new Date()
): Promise<boolean> {
  if (!Number.isInteger(sid) || sid < 1) return false;
  const sess = await prisma.refreshToken.findUnique({
    where: { id: sid },
    select: { user_id: true, revoked_at: true, expires_at: true, family_id: true }
  });
  let hasActiveSibling = false;
  if (sess?.family_id && (sess.revoked_at != null || sess.expires_at <= now)) {
    const sibling = await prisma.refreshToken.findFirst({
      where: {
        family_id: sess.family_id,
        user_id: userId,
        revoked_at: null,
        expires_at: { gt: now }
      },
      select: { id: true }
    });
    hasActiveSibling = Boolean(sibling);
  }
  return decideAccessSidActive(sess, userId, now, hasActiveSibling);
}
