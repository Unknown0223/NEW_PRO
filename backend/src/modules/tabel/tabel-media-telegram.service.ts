/**
 * Davomat rasm/videolarini siqish (720px / JPEG 62%), saqlash,
 * Telegram guruh/kanalga yuborish hamda muddati o'tgan fayllarni tozalash (Retention).
 */
import { Readable } from "stream";
import { prisma } from "../../config/database";
import { storageDelete, storagePut } from "../../lib/storage.service";
import { deleteFaceReference, getFaceReferenceKey } from "../mobile/mobile-face.reference";
import {
  normalizeFullTabelSettings,
  retentionToDays,
  type TelegramAttendanceSettings
} from "./tabel-settings.pure";

export type CompressPhotoOpts = {
  enabled: boolean;
  maxEdge: number;
  quality: number;
};

export async function compressPunchPhotoJpeg(
  input: Buffer,
  opts: Partial<CompressPhotoOpts> = {}
): Promise<{ buffer: Buffer; compressed: boolean; bytesIn: number; bytesOut: number }> {
  const enabled = opts.enabled !== false;
  const maxEdge = Math.max(240, Math.min(1920, opts.maxEdge ?? 720));
  const quality = Math.max(30, Math.min(95, opts.quality ?? 62));
  const bytesIn = input.length;
  if (!enabled || bytesIn < 100) {
    return { buffer: input, compressed: false, bytesIn, bytesOut: bytesIn };
  }
  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    const out = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
    if (out.length > 0 && (out.length < bytesIn || bytesIn > 80_000)) {
      return { buffer: out, compressed: true, bytesIn, bytesOut: out.length };
    }
    return { buffer: out.length > 0 ? out : input, compressed: out.length > 0, bytesIn, bytesOut: out.length || bytesIn };
  } catch {
    return { buffer: input, compressed: false, bytesIn, bytesOut: bytesIn };
  }
}

export function decodeBase64Media(raw: string): Buffer {
  const idx = raw.indexOf("base64,");
  const clean = (idx >= 0 ? raw.slice(idx + 7) : raw).replace(/\s+/g, "");
  return Buffer.from(clean, "base64");
}

export async function saveCompressedPunchPhoto(
  tenantId: number,
  userId: number,
  side: "front" | "back",
  base64OrBuf: string | Buffer,
  compressOpts: Partial<CompressPhotoOpts> = {}
): Promise<{ key: string; bytes: number }> {
  const rawBuf = typeof base64OrBuf === "string" ? decodeBase64Media(base64OrBuf) : base64OrBuf;
  const { buffer } = await compressPunchPhotoJpeg(rawBuf, compressOpts);
  const filename = `${Date.now()}-${side}.jpg`;
  const res = await storagePut(
    `attendance-photos/t${tenantId}/u${userId}`,
    filename,
    Readable.from(buffer),
    "image/jpeg",
    10 * 1024 * 1024
  );
  return { key: res.key, bytes: res.bytes };
}

export async function savePunchVideo(
  tenantId: number,
  userId: number,
  side: "front" | "back",
  base64OrBuf: string | Buffer
): Promise<{ key: string; bytes: number }> {
  const buf = typeof base64OrBuf === "string" ? decodeBase64Media(base64OrBuf) : base64OrBuf;
  const filename = `${Date.now()}-${side}.mp4`;
  const res = await storagePut(
    `attendance-videos/t${tenantId}/u${userId}`,
    filename,
    Readable.from(buf),
    "video/mp4",
    20 * 1024 * 1024
  );
  return { key: res.key, bytes: res.bytes };
}

