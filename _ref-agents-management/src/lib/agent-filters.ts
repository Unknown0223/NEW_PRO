import { and, eq, ilike, or } from "drizzle-orm";
import { agents } from "@/db/schema";

export function buildFilters(searchParams: URLSearchParams) {
  const conditions = [];
  const active = searchParams.get("active");
  if (active === "true" || active === "false") {
    conditions.push(eq(agents.active, active === "true"));
  }
  const branch = searchParams.get("branch");
  if (branch) conditions.push(eq(agents.branch, branch));
  const tradeDirection = searchParams.get("tradeDirection");
  if (tradeDirection) conditions.push(eq(agents.tradeDirection, tradeDirection));
  const position = searchParams.get("position");
  if (position) conditions.push(eq(agents.position, position));
  const warehouse = searchParams.get("warehouse");
  if (warehouse) conditions.push(eq(agents.warehouse, warehouse));
  const search = searchParams.get("search")?.trim();
  if (search) {
    const q = `%${search}%`;
    conditions.push(
      or(
        ilike(agents.fullname, q),
        ilike(agents.code, q),
        ilike(agents.phone, q),
        ilike(agents.pinfl, q),
        ilike(agents.login, q)
      )
    );
  }
  return conditions.length ? and(...conditions) : undefined;
}
