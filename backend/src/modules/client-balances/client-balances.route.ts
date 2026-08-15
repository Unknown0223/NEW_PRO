import type { FastifyInstance } from "fastify";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { enrichScopedReportActor, intersectRequestedAgentIds } from "../access/access-agent-scope";
import { listConsignmentBalancesReport } from "./consignment-balances.service";
import {
  listClientBalancesReport,
  listClientBalanceTerritoryOptions,
  type ClientBalanceListQuery
} from "./client-balances.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

function parseOptPositiveInt(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseCommaList(raw: string | undefined): string[] | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? [...new Set(items)] : undefined;
}

function parseIdCommaList(raw: string | undefined): number[] | undefined {
  const items = parseCommaList(raw);
  if (!items) return undefined;
  const ids = items
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

function parseListQuery(q: Record<string, string | undefined>): ClientBalanceListQuery {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const allowLarge = q.large_export === "1" || q.large_export === "true";
  const maxL = allowLarge ? 5000 : 200;
  const limit = Math.min(maxL, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));
  const deliveryOrderId = parseOptPositiveInt(q.order_id);
  const viewRaw = q.view?.trim();
  const view: ClientBalanceListQuery["view"] =
    viewRaw === "agents"
      ? "agents"
      : viewRaw === "clients_delivery"
        ? "clients_delivery"
        : viewRaw === "clients_legacy"
          ? "clients_legacy"
          : "clients";

  return {
    view,
    page,
    limit,
    allow_large_export: allowLarge,
    ...(q.search?.trim() ? { search: q.search.trim() } : {}),
    ...(parseOptPositiveInt(q.agent_id) !== undefined ? { agent_id: parseOptPositiveInt(q.agent_id) } : {}),
    ...(parseIdCommaList(q.agent_ids) ? { agent_ids: parseIdCommaList(q.agent_ids) } : {}),
    ...(parseOptPositiveInt(q.expeditor_user_id) !== undefined
      ? { expeditor_user_id: parseOptPositiveInt(q.expeditor_user_id) }
      : {}),
    ...(parseIdCommaList(q.expeditor_user_ids)
      ? { expeditor_user_ids: parseIdCommaList(q.expeditor_user_ids) }
      : {}),
    ...(parseOptPositiveInt(q.supervisor_user_id) !== undefined
      ? { supervisor_user_id: parseOptPositiveInt(q.supervisor_user_id) }
      : {}),
    ...(parseIdCommaList(q.supervisor_user_ids)
      ? { supervisor_user_ids: parseIdCommaList(q.supervisor_user_ids) }
      : {}),
    ...(q.trade_direction?.trim() ? { trade_direction: q.trade_direction.trim() } : {}),
    ...(parseCommaList(q.trade_directions) ? { trade_directions: parseCommaList(q.trade_directions) } : {}),
    ...(q.category?.trim() ? { category: q.category.trim() } : {}),
    ...(parseCommaList(q.categories) ? { categories: parseCommaList(q.categories) } : {}),
    ...(q.status?.trim() ? { status: q.status.trim() } : {}),
    ...(parseCommaList(q.statuses) ? { statuses: parseCommaList(q.statuses) } : {}),
    ...(q.balance_filter?.trim() ? { balance_filter: q.balance_filter.trim() } : {}),
    ...(parseCommaList(q.balance_filters) ? { balance_filters: parseCommaList(q.balance_filters) } : {}),
    ...(q.agent_consignment?.trim() ? { agent_consignment: q.agent_consignment.trim() } : {}),
    ...(q.territory_region?.trim() ? { territory_region: q.territory_region.trim() } : {}),
    ...(parseCommaList(q.territory_regions) ? { territory_regions: parseCommaList(q.territory_regions) } : {}),
    ...(q.territory_city?.trim() ? { territory_city: q.territory_city.trim() } : {}),
    ...(parseCommaList(q.territory_cities) ? { territory_cities: parseCommaList(q.territory_cities) } : {}),
    ...(q.territory_district?.trim() ? { territory_district: q.territory_district.trim() } : {}),
    ...(q.territory_zone?.trim() ? { territory_zone: q.territory_zone.trim() } : {}),
    ...(parseCommaList(q.territory_zones) ? { territory_zones: parseCommaList(q.territory_zones) } : {}),
    ...(q.balance_as_of?.trim() ? { balance_as_of: q.balance_as_of.trim() } : {}),
    ...(q.consignment_due_from?.trim() ? { consignment_due_from: q.consignment_due_from.trim() } : {}),
    ...(q.consignment_due_to?.trim() ? { consignment_due_to: q.consignment_due_to.trim() } : {}),
    ...(q.agent_branch?.trim() ? { agent_branch: q.agent_branch.trim() } : {}),
    ...(q.agent_payment_type?.trim() ? { agent_payment_type: q.agent_payment_type.trim() } : {}),
    ...(parseCommaList(q.agent_payment_types)
      ? { agent_payment_types: parseCommaList(q.agent_payment_types) }
      : {}),
    ...(q.branch_ids?.trim()
      ? {
          agent_branches: q.branch_ids
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        }
      : {}),
    ...(q.order_date_from?.trim() ? { order_date_from: q.order_date_from.trim() } : {}),
    ...(q.order_date_to?.trim() ? { order_date_to: q.order_date_to.trim() } : {}),
    ...(q.sort_by?.trim() ? { sort_by: q.sort_by.trim() } : {}),
    ...(q.sort_dir === "desc" ? { sort_dir: "desc" as const } : q.sort_dir === "asc" ? { sort_dir: "asc" as const } : {}),
    ...(deliveryOrderId !== undefined ? { delivery_order_id: deliveryOrderId } : {})
  };
}

