import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
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

export async function fetchSupervisorPhotoImages(
  tenantId: number,
  photoIds: number[]
): Promise<SupervisorPhotoReportImage[]> {
  const ids = [...new Set(photoIds)].filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return [];
  const rows = await prisma.clientPhotoReport.findMany({
    where: { tenant_id: tenantId, id: { in: ids.slice(0, 100) }, deleted_at: null },
    select: { id: true, image_url: true, caption: true, created_at: true }
  });
  return rows.map((r) => ({
    id: r.id,
    image_url: r.image_url,
    caption: r.caption,
    created_at: r.created_at.toISOString()
  }));
}
