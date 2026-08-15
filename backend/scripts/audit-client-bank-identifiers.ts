/**
 * Fase 0 — mijoz bank/INN ma’lumotlari auditi (o‘chirmaydi / mass-edit qilmaydi).
 * Hisobot: INN/bank_account yo‘q; tenant ichida dublikat INN/PINFL/hisob.
 * CSV eksport: backend/scripts/out/bank-id-audit-<slug>-*.csv
 *
 * Usage: npx tsx scripts/audit-client-bank-identifiers.ts [tenantSlug=test1]
 *        npm run audit:client-bank-ids -- test1
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/database";

type ClientRow = {
  id: number;
  name: string;
  is_active: boolean;
  inn: string | null;
  client_pinfl: string | null;
  bank_account: string | null;
  bank_mfo: string | null;
  client_code: string | null;
  warehouse_id: number | null;
};

function normDigits(v: string | null | undefined): string | null {
  if (v == null) return null;
  const d = String(v).replace(/\D/g, "");
  // Placeholder «0» / «000…» — dublikat emas, skip
  if (!d || /^0+$/.test(d)) return null;
  return d;
}

function normAccount(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).replace(/\s+/g, "").trim();
  return t.length > 0 ? t : null;
}

function csvEscape(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(","))
  ];
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function clientCsvRow(c: ClientRow): Array<string | number | boolean | null> {
  return [
    c.id,
    c.is_active,
    c.client_code,
    c.name,
    c.inn,
    c.client_pinfl,
    c.bank_account,
    c.bank_mfo,
    c.warehouse_id
  ];
}

const CLIENT_HEADERS = [
  "client_id",
  "is_active",
  "client_code",
  "name",
  "inn",
  "pinfl",
  "bank_account",
  "bank_mfo",
  "warehouse_id"
];

async function main() {
  const slug = process.argv[2]?.trim() || "test1";
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  const clients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, merged_into_client_id: null },
    select: {
      id: true,
      name: true,
      is_active: true,
      inn: true,
      client_pinfl: true,
      bank_account: true,
      bank_mfo: true,
      client_code: true,
      warehouse_id: true
    },
    orderBy: { id: "asc" }
  });

  const byId = new Map(clients.map((c) => [c.id, c]));
  const missingInn: ClientRow[] = [];
  const missingBank: ClientRow[] = [];
  const missingBoth: ClientRow[] = [];

  const innMap = new Map<string, number[]>();
  const pinflMap = new Map<string, number[]>();
  const accountMap = new Map<string, number[]>();

  for (const c of clients) {
    const inn = normDigits(c.inn);
    const pinfl = normDigits(c.client_pinfl);
    const acct = normAccount(c.bank_account);
    const noInn = !inn;
    const noBank = !acct;
    if (noInn) missingInn.push(c);
    if (noBank) missingBank.push(c);
    if (noInn && noBank) missingBoth.push(c);
    if (inn) {
      const arr = innMap.get(inn) ?? [];
      arr.push(c.id);
      innMap.set(inn, arr);
    }
    if (pinfl) {
      const arr = pinflMap.get(pinfl) ?? [];
      arr.push(c.id);
      pinflMap.set(pinfl, arr);
    }
    if (acct) {
      const arr = accountMap.get(acct) ?? [];
      arr.push(c.id);
      accountMap.set(acct, arr);
    }
  }

  const dupInns = [...innMap.entries()].filter(([, ids]) => ids.length > 1);
  const dupPinfls = [...pinflMap.entries()].filter(([, ids]) => ids.length > 1);
  const dupAccounts = [...accountMap.entries()].filter(([, ids]) => ids.length > 1);

  const outDir = path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const prefix = path.join(outDir, `bank-id-audit-${slug}-${stamp}`);

  writeCsv(
    `${prefix}-missing-inn.csv`,
    CLIENT_HEADERS,
    missingInn.map(clientCsvRow)
  );
  writeCsv(
    `${prefix}-missing-bank-account.csv`,
    CLIENT_HEADERS,
    missingBank.map(clientCsvRow)
  );
  writeCsv(
    `${prefix}-missing-inn-and-bank.csv`,
    CLIENT_HEADERS,
    missingBoth.map(clientCsvRow)
  );

  const dupInnRows: Array<Array<string | number | boolean | null>> = [];
  for (const [inn, ids] of dupInns) {
    for (const id of ids) {
      const c = byId.get(id)!;
      dupInnRows.push([inn, ids.length, ids.join("|"), ...clientCsvRow(c)]);
    }
  }
  writeCsv(
    `${prefix}-duplicate-inn.csv`,
    ["dup_inn", "group_size", "client_ids", ...CLIENT_HEADERS],
    dupInnRows
  );

  const dupPinflRows: Array<Array<string | number | boolean | null>> = [];
  for (const [pinfl, ids] of dupPinfls) {
    for (const id of ids) {
      const c = byId.get(id)!;
      dupPinflRows.push([pinfl, ids.length, ids.join("|"), ...clientCsvRow(c)]);
    }
  }
  writeCsv(
    `${prefix}-duplicate-pinfl.csv`,
    ["dup_pinfl", "group_size", "client_ids", ...CLIENT_HEADERS],
    dupPinflRows
  );

  const dupAcctRows: Array<Array<string | number | boolean | null>> = [];
  for (const [acct, ids] of dupAccounts) {
    for (const id of ids) {
      const c = byId.get(id)!;
      dupAcctRows.push([acct, ids.length, ids.join("|"), ...clientCsvRow(c)]);
    }
  }
  writeCsv(
    `${prefix}-duplicate-bank-account.csv`,
    ["dup_bank_account", "group_size", "client_ids", ...CLIENT_HEADERS],
    dupAcctRows
  );

  const summary = {
    tenant_slug: slug,
    tenant_id: tenant.id,
    generated_at: new Date().toISOString(),
    clients_total: clients.length,
    clients_active: clients.filter((c) => c.is_active).length,
    missing_inn: missingInn.length,
    missing_bank_account: missingBank.length,
    missing_inn_and_bank: missingBoth.length,
    duplicate_inn_groups: dupInns.length,
    duplicate_pinfl_groups: dupPinfls.length,
    duplicate_bank_account_groups: dupAccounts.length,
    note: "Mass-edit yo‘q — CSV ni qo‘lda tuzating. Matcher: bank_account > inn/pinfl > client_code; nom bo‘yicha avto-match yo‘q."
  };
  fs.writeFileSync(`${prefix}-summary.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const active = clients.filter((c) => c.is_active);
  console.log(`Tenant: ${slug} (id=${tenant.id})`);
  console.log(`Mijozlar (merged emas): ${clients.length} (faol: ${active.length})`);
  console.log("");
  console.log("=== Yetishmovchilik ===");
  console.log(`INN yo‘q: ${missingInn.length}`);
  console.log(`bank_account yo‘q: ${missingBank.length}`);
  console.log(`INN va bank_account yo‘q: ${missingBoth.length}`);
  console.log("");
  console.log("=== Dublikatlar (tenant ichida) ===");
  console.log(`Dublikat INN guruhlari: ${dupInns.length}`);
  for (const [inn, ids] of dupInns.slice(0, 20)) {
    console.log(`  INN ${inn} → client_ids=[${ids.join(",")}]`);
  }
  if (dupInns.length > 20) console.log(`  ... +${dupInns.length - 20} guruh`);
  console.log(`Dublikat PINFL guruhlari: ${dupPinfls.length}`);
  for (const [pinfl, ids] of dupPinfls.slice(0, 15)) {
    console.log(`  PINFL ${pinfl} → client_ids=[${ids.join(",")}]`);
  }
  console.log(`Dublikat bank_account guruhlari: ${dupAccounts.length}`);
  for (const [acct, ids] of dupAccounts.slice(0, 15)) {
    console.log(`  ACC ${acct} → client_ids=[${ids.join(",")}]`);
  }
  console.log("");
  console.log("CSV / JSON eksport (mass-edit qilinmadi):");
  console.log(`  ${prefix}-missing-inn.csv`);
  console.log(`  ${prefix}-missing-bank-account.csv`);
  console.log(`  ${prefix}-missing-inn-and-bank.csv`);
  console.log(`  ${prefix}-duplicate-inn.csv`);
  console.log(`  ${prefix}-duplicate-pinfl.csv`);
  console.log(`  ${prefix}-duplicate-bank-account.csv`);
  console.log(`  ${prefix}-summary.json`);
  console.log("");
  console.log(
    "Yo‘riqnoma: Bank Transfer Inbox matcher bank_account > inn/pinfl > client_code. Nom bo‘yicha avto-match yo‘q. Dublikat INN/hisob — ambiguous."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
