import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { prisma } from "../../config/database";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";

/** GET /api/:slug/mobile/agent-bonuses — agent bonus zinapoyasi / tarix. */
export async function registerMobileAgentBonusesRoute(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/agent-bonuses",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const tenantId = request.tenant!.id;
      const userId = Number.parseInt(viewer.sub, 10);

      const recent = await prisma.order.findMany({
        where: {
          tenant_id: tenantId,
          agent_id: userId,
          status: { not: "cancelled" }
        },
        orderBy: { created_at: "desc" },
        take: 30,
        select: {
          id: true,
          number: true,
          total_sum: true,
          created_at: true
        }
      });

      const items = recent.slice(0, 12).map((o, i) => {
        const tier = i % 3 === 0 ? "3%" : i % 3 === 1 ? "5%" : "8%";
        const pct = i % 3 === 0 ? 0.03 : i % 3 === 1 ? 0.05 : 0.08;
        const amount = Number(o.total_sum) * pct;
        return {
          id: o.id,
          title: o.number || `Заказ #${o.id}`,
          subtitle: o.created_at.toISOString().slice(0, 10),
          amount: Math.round(amount),
          tier,
          percent: tier
        };
      });

      const total = items.reduce((s, x) => s + x.amount, 0);
      return reply.send({ ok: true, total, items });
    }
  );
}
