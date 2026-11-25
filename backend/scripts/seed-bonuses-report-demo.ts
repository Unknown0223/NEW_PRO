/**
 * Lokal «По бонусам» review uchun is_bonus order_items seed (idempotent BONUS-SEED comment).
 *
 *   npx tsx scripts/seed-bonuses-report-demo.ts
 *   IMPORT_TENANT_SLUG=aksit npx tsx scripts/seed-bonuses-report-demo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const COMMENT = "BONUS-SEED";

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "aksit").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const deleted = await prisma.order.deleteMany({
    where: { tenant_id: tenant.id, comment: COMMENT }
  });

  const client = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, merged_into_client_id: null, is_active: true },
    select: { id: true, agent_id: true },
    orderBy: { id: "asc" }
  });
  if (!client) throw new Error("Aktiv mijoz yo‘q");

  const agent =
    (client.agent_id
      ? await prisma.user.findFirst({
          where: { id: client.agent_id, tenant_id: tenant.id },
          select: { id: true }
        })
      : null) ??
    (await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      select: { id: true },
      orderBy: { id: "asc" }
    }));

  const products = await prisma.product.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 3
  });
  if (products.length === 0) throw new Error("Mahsulot yo‘q");

  const now = new Date();
  const order = await prisma.order.create({
    data: {
      tenant_id: tenant.id,
      client_id: client.id,
      agent_id: agent?.id ?? null,
      number: `BONUS-SEED-${Date.now()}`,
      status: "delivered",
      order_type: "order",
      comment: COMMENT,
      total_sum: 0,
      created_at: now,
      items: {
        create: products.map((p, i) => ({
          product_id: p.id,
          qty: 1 + i,
          price: 0,
          total: 0,
          is_bonus: true
        }))
      }
    },
    select: { id: true }
  });

  await prisma.orderStatusLog.createMany({
    data: [
      {
        order_id: order.id,
        from_status: "new",
        to_status: "delivering",
        created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000)
      },
      {
        order_id: order.id,
        from_status: "delivering",
        to_status: "delivered",
        created_at: new Date(now.getTime() - 60 * 60 * 1000)
      }
    ]
  });

  console.log(
    JSON.stringify({
      slug,
      tenant_id: tenant.id,
      deleted_prior: deleted.count,
      order_id: order.id,
      bonus_lines: products.length,
      client_id: client.id,
      agent_id: agent?.id ?? null
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
