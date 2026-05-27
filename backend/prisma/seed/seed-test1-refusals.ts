import { prisma } from "./helpers";

/** «Отказы» sahifasi uchun demo yozuvlar (bo‘sh bo‘lsa) */
export async function seedTest1ClientRefusals(tenantId: number, agentId: number) {
  const existing = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM client_refusals WHERE tenant_id = ${tenantId}
  `;
  if ((existing[0]?.count ?? 0) > 0) return;

  const clients = await prisma.client.findMany({
    where: { tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true, name: true, zone: true },
    take: 4,
    orderBy: { id: "asc" }
  });
  if (clients.length === 0) return;

  const reasons = ["CLIENT_REF", "QUALITY", "PRICE", "CLIENT_REF"] as const;
  const now = new Date();
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]!;
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - i);
    await prisma.$executeRaw`
      INSERT INTO client_refusals (
        tenant_id, client_id, agent_id, refusal_reason_ref, territory, comment, created_at
      ) VALUES (
        ${tenantId},
        ${client.id},
        ${agentId},
        ${reasons[i % reasons.length]},
        ${client.zone?.trim() || "Toshkent"},
        ${`Seed: ${client.name}`},
        ${createdAt}
      )
    `;
  }
}
