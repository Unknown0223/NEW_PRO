/**
 * Lokal «По инвентарю» review uchun client_equipment seed (idempotent INV-SEED-*).
 *
 *   npx tsx scripts/seed-inventory-report-demo.ts
 *   IMPORT_TENANT_SLUG=aksit npx tsx scripts/seed-inventory-report-demo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PREFIX = "INV-SEED-";
const TYPES = ["Холодильник", "Стелаж", "Морозильник"] as const;

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "aksit").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const deleted = await prisma.clientEquipment.deleteMany({
    where: { tenant_id: tenant.id, inventory_number: { startsWith: PREFIX } }
  });

  let clients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, merged_into_client_id: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 5
  });

  // Need ≥3 clients for review rows; create demo clients if sparse.
  while (clients.length < 3) {
    const n = clients.length + 1;
    const created = await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: `INV-SEED Demo ${n}`,
        phone: `90000000${n}`,
        address: `Demo address ${n}`,
        city: "Andijon",
        is_active: true
      },
      select: { id: true, name: true }
    });
    clients = [...clients, created];
  }

  let equipment_inserted = 0;
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]!;
    const type = TYPES[i % TYPES.length]!;
    await prisma.clientEquipment.create({
      data: {
        tenant_id: tenant.id,
        client_id: client.id,
        inventory_type: type,
        inventory_number: `${PREFIX}${client.id}-${i + 1}`,
        note: "demo seed for /reports/inventory"
      }
    });
    equipment_inserted += 1;
  }

  console.log(
    JSON.stringify({
      slug,
      tenant_id: tenant.id,
      deleted_prior: deleted.count,
      equipment_inserted,
      clients: clients.map((c) => c.id)
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
