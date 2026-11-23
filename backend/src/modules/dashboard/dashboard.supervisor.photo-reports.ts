import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { isClientPhotoStorageKey, readStoredClientPhoto } from "../../lib/client-photo-storage";
import type { SupervisorDashboardFilters } from "./dashboard.supervisor.scope";

export type SupervisorPhotoReportImageMeta = {
  id: number;
  caption: string | null;
  created_at: string;
};

export type SupervisorPhotoReportImage = SupervisorPhotoReportImageMeta & {
  image_url: string;
};

export type SupervisorPhotoReportCategory = {
  label: string;
  count: number;
  photos: SupervisorPhotoReportImageMeta[];
};

export type SupervisorPhotoReportClientRow = {
  client_id: number;
  client_label: string;
  client_name: string;
  client_category: string | null;
  territory: string | null;
  categories: SupervisorPhotoReportCategory[];
};

export type SupervisorPhotoReportsPayload = {
  agent: { id: number; name: string; code: string | null };
  date: string;
  summary: { outlets: number; photo_count: number };
  rows: SupervisorPhotoReportClientRow[];
  all_photos: Array<SupervisorPhotoReportImageMeta & { client_name: string }>;
  total: number;
  page: number;
  limit: number;
};

/** Kunlik lenta (shablon PhotoReportsPage) — agent_id shart emas. */
export type SupervisorDayPhotoFeedItem = {
  id: number;
  caption: string | null;
  created_at: string;
  client_id: number;
  client_name: string;
  client_city: string | null;
  category: string;
  agent_id: number;
  agent_name: string;
};

export type SupervisorDayPhotoFeedPayload = {
  date: string;
  summary: { outlets: number; photo_count: number; agent_count: number };
  photos: SupervisorDayPhotoFeedItem[];
};

function photoCategoryLabel(caption: string | null | undefined): string {
  const t = String(caption ?? "").trim();
  return t || "Без категории";
}

function clientTerritory(c: {
  zone: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
}): string | null {
  const parts = [c.zone, c.region, c.city, c.district].map((x) => String(x ?? "").trim()).filter(Boolean);
  return parts[0] ?? null;
}

