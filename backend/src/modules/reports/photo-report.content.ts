import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import { loadSupervisorPhotoContent } from "../dashboard/dashboard.supervisor.photo-content";
import type { ReportActor } from "./client-sales-4-report.service";

/** List/mosaic thumb path — never embed base64 in report JSON. */
export function buildPhotoReportThumbUrl(
  tenantSlug: string,
  photoId: number,
  unavailable: boolean
): string | null {
  if (unavailable) return null;
  const slug = tenantSlug.trim();
  if (!slug || !Number.isFinite(photoId) || photoId <= 0) return null;
  return `/api/${slug}/reports/photo/${photoId}/content?thumb=1`;
}

export type PhotoReportContentResult =
  | { kind: "redirect"; url: string }
  | { kind: "bytes"; buffer: Buffer; contentType: string };

/** Same agent/branch scope as the photo list report. */
export async function canViewPhotoReportContent(
  tenantId: number,
  photoId: number,
  actor?: ReportActor
): Promise<boolean> {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const scopeSql = scopedActor
    ? buildScopedAgentExistsSql(
        tenantId,
        Prisma.sql`COALESCE(pr.created_by_user_id, c.agent_id)`,
        scopedActor
      )
    : Prisma.sql`TRUE`;
  const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
    SELECT 1 AS ok
    FROM client_photo_reports pr
    JOIN clients c ON c.id = pr.client_id
    WHERE pr.tenant_id = ${tenantId}
      AND pr.id = ${photoId}
      AND pr.deleted_at IS NULL
      AND pr.content_purged_at IS NULL
      AND ${scopeSql}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Reuse supervisor decode/shrink; route gated by reports.fotootchyoty.view + scope. */
export async function getPhotoReportContent(
  tenantId: number,
  photoId: number,
  thumb: boolean,
  actor?: ReportActor
): Promise<PhotoReportContentResult | null> {
  const allowed = await canViewPhotoReportContent(tenantId, photoId, actor);
  if (!allowed) return null;
  return loadSupervisorPhotoContent(tenantId, photoId, { thumb });
}
