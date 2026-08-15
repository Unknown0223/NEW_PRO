/**
 * Diagnose why operator still sees all agents on /orders.
 *   npx tsx scripts/diagnose-operator-orders-scope.ts
 */
import { prisma } from "../src/config/database";
import { listOrdersPaged } from "../src/modules/orders/orders.service";
import { enrichScopedReportActor, buildOrderAgentScopeWhere } from "../src/modules/access/access-agent-scope";
import { getAppCache, ordersListCacheKey } from "../src/lib/redis-cache";
import { stableJsonStringify } from "../src/modules/dashboard/dashboard.cache";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "test1" } });
  if (!tenant) throw new Error("no test1");
  const op = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: "operator" },
    select: { id: true, role: true, is_active: true }
  });
  if (!op) throw new Error("no operator");

  const bound = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", supervisor_user_id: op.id },
    select: { id: true, name: true, login: true, code: true, is_active: true },
    orderBy: { id: "asc" }
  });
  console.log("operator id=", op.id, "active=", op.is_active);
  console.log(
    "bound agents count=",
    bound.length,
    bound.map((a) => `${a.id}:${a.name || a.login}`)
  );

  const actor = await enrichScopedReportActor(tenant.id, { userId: op.id, role: "operator" });
  console.log("scoped bound_agent_ids=", actor.bound_agent_ids);
  console.log("order where=", JSON.stringify(buildOrderAgentScopeWhere(actor)));

  const q = {
    page: 1,
    limit: 100,
    date_from: "2026-07-01",
    date_to: "2026-07-31"
  } as any;

  const cacheKey = ordersListCacheKey(
    tenant.id,
    stableJsonStringify({ q, viewerRole: "operator", viewerUserId: op.id })
  );
  const cached = await getAppCache<any>(cacheKey);
  console.log("cache hit=", Boolean(cached), "cachedRows=", cached?.data?.length ?? null);
  if (cached?.data) {
    const agents = [
      ...new Set(cached.data.map((r: any) => `${r.agent_id}:${r.agent_name ?? r.agent ?? "?"}`))
    ];
    console.log("cached agent set=", agents);
  }

  const result = await listOrdersPaged(tenant.id, q, "operator", op.id);
  const agentSet = [
    ...new Set(result.data.map((r) => `${r.agent_id}:${(r as any).agent_name ?? "?"}`))
  ];
  console.log("list total=", result.total, "rows=", result.data.length, "agents=", agentSet);

  const allAgents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent" },
    select: { id: true, name: true, login: true }
  });
  console.log(
    "all agents=",
    allAgents.map((a) => `${a.id}:${a.name || a.login}`)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