/** Base64 / data-URL DB da saqlansa — JSON orqali uzatish brauzerni «o‘ldiradi». */
export function isInlineHeavyPhotoUrl(url: string | null | undefined): boolean {
  const t = String(url ?? "").trim();
  if (!t) return false;
  if (/^data:/i.test(t)) return true;
  if (/^https?:\/\//i.test(t) || t.startsWith("/")) return false;
  // Xom base64 (prefixsiz) — uzun bo‘lsa heavy.
  return t.length > 400;
}

export function supervisorPhotoContentPath(tenantSlug: string, photoId: number): string {
  return `/api/${tenantSlug}/dashboard/supervisor/photo-reports/${photoId}/content`;
}

export function resolvePhotoUrlForClient(
  tenantSlug: string,
  photoId: number,
  storedUrl: string
): string {
  if (isInlineHeavyPhotoUrl(storedUrl)) {
    return supervisorPhotoContentPath(tenantSlug, photoId);
  }
  const t = storedUrl.trim();
  if (isClientPhotoStorageKey(t)) {
    return supervisorPhotoContentPath(tenantSlug, photoId);
  }
  return t || supervisorPhotoContentPath(tenantSlug, photoId);
}

const DATA_URL_BASE64_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;
const DATA_URL_UTF8_RE = /^data:(image\/[a-z0-9.+-]+)(?:;charset=[^;,]+)?;(?:utf-?8,|,)(.+)$/i;

export function decodeStoredPhotoContent(stored: string): {
  buffer: Buffer;
  contentType: string;
} | null {
  const t = stored.trim();
  if (!t) return null;
  const b64 = DATA_URL_BASE64_RE.exec(t);
  if (b64) {
    return { contentType: b64[1]!, buffer: Buffer.from(b64[2]!, "base64") };
  }
  const utf8 = DATA_URL_UTF8_RE.exec(t);
  if (utf8) {
    try {
      const raw = decodeURIComponent(utf8[2]!);
      return { contentType: utf8[1]!, buffer: Buffer.from(raw, "utf8") };
    } catch {
      return null;
    }
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(t) && t.length > 80) {
    return { contentType: "image/jpeg", buffer: Buffer.from(t.replace(/\s+/g, ""), "base64") };
  }
  return null;
}

export async function listSupervisorAgentPhotoReports(
  tenantId: number,
  filters: SupervisorDashboardFilters,
  agentId: number,
  opts: { page?: number; limit?: number; search?: string } = {}
): Promise<SupervisorPhotoReportsPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 10));
  const search = opts.search?.trim() ?? "";

  const dayStart = new Date(`${filters.date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const agent = await prisma.user.findFirst({
    where: { id: agentId, tenant_id: tenantId, role: "agent" },
    select: { id: true, name: true, code: true }
  });
  if (!agent) {
    return {
      agent: { id: agentId, name: `Agent ${agentId}`, code: null },
      date: filters.date,
      summary: { outlets: 0, photo_count: 0 },
      rows: [],
      all_photos: [],
      total: 0,
      page,
      limit
    };
  }

  const clientWhere: Prisma.ClientWhereInput = {
    ...(filters.client_categories.length > 0
      ? { category: { in: filters.client_categories } }
      : {}),
    ...(filters.territory_1_list.length > 0 ? { zone: { in: filters.territory_1_list } } : {}),
    ...(filters.territory_2_list.length > 0 ? { region: { in: filters.territory_2_list } } : {}),
    ...(filters.territory_3_list.length > 0 ? { city: { in: filters.territory_3_list } } : {})
  };

  const photoWhere: Prisma.ClientPhotoReportWhereInput = {
    tenant_id: tenantId,
    created_by_user_id: agentId,
    deleted_at: null,
    created_at: { gte: dayStart, lt: dayEnd },
    ...(Object.keys(clientWhere).length > 0 ? { client: clientWhere } : {}),
    ...(search
      ? {
          client: {
            ...(Object.keys(clientWhere).length > 0 ? clientWhere : {}),
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } }
            ]
          }
        }
      : {})
  };

  // image_url ni bu yerda OLMASLIK — base64 bo‘lsa ro‘yxat so‘rovi sekundlab cho‘ziladi.
  const photos = await prisma.clientPhotoReport.findMany({
    where: photoWhere,
    select: {
      id: true,
      client_id: true,
      caption: true,
      created_at: true,
      client: {
        select: {
          id: true,
          name: true,
          category: true,
          zone: true,
          region: true,
          city: true,
          district: true
        }
      }
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }]
  });

  const byClient = new Map<
    number,
    {
      client: (typeof photos)[0]["client"];
      categories: Map<string, SupervisorPhotoReportImageMeta[]>;
    }
  >();

  for (const p of photos) {
    const label = photoCategoryLabel(p.caption);
    const img: SupervisorPhotoReportImageMeta = {
      id: p.id,
      caption: p.caption,
      created_at: p.created_at.toISOString()
    };
    let bucket = byClient.get(p.client_id);
    if (!bucket) {
      bucket = { client: p.client, categories: new Map() };
      byClient.set(p.client_id, bucket);
    }
    const catPhotos = bucket.categories.get(label) ?? [];
    catPhotos.push(img);
    bucket.categories.set(label, catPhotos);
  }

  const allClientRows: SupervisorPhotoReportClientRow[] = Array.from(byClient.values())
    .map(({ client, categories }) => ({
      client_id: client.id,
      client_label: `qi_${client.id}`,
      client_name: client.name,
      client_category: client.category,
      territory: clientTerritory(client),
      categories: Array.from(categories.entries())
        .map(([label, catPhotos]) => ({
          label,
          count: catPhotos.length,
          photos: catPhotos
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru"))
    }))
    .sort((a, b) => a.client_name.localeCompare(b.client_name, "ru"));

  const offset = (page - 1) * limit;
  const rows = allClientRows.slice(offset, offset + limit);

  const all_photos = photos.map((p) => ({
    id: p.id,
    caption: p.caption,
    created_at: p.created_at.toISOString(),
    client_name: p.client.name
  }));

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      code: agent.code != null && String(agent.code).trim() !== "" ? String(agent.code).trim() : null
    },
    date: filters.date,
    summary: {
      outlets: allClientRows.length,
      photo_count: photos.length
    },
    rows,
    all_photos,
    total: allClientRows.length,
    page,
    limit
  };
}

export async function listSupervisorDayPhotoFeed(
  tenantId: number,
  filters: SupervisorDashboardFilters,
  opts: { search?: string; limit?: number } = {}
): Promise<SupervisorDayPhotoFeedPayload> {
  const search = opts.search?.trim() ?? "";
  const limit = Math.min(500, Math.max(1, opts.limit ?? 200));
  const dayStart = new Date(`${filters.date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const clientWhere: Prisma.ClientWhereInput = {
    ...(filters.client_categories.length > 0
      ? { category: { in: filters.client_categories } }
      : {}),
    ...(filters.territory_1_list.length > 0 ? { zone: { in: filters.territory_1_list } } : {}),
    ...(filters.territory_2_list.length > 0 ? { region: { in: filters.territory_2_list } } : {}),
    ...(filters.territory_3_list.length > 0 ? { city: { in: filters.territory_3_list } } : {})
  };

  const agentIdFilter =
    filters.agent_ids.length > 0
      ? { created_by_user_id: { in: filters.agent_ids } }
      : {};

  const photos = await prisma.clientPhotoReport.findMany({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      created_at: { gte: dayStart, lt: dayEnd },
      ...agentIdFilter,
      ...(Object.keys(clientWhere).length > 0 ? { client: clientWhere } : {}),
      ...(search
        ? {
            OR: [
              { caption: { contains: search, mode: "insensitive" } },
              {
                client: {
                  ...(Object.keys(clientWhere).length > 0 ? clientWhere : {}),
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { city: { contains: search, mode: "insensitive" } }
                  ]
                }
              },
              { created_by: { name: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      caption: true,
      created_at: true,
      created_by_user_id: true,
      client_id: true,
      client: { select: { id: true, name: true, city: true } },
      created_by: { select: { id: true, name: true } }
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit
  });

  const agentIds = new Set<number>();
  const clientIds = new Set<number>();
  const items: SupervisorDayPhotoFeedItem[] = photos.map((p) => {
    const agentId = p.created_by_user_id ?? p.created_by?.id ?? 0;
    agentIds.add(agentId);
    clientIds.add(p.client_id);
    return {
      id: p.id,
      caption: p.caption,
      created_at: p.created_at.toISOString(),
      client_id: p.client_id,
      client_name: p.client?.name ?? "—",
      client_city: p.client?.city ?? null,
      category: photoCategoryLabel(p.caption),
      agent_id: agentId,
      agent_name: p.created_by?.name?.trim() || `Agent ${agentId}`
    };
  });

  return {
    date: filters.date,
    summary: {
      outlets: clientIds.size,
      photo_count: items.length,
      agent_count: agentIds.size
    },
    photos: items
  };
}

export {
  fetchRemotePhotoBytes,
  fetchSupervisorPhotoImages,
  isSafeRemotePhotoUrl,
  loadSupervisorPhotoContent,
  shrinkPhotoThumb
} from "./dashboard.supervisor.photo-content";
