import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { hydrateDates, readZipJson, remapId, stripIdTenant } from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

/** Fotootchyot: faqat oxirgi N kun (default 30). */
export const PHOTO_REPORT_EXPORT_DAYS = 30;

export function photoReportExportCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - PHOTO_REPORT_EXPORT_DAYS);
  return d;
}

export async function importClientPhotoReports(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps
): Promise<number> {
  const rows = await readZipJson<Record<string, unknown>>(zip, "data/client_photo_reports.json");
  if (!rows.length) return 0;

  let imported = 0;
  for (const row of rows) {
    const clientId = remapId(maps.client, row.client_id);
    if (clientId == null) continue;
    const data = hydrateDates(stripIdTenant(row), [
      "created_at",
      "deleted_at",
      "content_purged_at"
    ]);
    const imageUrl = String(data.image_url ?? "").trim();
    if (!imageUrl) continue;

    await tx.clientPhotoReport.create({
      data: {
        ...(data as Prisma.ClientPhotoReportUncheckedCreateInput),
        tenant_id: tenantId,
        client_id: clientId,
        image_url: imageUrl,
        order_id: remapId(maps.order, data.order_id) ?? null,
        created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
        deleted_by_user_id: remapId(maps.user, data.deleted_by_user_id) ?? null
      }
    });
    imported += 1;
  }

  return imported;
}
