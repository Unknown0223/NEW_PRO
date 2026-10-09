/**
 * test1: mijoz import — bo‘sh ИД (auto) + explicit ИД upsert.
 * Usage: npx tsx scripts/smoke-client-import-id.ts
 */
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { importClientsFromXlsx } from "../src/modules/clients/clients.import.main";

const prisma = new PrismaClient();
const MARKER = `SMOKE_IMPORT_ID_${Date.now()}`;

function buildXlsx(rows: (string | number)[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "test1", is_active: true },
    select: { id: true, slug: true }
  });
  if (!tenant) throw new Error("TENANT_test1_NOT_FOUND");

  const max = await prisma.client.aggregate({
    where: { tenant_id: tenant.id },
    _max: { id: true }
  });
  const explicitId = (max._max.id ?? 1_000_000) + 50_000;
  const nameAuto = `${MARKER}_AUTO`;
  const nameExplicit = `${MARKER}_EXPLICIT`;
  const nameUpdate = `${MARKER}_UPDATED`;

  console.log(`TENANT=${tenant.slug} id=${tenant.id} explicitId=${explicitId}`);

  // 1) create: empty ID → auto; explicit ID → that id
  const buf1 = buildXlsx([
    ["ИД", "Наименование", "Телефон"],
    ["", nameAuto, "+998900000001"],
    [explicitId, nameExplicit, "+998900000002"]
  ]);
  const r1 = await importClientsFromXlsx(tenant.id, buf1, { importMode: "create" });
  console.log("CREATE_RESULT", JSON.stringify({ created: r1.created, updated: r1.updated, errors: r1.errors }));

  const auto = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, name: nameAuto },
    select: { id: true, name: true }
  });
  const explicit = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, id: explicitId },
    select: { id: true, name: true }
  });

  if (!auto) throw new Error("AUTO_ID_CLIENT_MISSING");
  if (!explicit || explicit.name !== nameExplicit) throw new Error("EXPLICIT_ID_CLIENT_MISSING");
  console.log("AUTO_OK", auto.id);
  console.log("EXPLICIT_OK", explicit.id);

  // 2) create again with same explicit id → should update
  const buf2 = buildXlsx([
    ["ИД", "Наименование", "Телефон"],
    [explicitId, nameUpdate, "+998900000003"]
  ]);
  const r2 = await importClientsFromXlsx(tenant.id, buf2, { importMode: "create" });
  console.log("UPSERT_RESULT", JSON.stringify({ created: r2.created, updated: r2.updated, errors: r2.errors }));

  const after = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, id: explicitId },
    select: { id: true, name: true, phone: true }
  });
  if (!after || after.name !== nameUpdate) throw new Error("UPSERT_FAILED");
  console.log("UPSERT_OK", after);

  // cleanup
  await prisma.client.deleteMany({
    where: { tenant_id: tenant.id, name: { startsWith: MARKER } }
  });
  await prisma.client.deleteMany({
    where: { tenant_id: tenant.id, id: explicitId }
  });
  console.log("CLEANUP_OK");
  console.log("SMOKE_CLIENT_IMPORT_ID_PASS");
}

main()
  .catch((e) => {
    console.error("SMOKE_FAIL", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
