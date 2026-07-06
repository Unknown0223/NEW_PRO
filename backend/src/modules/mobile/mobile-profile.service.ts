import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";

const AVATAR_MAX_LEN = 180_000;

type UiPrefs = Record<string, unknown>;

function readUiPrefs(raw: unknown): UiPrefs {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as UiPrefs) };
  }
  return {};
}

function str(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function getMobileMeProfile(tenantId: number, userId: number) {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: {
      id: true,
      name: true,
      code: true,
      login: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      phone: true,
      ui_preferences: true
    }
  });
  if (!u) throw new Error("NOT_FOUND");
  const prefs = readUiPrefs(u.ui_preferences);
  const avatarBase64 =
    typeof prefs.profile_avatar_b64 === "string" && prefs.profile_avatar_b64.length > 0
      ? prefs.profile_avatar_b64
      : null;
  return {
    id: u.id,
    name: toFio(u),
    code: u.code,
    login: u.login,
    first_name: u.first_name,
    last_name: u.last_name,
    phone: u.phone,
    avatar_base64: avatarBase64
  };
}

export async function patchMobileMeProfile(
  tenantId: number,
  userId: number,
  input: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    avatar_base64?: string | null;
  }
) {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { id: true, ui_preferences: true }
  });
  if (!u) throw new Error("NOT_FOUND");

  const data: Prisma.UserUpdateInput = {};
  if (input.first_name !== undefined) data.first_name = str(input.first_name, 128);
  if (input.last_name !== undefined) data.last_name = str(input.last_name, 128);
  if (input.phone !== undefined) data.phone = str(input.phone, 32);

  if (input.first_name !== undefined || input.last_name !== undefined) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true, name: true }
    });
    const first = input.first_name !== undefined ? str(input.first_name, 128) : current?.first_name;
    const last = input.last_name !== undefined ? str(input.last_name, 128) : current?.last_name;
    const combined = [first, last].filter(Boolean).join(" ").trim();
    if (combined.length >= 1) data.name = combined.slice(0, 255);
  }

  if (input.avatar_base64 !== undefined) {
    const prefs = readUiPrefs(u.ui_preferences);
    if (input.avatar_base64 == null || input.avatar_base64.trim() === "") {
      delete prefs.profile_avatar_b64;
    } else {
      const b64 = input.avatar_base64.trim();
      if (b64.length > AVATAR_MAX_LEN) throw new Error("AVATAR_TOO_LARGE");
      prefs.profile_avatar_b64 = b64;
    }
    data.ui_preferences = prefs as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) throw new Error("VALIDATION");

  await prisma.user.update({ where: { id: userId }, data });
  return getMobileMeProfile(tenantId, userId);
}

export async function changeMobileMePassword(
  tenantId: number,
  userId: number,
  input: { old_password: string; new_password: string }
) {
  const oldPw = input.old_password?.trim() ?? "";
  const newPw = input.new_password?.trim() ?? "";
  if (oldPw.length < 1 || newPw.length < 6) throw new Error("VALIDATION");

  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { password_hash: true }
  });
  if (!u) throw new Error("NOT_FOUND");

  const ok = await bcrypt.compare(oldPw, u.password_hash);
  if (!ok) throw new Error("INVALID_OLD_PASSWORD");

  const password_hash = await bcrypt.hash(newPw, 10);
  await prisma.user.update({ where: { id: userId }, data: { password_hash } });
  return { ok: true as const };
}
