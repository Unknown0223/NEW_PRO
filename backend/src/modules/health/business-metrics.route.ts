import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";

function internalTokenAuthorized(request: { headers: Record<string, unknown> }): boolean {
  const expected = env.INTERNAL_HEALTH_TOKEN?.trim();
  if (!expected) return false;
  const provided = request.headers["x-internal-token"];
  const token = Array.isArray(provided) ? provided[0] : provided;
  return token === expected;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function registerBusinessMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/:slug/metrics/business",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const since = startOfTodayUtc();

      const [ordersToday, activeUsers, clientsTotal, paymentsToday] = await Promise.all([
        prisma.order.count({ where: { tenant_id: tenantId, created_at: { gte: since } } }),
        prisma.user.count({ where: { tenant_id: tenantId, is_active: true } }),
        prisma.client.count({ where: { tenant_id: tenantId, is_active: true } }),
        prisma.payment.count({ where: { tenant_id: tenantId, created_at: { gte: since } } })
      ]);

      return reply.send({
        data: {
          tenant_id: tenantId,
          orders_today: ordersToday,
          active_users: activeUsers,
          active_clients: clientsTotal,
          payments_today: paymentsToday,
          as_of: new Date().toISOString()
        }
      });
    }
  );

  app.get("/metrics/business", async (request, reply) => {
    if (!internalTokenAuthorized(request)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const since = startOfTodayUtc();
    const [ordersToday, activeUsers, tenantCount] = await Promise.all([
      prisma.order.count({ where: { created_at: { gte: since } } }),
      prisma.user.count({ where: { is_active: true } }),
      prisma.tenant.count({ where: { is_active: true } })
    ]);

    return reply.send({
      aggregate: true,
      orders_today: ordersToday,
      active_users: activeUsers,
      active_tenants: tenantCount,
      as_of: new Date().toISOString()
    });
  });
}
