import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { hydrateDates, readZipJson, remapId, stripIdTenant } from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

export async function importClientPhotoReports(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps
): Promise<number> {
  const rows = await readZipJson<Record<string, unknown>>(zip, "data/client_photo_reports.json");
  if (!rows.length) return 0;

  for (const row of rows) {
    const clientId = remapId(maps.client, row.client_id);
    if (clientId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["created_at"]);
    const imageUrl = String(data.image_url ?? "").trim();
    if (!imageUrl) continue;

    await tx.clientPhotoReport.create({
      data: {
        ...(data as Prisma.ClientPhotoReportUncheckedCreateInput),
        tenant_id: tenantId,
        client_id: clientId,
        image_url: imageUrl,
        order_id: remapId(maps.order, data.order_id) ?? null,
        created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null
      }
    });
  }

  return rows.length;
}
