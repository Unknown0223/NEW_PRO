/**
 * Ixtiyoriy polling — default OFF (BANK_TRANSFER_POLL_ENABLED≠1 → skip).
 *
 *   BANK_TRANSFER_POLL_ENABLED=1 npm run poll:bank-transfer-inbox
 *
 * Adapter modes (BANK_TRANSFER_POLL_ADAPTER):
 *   fake     — sample rows (default when USE_FAKE≠0) — local demo only
 *   stub     — empty, no ingest
 *   one_c    — OneCBankTransferAdapter (throws until ONEC_* configured + wired)
 *   bank_api — BankApiBankTransferAdapter (throws until BANK_API_* configured + wired)
 *
 * Haqiqiy 1C/bank live chaqiriq YO‘Q — skeleton “not configured” yoki fake/stub.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  BankTransferAdapterNotConfiguredError,
  ingestFromAdapter,
  resolveBankTransferPollAdapter,
  type ResolvePollAdapterMode
} from "../src/modules/bank-transfer-inbox/bank-transfer-inbox.adapters";

const prisma = new PrismaClient();

function resolveMode(): ResolvePollAdapterMode {
  const raw = (process.env.BANK_TRANSFER_POLL_ADAPTER || "").trim().toLowerCase();
  if (raw === "one_c" || raw === "onec" || raw === "1c") return "one_c";
  if (raw === "bank_api" || raw === "bank") return "bank_api";
  if (raw === "stub") return "stub";
  if (raw === "fake") return "fake";
  // Legacy: BANK_TRANSFER_POLL_USE_FAKE=0 → stub
  if (process.env.BANK_TRANSFER_POLL_USE_FAKE === "0") return "stub";
  return "fake";
}

async function main() {
  if (process.env.BANK_TRANSFER_POLL_ENABLED !== "1") {
    console.log(
      "BANK_TRANSFER_POLL_SKIPPED — set BANK_TRANSFER_POLL_ENABLED=1 to run (default OFF)"
    );
    return;
  }

  const slug = (process.env.TENANT_SLUG || "test1").trim();
  const mode = resolveMode();
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true }
  });
  if (!tenant) {
    console.error(`Tenant "${slug}" topilmadi.`);
    process.exit(1);
  }

  const adapter = resolveBankTransferPollAdapter(mode, {
    runId: `poll-${Date.now()}`
  });

  console.log("POLL_TENANT", tenant.slug, "adapter=", mode);
  try {
    const result = await ingestFromAdapter(tenant.id, adapter, null);
    console.log("POLL_CREATED", result.created, "SKIPPED", result.skipped);
    console.log("BANK_TRANSFER_POLL_DONE");
  } catch (e) {
    if (e instanceof BankTransferAdapterNotConfiguredError) {
      console.error("BANK_TRANSFER_POLL_NOT_CONFIGURED", e.message);
      console.error("missing_env:", e.missingEnv.join(" | "));
      process.exit(2);
    }
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
