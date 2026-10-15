import { Readable } from "stream";
import { prisma } from "../../config/database";
import { compressClientPhotoForStore, decodeBase64Photo } from "../../lib/client-photo-storage";
import { invalidateClientDetailCache } from "../../lib/redis-cache";
import { storageDelete, storagePut, storageReadBuffer } from "../../lib/storage.service";
import { profilePhotoMobileUrl } from "./client-profile-photo.pure";

const slugMemo = new Map<number, string>();

export async function tenantSlug(tenantId: number): Promise<string> {
  const cached = slugMemo.get(tenantId);
  if (cached) return cached;
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true }
  });
  const slug = row?.slug?.trim() ?? "";
  if (slug) slugMemo.set(tenantId, slug);
  return slug;
}

export async function profilePhotoUrlsByClient(
  tenantId: number,
  clientIds: number[]
): Promise<Map<number, string>> {
  const ids = [...new Set(clientIds.filter((id) => Number.isInteger(id) && id > 0))];
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const slug = await tenantSlug(tenantId);
  if (!slug) return out;
  const rows = await prisma.client.findMany({
    where: { tenant_id: tenantId, id: { in: ids }, profile_photo_url: { not: null } },
    select: { id: true, profile_photo_url: true, updated_at: true }
  });
  for (const row of rows) {
    const url = profilePhotoMobileUrl(row.profile_photo_url, slug, row.id, row.updated_at);
    if (url) out.set(row.id, url);
  }
  return out;
}

async function activeClient(tenantId: number, clientId: number) {
  return prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true, profile_photo_url: true }
  });
}

/** Eski rasm o‘rniga bitta yangi rasm. Ikkinchi rasm saqlanmaydi. */
export async function setClientProfilePhoto(tenantId: number, clientId: number, imageInput: string) {
  const client = await activeClient(tenantId, clientId);
  if (!client) throw new Error("NOT_FOUND");

  const decoded = decodeBase64Photo(imageInput);
  let stored: string;
  if (decoded) {
    if (!decoded.buffer.length) throw new Error("BAD_IMAGE");
    const compressed = await compressClientPhotoForStore(decoded.buffer);
    const saved = await storagePut(
      `client-profile/${tenantId}/${clientId}`,
      "photo.jpg",
      Readable.from(compressed),
      "image/jpeg",
      compressed.length + 1
    );
    stored = saved.url ?? saved.key;
  } else if (/^https?:\/\//i.test(imageInput.trim()) && imageInput.trim().length <= 2048) {
    stored = imageInput.trim();
  } else {
    throw new Error("BAD_IMAGE");
  }

  const previous = client.profile_photo_url?.trim() ?? "";
  await prisma.client.update({
    where: { id: clientId },
    data: { profile_photo_url: stored, updated_at: new Date() }
  });
  if (previous && previous !== stored && !/^https?:\/\//i.test(previous) && !previous.startsWith("data:")) {
    await storageDelete(previous).catch(() => undefined);
  }
  await invalidateClientDetailCache(tenantId, clientId);
  return { has_profile_photo: true };
}

export async function clearClientProfilePhoto(tenantId: number, clientId: number) {
  const client = await activeClient(tenantId, clientId);
  if (!client) throw new Error("NOT_FOUND");
  const previous = client.profile_photo_url?.trim() ?? "";
  await prisma.client.update({
    where: { id: clientId },
    data: { profile_photo_url: null, updated_at: new Date() }
  });
  if (previous && !/^https?:\/\//i.test(previous) && !previous.startsWith("data:")) {
    await storageDelete(previous).catch(() => undefined);
  }
  await invalidateClientDetailCache(tenantId, clientId);
  return { has_profile_photo: false };
}

export async function readClientProfilePhoto(
  tenantId: number,
  clientId: number
): Promise<{ buffer: Buffer; contentType: string } | { redirect: string } | null> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: { profile_photo_url: true }
  });
  const stored = client?.profile_photo_url?.trim() ?? "";
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return { redirect: stored };
  const buffer = await storageReadBuffer(stored);
  if (!buffer?.length) return null;
  return { buffer, contentType: "image/jpeg" };
}
