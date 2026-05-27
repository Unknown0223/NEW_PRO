import "dotenv/config";
import { mergeDefaultReasonReferences, prisma } from "../prisma/seed/helpers";
import { seedTest1ClientRefusals } from "../prisma/seed/seed-test1-refusals";

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
  if (!tenant) {
    console.error("tenant test1 not found");
    process.exit(1);
  }
  await mergeDefaultReasonReferences(tenant.id);
  const { invalidateTenantSettingsCache } = await import("../src/lib/redis-cache");
  await invalidateTenantSettingsCache(tenant.id);
  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    orderBy: { id: "asc" }
  });
  if (!agent) {
    console.error("no active agent for test1");
    process.exit(1);
  }
  await seedTest1ClientRefusals(tenant.id, agent.id);
  const count = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM client_refusals WHERE tenant_id = ${tenant.id}
  `;
  console.log(`client_refusals for test1: ${count[0]?.count ?? 0}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
