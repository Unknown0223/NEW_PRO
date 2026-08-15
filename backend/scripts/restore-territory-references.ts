/**
 * Restore wiped tenant.settings.references (territory_nodes + Lalaku refs) for test1.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { runLalakuReferenceImport } from "./lib/lalaku-reference-ensure.ts";
import { buildAccessTerritorySyncPayload, syncTerritoriesFromPayload, invalidateAccessTerritorySyncCache } from "../src/modules/access/access-territories-sync.ts";

const prisma = new PrismaClient();

function countNodes(nodes: any[]): number {
  let n = 0;
  for (const x of nodes ?? []) {
    n += 1;
    if (Array.isArray(x.children)) n += countNodes(x.children);
  }
  return n;
}

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`tenant ${slug} not found`);

  const before = (tenant.settings as any)?.references;
  console.log("BEFORE references keys:", before ? Object.keys(before) : null);

  await runLalakuReferenceImport(prisma, {
    tenantId: tenant.id,
    tenantSlug: slug,
    dry: false
  });

  const afterRow = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { settings: true }
  });
  const refs = (afterRow?.settings as any)?.references ?? {};
  const nodes = refs.territory_nodes ?? [];
  console.log("AFTER references keys:", Object.keys(refs));
  console.log("territory_nodes roots:", Array.isArray(nodes) ? nodes.length : 0);
  console.log("territory_nodes total:", Array.isArray(nodes) ? countNodes(nodes) : 0);

  const payload = buildAccessTerritorySyncPayload(afterRow?.settings);
  invalidateAccessTerritorySyncCache(tenant.id);
  await syncTerritoriesFromPayload(tenant.id, payload);
  console.log("synced territories items:", payload?.items.length ?? 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
