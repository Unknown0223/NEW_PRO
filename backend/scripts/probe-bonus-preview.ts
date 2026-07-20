/**
 * Probe mobile bonus-preview for tenant test1 / agent #5.
 * Usage: npx tsx scripts/probe-bonus-preview.ts
 */
import { prisma } from "../src/config/database";
import { previewMobileOrderBonus } from "../src/modules/mobile/mobile-order-bonus-preview.service";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "test1" } });
  if (!tenant) throw new Error("no tenant test1");

  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, id: 5 },
    select: { id: true, login: true, name: true, role: true, is_active: true }
  });
  if (!agent?.is_active) throw new Error("agent #5 missing or inactive");
  console.log("agent", agent);

  const rule = await prisma.bonusRule.findFirst({
    where: { tenant_id: tenant.id, name: "5+1", is_active: true },
    select: {
      id: true,
      name: true,
      type: true,
      product_ids: true,
      bonus_product_ids: true,
      scope_agent_user_ids: true,
      valid_from: true,
      valid_to: true
    }
  });
  console.log("rule 5+1", rule);

  const client = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, is_active: true, merged_into_client_id: null },
    select: { id: true, name: true }
  });
  const wh = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id },
    select: { id: true, name: true }
  });
  const triggerId = rule?.product_ids[0];
  if (!client || !wh || !triggerId) throw new Error("missing client/warehouse/trigger product");

  const out = await previewMobileOrderBonus(tenant.id, agent.id, {
    client_id: client.id,
    warehouse_id: wh.id,
    price_type: "1",
    items: [{ product_id: triggerId, qty: 5 }]
  });

  const hit = out.eligible_bonuses.find((b) => b.rule_id === rule?.id || b.name === "5+1");
  console.log("eligible", out.eligible_bonuses.map((b) => `${b.rule_id}:${b.name}:${b.bonus_qty}`));
  console.log(
    "5+1 gifts",
    hit?.gift_products.map((g) => `${g.product_id}:${g.name}:${g.bonus_qty}`)
  );
  if (!hit || hit.bonus_qty <= 0) {
    throw new Error("5+1 not eligible — check cart/agent scope/dates");
  }
  if ((hit.gift_products?.length ?? 0) === 0) {
    throw new Error("5+1 eligible but gift_products empty");
  }
  console.log("ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
