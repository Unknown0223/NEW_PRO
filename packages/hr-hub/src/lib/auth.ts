import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

export type SessionUser = {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: User["role"];
  employeeId: string | null;
};

const COOKIE = "hr_hub_session";

function secretKey() {
  const s = process.env.AUTH_SECRET ?? "hr-hub-dev-secret-change-in-production-32chars";
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    employeeId: user.employeeId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.id !== "string" ||
      typeof payload.orgId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return {
      id: payload.id,
      orgId: payload.orgId,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role as SessionUser["role"],
      employeeId: typeof payload.employeeId === "string" ? payload.employeeId : null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function requireRole(user: SessionUser, roles: SessionUser["role"][]) {
  return roles.includes(user.role);
}

export async function findUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function getUserById(id: string, orgId: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export function auditHash(prev: string | null, payload: string): string {
  return createHash("sha256").update(`${prev ?? "genesis"}:${payload}`).digest("hex");
}

export { COOKIE as SESSION_COOKIE };
