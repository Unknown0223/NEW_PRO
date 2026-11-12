/**
 * AI Assistant — yozish amali uchun obyektni aniqlash.
 *
 * O‘qish tool’lari orqali (foydalanuvchi huquqi bilan) ID topiladi.
 * Topilmasa — foydalanuvchiga variantlar ko‘rsatiladi.
 */
import type { FastifyInstance } from "fastify";
import { runTool } from "./ai.exec";
import { pickRows } from "./ai.format";
import { getTool } from "./ai.registry";
import type { AiActor } from "./ai.types";

export type ResolvedEntity = {
  id: number;
  name: string;
  extra: Record<string, unknown>;
};

function toEntities(payload: unknown, nameKeys: string[]): ResolvedEntity[] {
  return pickRows(payload)
    .map((row) => {
      const id = Number(row.id);
      const name = nameKeys.map((key) => row[key]).find((value) => typeof value === "string" && value.trim());
      return { id, name: String(name ?? `#${id}`), extra: row };
    })
    .filter((item) => Number.isFinite(item.id) && item.id > 0);
}

export async function resolveProduct(app: FastifyInstance, actor: AiActor, query: string): Promise<ResolvedEntity[]> {
  const tool = getTool("products.list");
  if (!tool) return [];
  const run = await runTool(app, actor, tool, { search: query, limit: 5 });
  if (run.status !== "ok") return [];
  return toEntities(run.payload, ["name", "sku"]);
}

export async function resolveClient(app: FastifyInstance, actor: AiActor, query: string): Promise<ResolvedEntity[]> {
  const tool = getTool("clients.list");
  if (!tool) return [];
  const run = await runTool(app, actor, tool, { search: query, limit: 5 });
  if (run.status !== "ok") return [];
  return toEntities(run.payload, ["name", "client_name"]);
}

export async function resolveStaff(
  app: FastifyInstance,
  actor: AiActor,
  query: string,
  staffKind = "agent"
): Promise<ResolvedEntity[]> {
  const tool = getTool("staff.list");
  if (!tool) return [];
  const run = await runTool(app, actor, tool, { search: query, limit: 20, staffKind });
  if (run.status !== "ok") return [];
  return toEntities(run.payload, ["name", "fio", "login"]);
}

/** Mahsulotning joriy narxlari (ixtiyoriy, preview uchun). */
export async function productPrice(
  app: FastifyInstance,
  actor: AiActor,
  productId: number,
  priceType: string
): Promise<string | undefined> {
  try {
    const response = await app.inject({
      method: "GET",
      url: `/api/${encodeURIComponent(actor.tenantSlug)}/products/${productId}/prices`,
      headers: { authorization: actor.authorization, "x-tenant-slug": actor.tenantSlug }
    });
    if (response.statusCode >= 400) return undefined;
    const body = JSON.parse(response.body || "{}") as { data?: Array<Record<string, unknown>> };
    const rows = Array.isArray(body.data) ? body.data : [];
    const found = rows.find((row) => String(row.price_type ?? "") === priceType) ?? rows[0];
    const value = found?.price ?? found?.amount;
    return value === undefined || value === null ? undefined : String(value);
  } catch {
    return undefined;
  }
}