export async function sendAttendanceTelegramReport(
  tg: TelegramAttendanceSettings,
  payload: {
    branch?: string | null;
    employeeName: string;
    role: string;
    direction: "IN" | "OUT";
    source: string;
    dayCode?: number | null;
    captureMode?: string | null;
    locationName?: string | null;
    outsideGeofence?: boolean;
    comment?: string | null;
    fraudAlert?: string | null;
    photoFrontBuf?: Buffer | null;
    videoFrontBuf?: Buffer | null;
    videoBackBuf?: Buffer | null;
  }
): Promise<{ sent: boolean; chatId: string | null }> {
  const token = (tg.botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const branchKey = (payload.branch ?? "").trim();
  const chatId = (branchKey && tg.branchChatIds[branchKey]) || tg.defaultChatId || "";
  if (!tg.enabled || !token || !chatId) {
    return { sent: false, chatId: chatId || null };
  }

  const lines = [
    payload.fraudAlert ? `⚠️ АНТИ-ФРОД: ${payload.fraudAlert}` : `✅ Отметка посещаемости`,
    `👤 ${payload.employeeName} (${payload.role})`,
    `🕒 ${payload.direction === "IN" ? "Приход" : "Уход"} · ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })}`,
    payload.branch ? `🏢 Филиал: ${payload.branch}` : "",
    payload.locationName ? `📍 Локация: ${payload.locationName}${payload.outsideGeofence ? " (вне гео-зоны)" : ""}` : "",
    payload.dayCode ? `🔢 3-значный код: ${payload.dayCode}` : "",
    payload.captureMode ? `🎥 Камера: ${payload.captureMode === "simultaneous" ? "одновременно" : "последовательно"}` : "",
    payload.comment ? `💬 Комментарий: ${payload.comment}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const apiBase = `https://api.telegram.org/bot${token}`;
  try {
    if (payload.videoFrontBuf && tg.sendVideos) {
      const fd = new FormData();
      fd.append("chat_id", chatId);
      fd.append("caption", lines);
      fd.append("video", new Blob([new Uint8Array(payload.videoFrontBuf)], { type: "video/mp4" }), "front.mp4");
      await fetch(`${apiBase}/sendVideo`, { method: "POST", body: fd });
      if (payload.videoBackBuf) {
        const fdBack = new FormData();
        fdBack.append("chat_id", chatId);
        fdBack.append("caption", `${payload.employeeName} — задняя камера`);
        fdBack.append("video", new Blob([new Uint8Array(payload.videoBackBuf)], { type: "video/mp4" }), "back.mp4");
        await fetch(`${apiBase}/sendVideo`, { method: "POST", body: fdBack });
      }
      return { sent: true, chatId };
    }
    if (payload.photoFrontBuf && tg.sendPhotos) {
      const fd = new FormData();
      fd.append("chat_id", chatId);
      fd.append("caption", lines);
      fd.append("photo", new Blob([new Uint8Array(payload.photoFrontBuf)], { type: "image/jpeg" }), "front.jpg");
      await fetch(`${apiBase}/sendPhoto`, { method: "POST", body: fd });
      return { sent: true, chatId };
    }
    await fetch(`${apiBase}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines })
    });
    return { sent: true, chatId };
  } catch {
    return { sent: false, chatId };
  }
}

export async function purgeTabelMediaAndFaces(targetTenantId?: number): Promise<{
  tenants: number;
  photosPurged: number;
  videosPurged: number;
  facesPurged: number;
}> {
  const tenants = await prisma.tenant.findMany({
    where: targetTenantId ? { id: targetTenantId } : { is_active: true },
    select: { id: true, settings: true }
  });
  let photosPurged = 0;
  let videosPurged = 0;
  let facesPurged = 0;
  const nowMs = Date.now();

  for (const t of tenants) {
    const root = t.settings && typeof t.settings === "object" && !Array.isArray(t.settings) ? (t.settings as Record<string, unknown>) : {};
    const cfg = normalizeFullTabelSettings(root.tabel_settings);
    const ret = cfg.retention;

    const mediaWhere = {
      tenant_id: t.id,
      OR: [
        { NOT: { photo_front_key: null } },
        { NOT: { photo_back_key: null } },
        { NOT: { video_front_key: null } },
        { NOT: { video_back_key: null } }
      ]
    };
    const pageSize = 500;
    let cursorId: number | undefined;
    for (;;) {
      const punches = await prisma.attendancePunch.findMany({
        where: mediaWhere,
        select: {
          id: true,
          role_in_day: true,
          occurred_at: true,
          photo_front_key: true,
          photo_back_key: true,
          video_front_key: true,
          video_back_key: true
        },
        orderBy: { id: "asc" },
        take: pageSize,
        ...(cursorId != null ? { cursor: { id: cursorId }, skip: 1 } : {})
      });
      if (punches.length === 0) break;

      for (const p of punches) {
        const ageDays = (nowMs - p.occurred_at.getTime()) / (24 * 60 * 60 * 1000);
        const rolePolicy =
          p.role_in_day === "out" ? ret.out : p.role_in_day === "estimated_out" ? ret.estimated_out : ret.in;
        const photoMaxDays = retentionToDays(rolePolicy.retentionValue, rolePolicy.retentionUnit);
        const purgePhoto = !rolePolicy.enabled || (photoMaxDays > 0 && ageDays >= photoMaxDays);
        const purgeVideo = ret.videoDays > 0 && ageDays >= ret.videoDays;

        let touched = false;
        if (purgePhoto && (p.photo_front_key || p.photo_back_key)) {
          if (p.photo_front_key) await storageDelete(p.photo_front_key).catch(() => {});
          if (p.photo_back_key) await storageDelete(p.photo_back_key).catch(() => {});
          photosPurged += 1;
          touched = true;
        }
        if (purgeVideo && (p.video_front_key || p.video_back_key)) {
          if (p.video_front_key) await storageDelete(p.video_front_key).catch(() => {});
          if (p.video_back_key) await storageDelete(p.video_back_key).catch(() => {});
          videosPurged += 1;
          touched = true;
        }
        if (touched) {
          const nextFrontPhoto = purgePhoto ? null : p.photo_front_key;
          const nextBackPhoto = purgePhoto ? null : p.photo_back_key;
          const nextFrontVideo = purgeVideo ? null : p.video_front_key;
          const nextBackVideo = purgeVideo ? null : p.video_back_key;
          const allCleared = !nextFrontPhoto && !nextBackPhoto && !nextFrontVideo && !nextBackVideo;
          await prisma.attendancePunch.update({
            where: { id: p.id },
            data: {
              photo_front_key: nextFrontPhoto,
              photo_back_key: nextBackPhoto,
              video_front_key: nextFrontVideo,
              video_back_key: nextBackVideo,
              ...(allCleared ? { media_purged_at: new Date() } : {})
            }
          });
        }
      }
      cursorId = punches[punches.length - 1]!.id;
      if (punches.length < pageSize) break;
    }

    if (ret.dismissedFacePurgeDays > 0) {
      const cutoff = new Date(nowMs - ret.dismissedFacePurgeDays * 24 * 60 * 60 * 1000);
      const dismissed = await prisma.user.findMany({
        where: { tenant_id: t.id, is_active: false, dismissed_at: { lte: cutoff } },
        select: { id: true }
      });
      for (const u of dismissed) {
        const key = await getFaceReferenceKey(t.id, u.id);
        if (key) {
          await deleteFaceReference(t.id, u.id).catch(() => {});
          facesPurged += 1;
        }
      }
    }
  }

  return { tenants: tenants.length, photosPurged, videosPurged, facesPurged };
}
