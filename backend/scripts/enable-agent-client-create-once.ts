/**
 * Agentlar uchun mijoz yaratish/tahrirlash ruxsatini yoqish (mavjud DB).
 *   npx tsx scripts/enable-agent-client-create-once.ts [slug]
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { defaultMobileConfigForRole } from "../src/modules/staff/agent-mobile-config.defaults";

const slugArg = process.argv[2] ?? "test1";

const clientCreatePatch = defaultMobileConfigForRole("agent").client ?? {};

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: slugArg } });
  if (!tenant) {
    console.error(`Tenant "${slugArg}" topilmadi`);
    process.exit(1);
  }

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, login: true, agent_entitlements: true }
  });

  let updated = 0;
  for (const agent of agents) {
    const existing =
      agent.agent_entitlements && typeof agent.agent_entitlements === "object"
        ? (agent.agent_entitlements as Record<string, unknown>)
        : {};
    const existingMc =
      typeof existing.mobile_config === "object" && existing.mobile_config
        ? (existing.mobile_config as Record<string, unknown>)
        : {};
    const existingClient =
      typeof existingMc.client === "object" && existingMc.client
        ? (existingMc.client as Record<string, unknown>)
        : {};

    const merged = {
      ...existing,
      mobile_config: {
        schema_version: 1,
        ...existingMc,
        client: {
          ...clientCreatePatch,
          ...existingClient,
          can_create: true,
          can_edit: true,
          can_change_client_location: true
        }
      }
    };

    await prisma.user.update({
      where: { id: agent.id },
      data: { agent_entitlements: merged as Prisma.InputJsonValue }
    });
    updated++;
    console.log(`  ✓ ${agent.login} (id=${agent.id}) — can_create=true`);
  }

  console.log(`\n${slugArg}: ${updated} agent yangilandi.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
