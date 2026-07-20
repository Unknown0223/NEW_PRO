/**
 * Domain-level operator agent scope (DB, no login).
 *   npx tsx scripts/smoke-operator-agent-scope-db.ts
 */
import { prisma } from "../src/config/database";
import { listOrdersPaged } from "../src/modules/orders/orders.service";
import { listStaff } from "../src/modules/staff/staff.service";
import { buildScopedAgentDirectoryWhereForActor } from "../src/modules/access/access-agent-scope";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "test1" } });
  if (!tenant) throw new Error("no test1");
  const op = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: "operator", role: "operator" }
  });
  if (!op) throw new Error("no operator");

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent" },
    select: { id: true, name: true, login: true },
    orderBy: { id: "asc" }
  });
  if (agents.length < 2) throw new Error("need >=2 agents");
  const keep = agents[0]!;
  const other = agents[1]!;

  // reset all supervisees of operator then bind one
  await prisma.user.updateMany({
    where: { tenant_id: tenant.id, supervisor_user_id: op.id },
    data: { supervisor_user_id: null }
  });
  await prisma.user.update({
    where: { id: keep.id },
    data: { supervisor_user_id: op.id }
  });

  const scope = await buildScopedAgentDirectoryWhereForActor(tenant.id, {
    userId: op.id,
    role: "operator"
  });
  const dir = await listStaff(tenant.id, "agent", undefined, scope);
  const dirIds = dir.map((a) => a.id);
  console.log("directory", dirIds, "keep", keep.id, "other", other.id);
  if (!dirIds.includes(keep.id) || dirIds.includes(other.id) || dirIds.length !== 1) {
    throw new Error(`directory scope fail: ${dirIds.join(",")}`);
  }
  console.log("OK  GET /agents semantics (listStaff+scope)");

  const orders = await listOrdersPaged(
    tenant.id,
    {
      page: 1,
      limit: 100,
      date_from: "2026-07-01",
      date_to: "2026-07-31"
    } as any,
    "operator",
    op.id
  );
  const leak = orders.data.filter((r) => r.agent_id != null && r.agent_id !== keep.id);
  console.log("orders total", orders.total, "rows", orders.data.length, "leak", leak.length);
  if (leak.length > 0) {
    throw new Error(`orders leak agent_ids=${leak.map((r) => r.agent_id).join(",")}`);
  }
  console.log("OK  listOrdersPaged scoped");

  // detail of other agent's order should 404
  const foreign = await prisma.order.findFirst({
    where: { tenant_id: tenant.id, agent_id: other.id },
    select: { id: true }
  });
  if (foreign) {
    const { getOrderDetail } = await import("../src/modules/orders/orders.service");
    try {
      await getOrderDetail(tenant.id, foreign.id, "operator", op.id);
      throw new Error("expected NOT_FOUND for foreign order");
    } catch (e) {
      if (!(e instanceof Error) || e.message !== "NOT_FOUND") throw e;
      console.log("OK  getOrderDetail blocks foreign agent order");
    }
  } else {
    console.log("NOTE no foreign order to detail-test");
  }

  console.log("\n=== DB scope smoke PASSED ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
