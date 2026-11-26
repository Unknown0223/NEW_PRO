/**
 * Lokal «По визитам» review: dedicated VISITS-SEED client + CAA + agent_visits.
 * Mavjud boshqa mijoz/reja/agent_id ni o‘zgartirmaydi. Faqat localhost DB.
 *
 *   npx tsx scripts/seed-visits-report-demo.ts
 *   IMPORT_TENANT_SLUG=aksit npx tsx scripts/seed-visits-report-demo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  VISITS_SEED_CLIENT_NAME,
  VISITS_SEED_NOTE,
  isLocalDatabaseUrl
} from "../src/modules/reports/visits-report.seed-meta";

const prisma = new PrismaClient();
const CLIENT_CODE = "VISITS-SEED";

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!isLocalDatabaseUrl(dbUrl)) {
    throw new Error("seed-visits-report-demo: faqat localhost DATABASE_URL");
  }

  const slug = (process.env.IMPORT_TENANT_SLUG || process.env.SEED_TENANT_SLUG || "aksit").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const agent =
    (await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: "agent", is_active: true, code: "AGSHIP" },
      select: { id: true, name: true }
    })) ??
    (await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" }
    }));
  if (!agent) throw new Error("Agent yo‘q");

  let client = await prisma.client.findFirst({
    where: {
      tenant_id: tenant.id,
      OR: [{ client_code: CLIENT_CODE }, { name: VISITS_SEED_CLIENT_NAME }]
    },
    select: { id: true, name: true }
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: VISITS_SEED_CLIENT_NAME,
        client_code: CLIENT_CODE,
        agent_id: agent.id,
        is_active: true,
        city: "Andijon"
      },
      select: { id: true, name: true }
    });
  } else {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        agent_id: agent.id,
        name: VISITS_SEED_CLIENT_NAME,
        client_code: CLIENT_CODE
      }
    });
  }

  const deletedVisits = await prisma.agentVisit.deleteMany({
    where: { tenant_id: tenant.id, notes: { startsWith: VISITS_SEED_NOTE } }
  });

  const now = new Date();
  const visitDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));

  const existingCaa = await prisma.clientAgentAssignment.findFirst({
    where: { tenant_id: tenant.id, client_id: client.id, slot: 1 },
    select: { id: true }
  });

  let caaId: number;
  if (existingCaa) {
    await prisma.clientAgentAssignment.update({
      where: { id: existingCaa.id },
      data: {
        agent_id: agent.id,
        visit_date: visitDate,
        visit_weekdays: [1, 2, 3, 4, 5, 6, 7]
      }
    });
    caaId = existingCaa.id;
  } else {
    const created = await prisma.clientAgentAssignment.create({
      data: {
        tenant_id: tenant.id,
        client_id: client.id,
        agent_id: agent.id,
        slot: 1,
        visit_date: visitDate,
        visit_weekdays: [1, 2, 3, 4, 5, 6, 7]
      },
      select: { id: true }
    });
    caaId = created.id;
  }

  const visit = await prisma.agentVisit.create({
    data: {
      tenant_id: tenant.id,
      agent_id: agent.id,
      client_id: client.id,
      checked_in_at: visitDate,
      notes: VISITS_SEED_NOTE
    },
    select: { id: true }
  });

  console.log(
    JSON.stringify({
      slug,
      agent_id: agent.id,
      client_id: client.id,
      client_name: client.name,
      caa_id: caaId,
      visit_id: visit.id,
      deleted_old_visits: deletedVisits.count
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
