import type { Prisma } from "@prisma/client";

import { prisma } from "../../config/database";
import { invalidateTenantSettingsCache } from "../../lib/redis-cache";

import { asRecord } from "./tenant-settings.shared";

/** `tenant.settings` JSON ustida parallel yozuvlar bir-birini ustiga yozmasligi uchun qator qulfi. */
export async function withLockedTenantSettings(
  tenantId: number,
  mutate: (settings: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ settings: Prisma.JsonValue }>>`
      SELECT settings FROM tenants WHERE id = ${tenantId} FOR UPDATE
    `;
    const locked = rows[0];
    if (!locked) throw new Error("NOT_FOUND");
    const current = asRecord(locked.settings);
    const next = mutate(current);
    await tx.tenant.update({
      where: { id: tenantId },
      data: { settings: next as Prisma.InputJsonValue }
    });
  });
  await invalidateTenantSettingsCache(tenantId);
}

export async function updateTenantSettingsAtomic(
  tenantId: number,
  data: Prisma.TenantUpdateInput
): Promise<void> {
  const touchesSettings = data.settings !== undefined;
  if (!touchesSettings) {
    await prisma.tenant.update({ where: { id: tenantId }, data });
    return;
  }

  const scalarData = { ...data };
  delete (scalarData as { settings?: unknown }).settings;

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        settings: Prisma.JsonValue;
        name: string;
        phone: string | null;
        address: string | null;
        logo_url: string | null;
      }>
    >`
      SELECT settings, name, phone, address, logo_url FROM tenants WHERE id = ${tenantId} FOR UPDATE
    `;
    const locked = rows[0];
    if (!locked) throw new Error("NOT_FOUND");

    const updateData: Prisma.TenantUpdateInput = { ...scalarData };
    if (data.settings !== undefined) {
      updateData.settings = data.settings as Prisma.InputJsonValue;
    }
    await tx.tenant.update({ where: { id: tenantId }, data: updateData });
  });

  if (touchesSettings) {
    await invalidateTenantSettingsCache(tenantId);
  }
}