export async function registerClientBalanceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/client-balances/territory-options",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const hasScope =
        Boolean(q.agent_branch?.trim()) ||
        Boolean(q.agent_id?.trim()) ||
        Boolean(q.agent_ids?.trim()) ||
        Boolean(q.supervisor_user_id?.trim()) ||
        Boolean(q.supervisor_user_ids?.trim()) ||
        Boolean(q.expeditor_user_id?.trim()) ||
        Boolean(q.expeditor_user_ids?.trim()) ||
        Boolean(q.trade_direction?.trim()) ||
        Boolean(q.category?.trim()) ||
        Boolean(q.status?.trim()) ||
        Boolean(q.agent_payment_type?.trim()) ||
        Boolean(q.branch_ids?.trim());
      const scope = hasScope ? parseListQuery(q) : undefined;
      const data = await listClientBalanceTerritoryOptions(request.tenant!.id, scope);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/client-balances",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseListQuery(q);
      const viewer = getAccessUser(request);
      const actor = await enrichScopedReportActor(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: viewer.role ?? ""
      });
      const requested = [
        ...(parsed.agent_ids ?? []),
        ...(parsed.agent_id != null && parsed.agent_id > 0 ? [parsed.agent_id] : [])
      ];
      const hit = intersectRequestedAgentIds(requested, actor);
      if (hit.restricted) {
        parsed.agent_ids = hit.agentIds;
        parsed.agent_id = undefined;
      }
      const t0 = Date.now();
      const result = await listClientBalancesReport(request.tenant!.id, parsed);
      request.log.info(
        {
          tenantId: request.tenant!.id,
          view: parsed.view,
          page: parsed.page,
          limit: parsed.limit,
          sortBy: parsed.sort_by ?? null,
          sortDir: parsed.sort_dir ?? null,
          total: result.total,
          elapsedMs: Date.now() - t0
        },
        "client-balances report timing"
      );
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/client-balances/consignment",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseListQuery(q);
      const t0 = Date.now();
      const result = await listConsignmentBalancesReport(request.tenant!.id, parsed);
      request.log.info(
        {
          tenantId: request.tenant!.id,
          page: parsed.page,
          limit: parsed.limit,
          sortBy: parsed.sort_by ?? null,
          sortDir: parsed.sort_dir ?? null,
          total: result.total,
          elapsedMs: Date.now() - t0
        },
        "consignment-balances report timing"
      );
      return reply.send(result);
    }
  );
}
