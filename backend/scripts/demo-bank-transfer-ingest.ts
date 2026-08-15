/**
 * Lokal demo: FakeBankTransferAdapter → ingest (1C/bank credentials kerak emas).
 *
 *   npx tsx scripts/demo-bank-transfer-ingest.ts
 *   TENANT_SLUG=test1 npx tsx scripts/demo-bank-transfer-ingest.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  FakeBankTransferAdapter,
  ingestFromAdapter
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.adapters";

const prisma = new PrismaClient();

async function main() {
  const slug = (process.env.TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true }
  });
  if (!tenant) {
    console.error(`Tenant "${slug}" topilmadi. Avval seed qiling.`);
    process.exit(1);
  }

  const sampleClient = await prisma.client.findFirst({
    where: { tenant_id: tenant.id, merged_into_client_id: null, is_active: true },
    select: { id: true, name: true, inn: true, bank_account: true, client_code: true },
    orderBy: { id: "asc" }
  });

  const runId = `demo-bti-${Date.now()}`;
  const adapter = new FakeBankTransferAdapter("bank_api", {
    runId,
    sampleInn: sampleClient?.inn ?? null,
    sampleBankAccount: sampleClient?.bank_account ?? null,
    sampleClientCode: sampleClient?.client_code ?? null
  });

  console.log("TENANT", tenant.slug, tenant.id);
  console.log(
    "SAMPLE_CLIENT",
    sampleClient
      ? `#${sampleClient.id} ${sampleClient.name} inn=${sampleClient.inn ?? "—"}`
      : "none (exact row likely unmatched)"
  );

  const pending = await adapter.fetchPending();
  console.log("FAKE_ROWS", pending.length, pending.map((r) => r.external_id).join(", "));

  const result = await ingestFromAdapter(tenant.id, adapter, null);
  console.log("INGEST_CREATED", result.created, "SKIPPED", result.skipped);
  for (const row of result.results) {
    console.log(
      " ",
      row.status,
      row.external_id ?? "—",
      "inbox=",
      row.inbox_id ?? "—",
      "match=",
      row.match_status ?? "—",
      row.error ? `err=${row.error}` : ""
    );
  }
  console.log("DEMO_BTI_DONE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
