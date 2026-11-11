import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import {
  decideLoginLockout,
  nextLockedUntilMs,
  resetLockoutFields
} from "./login-lockout.pure";

/**
 * Precomputed bcrypt (cost 10) of a fixed dummy string — user yo‘q / nofaol
 * bo‘lsa ham compare vaqti taxminan bir xil bo‘lsin.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$10$gWAJiJrSuz7rUcHack3ANelciMoDmGIzoA6/r29HhreGMpW2pLrBW";

type LoginUserRow = {
  id: number;
  is_active: boolean;
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
  must_change_password: boolean;
};

export async function assertNotLocked(user: LoginUserRow | null): Promise<void> {
  if (!user?.is_active) return;
  const decision = decideLoginLockout({
    nowMs: Date.now(),
    lockedUntilMs: user.locked_until ? user.locked_until.getTime() : null
  });
  if (decision.action === "reject_locked") {
    throw new Error("ACCOUNT_LOCKED");
  }
}

export async function verifyLoginPassword(
  user: LoginUserRow | null,
  password: string
): Promise<boolean> {
  const hash = user?.is_active ? user.password_hash : DUMMY_PASSWORD_HASH;
  return bcrypt.compare(password, hash);
}

export async function recordFailedLogin(user: LoginUserRow): Promise<void> {
  const failCount = (user.failed_login_count ?? 0) + 1;
  const untilMs = nextLockedUntilMs(failCount, Date.now());
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failed_login_count: failCount,
      locked_until: untilMs != null ? new Date(untilMs) : null
    }
  });
}

export async function clearFailedLogin(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: resetLockoutFields()
  });
}
