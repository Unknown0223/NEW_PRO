import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import type { LinkageConstraintScope, LinkageSelectedMasters } from "./linkage.types";
import { intersectNumberSets, normalizeSelectedId } from "./linkage.shared";
import { resolveByAgent } from "./linkage.resolve.agent";
import { resolveByCashDesk } from "./linkage.resolve.cashdesk";
import { resolveByClient } from "./linkage.resolve.client";
import { resolveByExpeditor } from "./linkage.resolve.expeditor";
import { resolveByWarehouse } from "./linkage.resolve.warehouse";

export function parseSelectedMastersFromQuery(query: Record<string, unknown>): LinkageSelectedMasters {
  const parseOptionalPositiveInt = (raw: unknown): number | undefined => {
    if (raw == null) return undefined;
    const asString = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
    if (!asString.trim()) return undefined;
    const n = Number.parseInt(asString.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    selected_client_id: parseOptionalPositiveInt(query.selected_client_id),
    selected_agent_id: parseOptionalPositiveInt(query.selected_agent_id),
    selected_warehouse_id: parseOptionalPositiveInt(query.selected_warehouse_id),
    selected_cash_desk_id: parseOptionalPositiveInt(query.selected_cash_desk_id),
    selected_expeditor_user_id: parseOptionalPositiveInt(query.selected_expeditor_user_id)
  };
}

export async function resolveConstraintScope(
  tenantId: number,
  selected: LinkageSelectedMasters
): Promise<LinkageConstraintScope> {
  const selected_client_id = normalizeSelectedId(selected.selected_client_id);
  const selected_agent_id = normalizeSelectedId(selected.selected_agent_id);
  const selected_warehouse_id = normalizeSelectedId(selected.selected_warehouse_id);
  const selected_cash_desk_id = normalizeSelectedId(selected.selected_cash_desk_id);
  const selected_expeditor_user_id = normalizeSelectedId(selected.selected_expeditor_user_id);

  const constrained =
    selected_client_id != null ||
    selected_agent_id != null ||
    selected_warehouse_id != null ||
    selected_cash_desk_id != null ||
    selected_expeditor_user_id != null;

  if (!constrained) {
    return {
      selected_client_id,
      selected_agent_id,
      selected_warehouse_id,
      selected_cash_desk_id,
      selected_expeditor_user_id,
      constrained: false,
      client_ids: [],
      agent_ids: [],
      warehouse_ids: [],
      cash_desk_ids: [],
      expeditor_ids: [],
      product_ids: [],
      product_restricted: false
    };
  }

  const scoped = await Promise.all([
    selected_client_id != null ? resolveByClient(tenantId, selected_client_id) : null,
    selected_agent_id != null ? resolveByAgent(tenantId, selected_agent_id) : null,
    selected_warehouse_id != null ? resolveByWarehouse(tenantId, selected_warehouse_id) : null,
    selected_cash_desk_id != null ? resolveByCashDesk(tenantId, selected_cash_desk_id) : null,
    selected_expeditor_user_id != null ? resolveByExpeditor(tenantId, selected_expeditor_user_id) : null
  ]);
  const scopes = scoped.filter((s): s is NonNullable<(typeof scoped)[number]> => s != null);
  const client_ids = intersectNumberSets(scopes.map((s) => s.client_ids));
  const agent_ids = intersectNumberSets(scopes.map((s) => s.agent_ids));
  const warehouse_ids = intersectNumberSets(scopes.map((s) => s.warehouse_ids));
  const cash_desk_ids = intersectNumberSets(scopes.map((s) => s.cash_desk_ids));
  const expeditor_ids = intersectNumberSets(scopes.map((s) => s.expeditor_ids));
  const productScoped = scopes.filter((s) => {
    const restricted =
      "product_restricted" in s && Boolean((s as { product_restricted?: boolean }).product_restricted);
    return restricted || s.product_ids.size > 0;
  });
  const product_ids = intersectNumberSets(productScoped.map((s) => s.product_ids));
  const product_restricted = productScoped.length > 0;

  return {
    selected_client_id,
    selected_agent_id,
    selected_warehouse_id,
    selected_cash_desk_id,
    selected_expeditor_user_id,
    constrained: true,
    client_ids,
    agent_ids,
    warehouse_ids,
    cash_desk_ids,
    expeditor_ids,
    product_ids,
    product_restricted
  };
}
