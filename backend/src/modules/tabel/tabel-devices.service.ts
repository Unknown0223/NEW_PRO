/**
 * Terminallar Face ID (AttendanceDevice) servisi.
 */
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getFaceReferenceKey, getFaceReferenceMeta } from "../mobile/mobile-face.reference";
import { storageReadBuffer } from "../../lib/storage.service";
import { branchMatchKey } from "../tenant-settings/branch-display.pure";
import { hashDeviceToken, isPairingExpired, pairingExpiresAt } from "./device-ingest-auth.pure";

function asMeta(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function isDeviceLinked(d: { status: string; is_confirmed: boolean }): boolean {
  return d.is_confirmed && d.status !== "pending_confirm";
}

export function toTabelDeviceDto(d: {
  id: number;
  name: string;
  vendor: string;
  serial_no: string | null;
  branch: string | null;
  pairing_code: string | null;
  pairing_expires_at?: Date | null;
  tunnel_url: string | null;
  status: string;
  is_confirmed: boolean;
  synced_faces_count: number;
  last_seen_at: Date | null;
  device_token_hash: string | null;
  meta: Prisma.JsonValue;
}) {
  const linked = isDeviceLinked(d);
  const meta = asMeta(d.meta);
  const stored = typeof meta.device_token === "string" ? meta.device_token : null;
  return {
    id: d.id,
    name: d.name,
    vendor: d.vendor,
    serial_no: d.serial_no,
    branch: d.branch,
    pairing_code: d.pairing_code,
    pairing_expires_at: d.pairing_expires_at ?? null,
    tunnel_url: d.tunnel_url,
    status: d.status,
    is_confirmed: d.is_confirmed,
    is_linked: linked,
    synced_faces_count: d.synced_faces_count,
    last_seen_at: d.last_seen_at,
    has_token: Boolean(d.device_token_hash),
    /** Admin UI / link skript — token create dan keyin ham ko‘rinadi (pending). */
    device_token: stored,
    terminal_password: typeof meta.terminal_password === "string" ? meta.terminal_password : null,
    recovery_email: typeof meta.recovery_email === "string" ? meta.recovery_email : null,
    terminal_ip: typeof meta.terminal_ip === "string" ? meta.terminal_ip : null,
    pending_confirm: d.status === "pending_confirm"
  };
}

export async function listTabelDevices(tenantId: number) {
  const rows = await prisma.attendanceDevice.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ id: "desc" }]
  });
  return rows.map(toTabelDeviceDto);
}

export async function createTabelDevice(
  tenantId: number,
  input: {
    name: string;
    vendor?: string;
    serial_no?: string | null;
    branch?: string | null;
    location_id?: number | null;
    tunnel_url?: string | null;
  }
) {
  const pairingCode = String(100000 + Math.floor(Math.random() * 900000));
  const rawToken = `dev_${randomBytes(18).toString("hex")}`;
  const tokenHash = hashDeviceToken(rawToken);
  const meta = { device_token: rawToken, token_issued_at: new Date().toISOString() };
  const device = await prisma.attendanceDevice.create({
    data: {
      tenant_id: tenantId,
      name: input.name.trim(),
      vendor: (input.vendor ?? "hikvision").trim().toLowerCase(),
      serial_no: input.serial_no?.trim() || null,
      branch: input.branch?.trim() || null,
      location_id: input.location_id ?? null,
      pairing_code: pairingCode,
      pairing_expires_at: pairingExpiresAt(),
      device_token_hash: tokenHash,
      meta,
      tunnel_url: input.tunnel_url?.trim() || null,
      status: "pending",
      is_confirmed: false
    }
  });
  return {
    device: toTabelDeviceDto(device),
    pairing_code: pairingCode,
    device_token: rawToken
  };
}

export async function requestTabelDeviceLink(
  tenantId: number,
  pairingCode: string,
  input: { terminal_password?: string; ip?: string; recovery_email?: string }
) {
  const code = pairingCode.trim();
  const device = await prisma.attendanceDevice.findFirst({
    where: { tenant_id: tenantId, pairing_code: code }
  });
  if (!device || device.status === "revoked") throw new Error("NOT_FOUND");
  if (isPairingExpired(device.pairing_expires_at)) throw new Error("PAIRING_EXPIRED");
  const password = String(input.terminal_password ?? "").trim();
  if (password.length < 8) throw new Error("PASSWORD_REQUIRED");
  const meta = {
    ...asMeta(device.meta),
    terminal_password: password,
    recovery_email: String(input.recovery_email ?? "").trim() || "botirovanvar96@gmail.com",
    terminal_ip: input.ip?.trim() || null,
    link_requested_at: new Date().toISOString()
  };
  const updated = await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { status: "pending_confirm", is_confirmed: false, last_seen_at: new Date(), meta }
  });
  return toTabelDeviceDto(updated);
}

export async function confirmTabelDeviceLink(tenantId: number, id: number) {
  const existing = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.status !== "pending_confirm") throw new Error("NOT_PENDING");
  const device = await prisma.attendanceDevice.update({
    where: { id },
    data: {
      status: "online",
      is_confirmed: true,
      last_seen_at: new Date(),
      pairing_code: null,
      pairing_expires_at: null
    }
  });
  return toTabelDeviceDto(device);
}

