/**
 * Barcha agentlar uchun standart mobil konfiguratsiya va mahsulot qoidalari.
 * npx tsx scripts/ensure-agent-standard-config.ts [slug]
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { defaultMobileConfigForRole } from "../src/modules/staff/agent-mobile-config.defaults";

const slugArg = process.argv[2] ?? "test1";

function standardEntitlements(categoryIds: number[]) {
  const mobile_config = {
    ...defaultMobileConfigForRole("agent"),
    client: {
      can_create: true,
      can_edit: true,
      can_change_client_location: true,
      show_balance: true,
      show_photos: true,
      phone_prefix: "+998",
      fields_visible: {
        name: true,
        legal_name: true,
        phone: true,
        category: true,
        territory: true,
        address: true,
        visit_day: true,
        coordinates: true
      }
    },
    orders: {
      bonus_fill_mode: "auto_fill_remaining",
      allow_partial_return_edit: false,
      allow_reload_from_vehicle: false,
      allow_return_from_shelf: false
    },
    sync: { block_sync: false }
  };

  const product_rules =
    categoryIds.length > 0
      ? categoryIds.map((category_id) => ({ category_id, all: true }))
      : [];

  return {
    price_types: ["default"],
    product_rules,
    mobile_config
  };
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: slugArg } });
  if (!tenant) {
    console.error(`Tenant "${slugArg}" topilmadi`);
    process.exit(1);
  }

  const categories = await prisma.productCategory.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    select: { id: true }
  });
  const categoryIds = categories.map((c) => c.id);
  const template = standardEntitlements(categoryIds);

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

    const merged = {
      ...template,
      ...existing,
      price_types:
        Array.isArray(existing.price_types) && (existing.price_types as unknown[]).length > 0
          ? existing.price_types
          : template.price_types,
      product_rules:
        Array.isArray(existing.product_rules) && (existing.product_rules as unknown[]).length > 0
          ? existing.product_rules
          : template.product_rules,
      mobile_config: {
        ...template.mobile_config,
        ...(typeof existing.mobile_config === "object" && existing.mobile_config
          ? (existing.mobile_config as Record<string, unknown>)
          : {}),
        // Eski 720px/45% siqish sozlamalarini yangilash — kamera sifati saqlansin.
        photo: (template.mobile_config as Record<string, unknown>).photo
      }
    };

    await prisma.user.update({
      where: { id: agent.id },
      data: { agent_entitlements: merged as Prisma.InputJsonValue }
    });
    updated++;
    console.log(`  ✓ ${agent.login} (id=${agent.id})`);
  }

  console.log(`\n${slugArg}: ${updated} agent yangilandi (standart mobile_config + product_rules).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
