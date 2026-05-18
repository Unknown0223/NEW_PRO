import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { ensureTenantContext } from "../../lib/tenant-context";
import { prisma } from "../../config/database";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  bonusRuleConditionSummary,
  bonusRuleInclude,
  mapBonusRuleFull
} from "./bonus-rules.service";


export async function registerBonusRuleListRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/bonus-rules",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;

      const q = request.query as Record<string, string | undefined>;
      const pageNum = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limitNum = Math.min(500, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));

      const where: Prisma.BonusRuleWhereInput = {
        tenant_id: request.tenant!.id
      };
      if (q.is_active === "true") where.is_active = true;
      if (q.is_active === "false") where.is_active = false;

      const andFilters: Prisma.BonusRuleWhereInput[] = [];

      const search = q.search?.trim();
      if (search) {
        andFilters.push({ name: { contains: search, mode: "insensitive" } });
      }

      /** Vergul bilan: masalan `types=qty` yoki `types=sum,discount` (ro‘yxatlar bo‘limlariga ajratish). */
      const typesCsv = q.types?.trim();
      if (typesCsv) {
        const parts = typesCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const ok = [...new Set(parts)].filter((t): t is "qty" | "sum" | "discount" =>
          t === "qty" || t === "sum" || t === "discount"
        );
        if (ok.length > 0) {
          andFilters.push({ type: { in: ok } });
        }
      } else if (q.type === "qty" || q.type === "sum" || q.type === "discount") {
        andFilters.push({ type: q.type });
      } else if (q.exclude_type === "discount") {
        andFilters.push({ type: { not: "discount" } });
      }

      if (q.manual === "true") {
        andFilters.push({ is_manual: true });
      } else if (q.manual === "false") {
        andFilters.push({ is_manual: false });
      }

      const now = new Date();
      if (q.term === "expired") {
        andFilters.push({ AND: [{ valid_to: { not: null } }, { valid_to: { lt: now } }] });
      } else if (q.term === "current") {
        andFilters.push({
          AND: [
            { OR: [{ valid_to: null }, { valid_to: { gte: now } }] },
            { OR: [{ valid_from: null }, { valid_from: { lte: now } }] }
          ]
        });
      } else if (q.term === "upcoming") {
        andFilters.push({ AND: [{ valid_from: { not: null } }, { valid_from: { gt: now } }] });
      }

      const ruleIdRaw = q.rule_id?.trim() ?? q.id?.trim();
      if (ruleIdRaw) {
        const rid = Number.parseInt(ruleIdRaw, 10);
        if (Number.isFinite(rid) && rid > 0) {
          andFilters.push({ id: rid });
        }
      }

      if (andFilters.length) {
        where.AND = andFilters;
      }

      const [total, rows] = await Promise.all([
        prisma.bonusRule.count({ where }),
        prisma.bonusRule.findMany({
          where,
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
          orderBy: [{ priority: "desc" }, { id: "asc" }],
          include: bonusRuleInclude
        })
      ]);

      const mapped = rows.map(mapBonusRuleFull);
      const tenantId = request.tenant!.id;
      const prereqIdSet = new Set<number>();
      for (const row of mapped) {
        for (const pid of row.prerequisite_rule_ids) {
          if (pid > 0) prereqIdSet.add(pid);
        }
      }
      const prereqById = new Map<number, (typeof rows)[number]>();
      if (prereqIdSet.size > 0) {
        const prereqRows = await prisma.bonusRule.findMany({
          where: { tenant_id: tenantId, id: { in: [...prereqIdSet] } },
          include: bonusRuleInclude
        });
        for (const pr of prereqRows) {
          prereqById.set(pr.id, pr);
        }
      }
      const data = mapped.map((row) => ({
        ...row,
        prerequisite_summaries: row.prerequisite_rule_ids.map((pid) => {
          const pr = prereqById.get(pid);
          return pr ? bonusRuleConditionSummary(pr) : `— #${pid}`;
        })
      }));

      return reply.send({
        data,
        total,
        page: pageNum,
        limit: limitNum
      });
    }
  );
}
