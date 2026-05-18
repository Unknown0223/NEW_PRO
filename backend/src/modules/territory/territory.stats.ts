import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


export async function getTerritoryStats(
  tenantId: number,
  opts?: { from?: string; to?: string }
) {
  // Fetch all territories for the tenant
  const territories = await prisma.territory.findMany({
    where: { tenant_id: tenantId, deleted_at: null },
    select: { id: true, name: true }
  });

  // Collect all user IDs linked to each territory
  const links = await prisma.territoryUserLink.findMany({
    where: {
      territory: { tenant_id: tenantId }
    },
    select: { territory_id: true, user_id: true }
  });

  // Build territory_id -> user IDs map
  const territoryUsers = new Map<number, number[]>();
  for (const link of links) {
    const existing = territoryUsers.get(link.territory_id);
    if (existing) {
      if (!existing.includes(link.user_id)) existing.push(link.user_id);
    } else {
      territoryUsers.set(link.territory_id, [link.user_id]);
    }
  }

  // Flatten all unique user IDs across territories
  const allUserIds = Array.from(new Set(links.map((l) => l.user_id)));

  // Build date filter
  const whereTime: Prisma.DateTimeFilter = {};
  if (opts?.from) {
    const f = new Date(opts.from);
    if (!Number.isNaN(f.getTime())) whereTime.gte = f;
  }
  if (opts?.to) {
    const t = new Date(opts.to);
    if (!Number.isNaN(t.getTime())) {
      t.setUTCHours(23, 59, 59, 999);
      whereTime.lte = t;
    }
  }
  const hasTime = Object.keys(whereTime).length > 0;

  const ordersByUser = new Map<number, number>();
  const visitsByAgent = new Map<number, number>();

  if (allUserIds.length > 0) {
    const ordersWhere: Record<string, any> = {
      tenant_id: tenantId,
      agent_id: { in: allUserIds }
    };
    if (hasTime) ordersWhere.created_at = whereTime;

    const visitWhere: Record<string, any> = {
      tenant_id: tenantId,
      agent_id: { in: allUserIds }
    };
    if (hasTime) visitWhere.checked_in_at = whereTime;

    const ordersRaw = await prisma.order.groupBy({
      by: ["agent_id"],
      _count: { id: true },
      where: ordersWhere
    });

    const visitsRaw = await prisma.agentVisit.groupBy({
      by: ["agent_id"],
      _count: { id: true },
      where: visitWhere
    });

    for (const o of ordersRaw) {
      const count = typeof o._count === "object" && o._count !== null
        ? ((o as any)._count.id as number)
        : 0;
      if (o.agent_id !== null) ordersByUser.set(o.agent_id, count);
    }
    for (const v of visitsRaw) {
      const count = typeof v._count === "object" && v._count !== null
        ? ((v as any)._count.id as number)
        : 0;
      visitsByAgent.set(v.agent_id, count);
    }
  }

  return territories.map((t) => {
    const userIds = territoryUsers.get(t.id) ?? [];
    let orderCount = 0;
    let visitCount = 0;
    for (const uid of userIds) {
      orderCount += ordersByUser.get(uid) ?? 0;
      visitCount += visitsByAgent.get(uid) ?? 0;
    }
    return {
      territory_id: t.id,
      name: t.name,
      agents_count: userIds.length,
      visits_count: visitCount,
      orders_count: orderCount
    };
  });
}