export async function issueTabelDeviceToken(tenantId: number, id: number) {
  const existing = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!existing) throw new Error("NOT_FOUND");
  if (!isDeviceLinked(existing)) throw new Error("DEVICE_NOT_LINKED");
  const rawToken = `dev_${randomBytes(18).toString("hex")}`;
  const tokenHash = hashDeviceToken(rawToken);
  const meta = { ...asMeta(existing.meta), device_token: rawToken, token_issued_at: new Date().toISOString() };
  const device = await prisma.attendanceDevice.update({
    where: { id },
    data: {
      device_token_hash: tokenHash,
      meta,
      pairing_code: null,
      pairing_expires_at: null
    }
  });
  return { device: toTabelDeviceDto(device), device_token: rawToken };
}

export async function updateTabelDevice(
  tenantId: number,
  id: number,
  patch: {
    name?: string;
    branch?: string | null;
    tunnel_url?: string | null;
    is_confirmed?: boolean;
    status?: string;
  }
) {
  const existing = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!existing) throw new Error("NOT_FOUND");
  return prisma.attendanceDevice.update({
    where: { id },
    data: {
      ...(patch.name ? { name: patch.name.trim() } : {}),
      ...(patch.branch !== undefined ? { branch: patch.branch?.trim() || null } : {}),
      ...(patch.tunnel_url !== undefined ? { tunnel_url: patch.tunnel_url?.trim() || null } : {}),
      ...(patch.is_confirmed !== undefined ? { is_confirmed: patch.is_confirmed } : {}),
      ...(patch.status ? { status: patch.status } : {})
    }
  });
}

export async function syncFacesToTabelDevice(tenantId: number, id: number) {
  const device = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!device) throw new Error("NOT_FOUND");

  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      ...(device.branch ? { branch: { equals: device.branch, mode: "insensitive" } } : {})
    },
    select: { id: true }
  });
  let enrolledCount = 0;
  for (const u of users) {
    const meta = await getFaceReferenceMeta(tenantId, u.id);
    if (meta.has_reference) enrolledCount += 1;
  }

  return prisma.attendanceDevice.update({
    where: { id },
    data: {
      synced_faces_count: enrolledCount,
      last_sync_at: new Date(),
      ...(device.status === "pending_confirm"
        ? {}
        : { last_seen_at: new Date(), status: device.status === "pending" ? device.status : "online" })
    }
  });
}

export async function listDeviceFaceSyncPeople(tenantId: number, id: number) {
  const device = await prisma.attendanceDevice.findFirst({ where: { id, tenant_id: tenantId } });
  if (!device) throw new Error("NOT_FOUND");
  const branchKey = device.branch ? branchMatchKey(device.branch) : "";
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, name: true, first_name: true, last_name: true, code: true, branch: true, ui_preferences: true },
    orderBy: { name: "asc" }
  });
  const matched = branchKey ? users.filter((u) => branchMatchKey(u.branch ?? "") === branchKey) : users;
  const people = matched.flatMap((u) => {
    if (!staffHasAvatar(u.ui_preferences)) return [];
    const name = [u.last_name, u.first_name].filter(Boolean).join(" ").trim() || u.name;
    return [{
      id: u.id,
      name,
      employee_no: (u.code?.trim() || String(u.id)).slice(0, 32),
      has_face: true
    }];
  });
  return {
    terminal_ip: typeof asMeta(device.meta).terminal_ip === "string" ? asMeta(device.meta).terminal_ip : null,
    people
  };
}

function staffHasAvatar(prefs: unknown): boolean {
  const bag = prefs != null && typeof prefs === "object" && !Array.isArray(prefs) ? (prefs as Record<string, unknown>) : {};
  const avatar = typeof bag.profile_avatar_b64 === "string" ? bag.profile_avatar_b64.trim() : "";
  if (avatar.length > 32) return true;
  const key = bag.face_reference_storage_key;
  return typeof key === "string" && key.length > 0;
}

async function readStaffPhoto(tenantId: number, userId: number): Promise<Buffer | null> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { ui_preferences: true }
  });
  if (!u) return null;
  const prefs = u.ui_preferences;
  const bag = prefs != null && typeof prefs === "object" && !Array.isArray(prefs) ? (prefs as Record<string, unknown>) : {};
  const avatar = typeof bag.profile_avatar_b64 === "string" ? bag.profile_avatar_b64.trim() : "";
  if (avatar) {
    const raw = avatar.includes(",") ? avatar.slice(avatar.indexOf(",") + 1) : avatar;
    const buf = Buffer.from(raw, "base64");
    if (buf.length > 32) return buf;
  }
  const key = await getFaceReferenceKey(tenantId, userId);
  if (!key) return null;
  return storageReadBuffer(key);
}

export async function readDeviceFaceSyncImage(tenantId: number, deviceId: number, userId: number) {
  const device = await prisma.attendanceDevice.findFirst({ where: { id: deviceId, tenant_id: tenantId } });
  const user = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { branch: true, ui_preferences: true }
  });
  if (!device || !user || !staffHasAvatar(user.ui_preferences)) throw new Error("NOT_FOUND");
  const branchKey = device.branch ? branchMatchKey(device.branch) : "";
  if (branchKey && branchMatchKey(user.branch ?? "") !== branchKey) throw new Error("NOT_FOUND");
  const buf = await readStaffPhoto(tenantId, userId);
  if (!buf) throw new Error("NOT_FOUND");
  return { image_base64: buf.toString("base64") };
}

export async function deleteTabelDevice(tenantId: number, id: number) {
  await prisma.attendanceDevice.deleteMany({ where: { id, tenant_id: tenantId } });
  return { ok: true };
}
