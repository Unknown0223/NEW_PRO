/**
 * client-balance-ledger.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clients = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/clients");
const backupPath = path.join(clients, "client-balance-ledger.service.backup.ts");
const srcPath = path.join(clients, "client-balance-ledger.service.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}
function exportFns(body) {
  return body.replace(/^function /gm, "export function ").replace(/^async function /gm, "export async function ");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = slice(lines, 1, 15);

w(
  path.join(clients, "client-balance-ledger.types.ts"),
  `${hdr}
${slice(lines, 16, 110)}

${slice(lines, 218, 237).replace(/^type UnionRaw /m, "export type UnionRaw ")}
`
);

w(
  path.join(clients, "client-balance-ledger.helpers.ts"),
  `${hdr}
import type { ClientBalancePaymentTypeSummary, ClientLedgerQuery, ClientLedgerRow } from "./client-balance-ledger.types";
import type { UnionRaw } from "./client-balance-ledger.types";

${exportFns(slice(lines, 112, 217))}

${exportFns(slice(lines, 239, 294))}
`
);

w(
  path.join(clients, "client-balance-ledger.agents.ts"),
  `${hdr}
import type { AgentBalanceCard } from "./client-balance-ledger.types";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import { normPayTypeKey, paymentAmountsForSpravochnik } from "./client-balance-ledger.helpers";

export async function buildLedgerAgentCards(
  tenantId: number,
  clientId: number,
  sprLabels: string[],
  paymentMethodEntries: PaymentMethodEntryDto[]
): Promise<{ agent_cards: AgentBalanceCard[] }> {
${slice(lines, 333, 469)}
  return { agent_cards };
}
`
);

const getImports = `${hdr}
import type { AgentBalanceCard, ClientBalanceLedgerResponse, ClientLedgerQuery, UnionRaw } from "./client-balance-ledger.types";
import {
  buildLedgerAgentSqlClauses,
  buildNetNormFromRows,
  loadTenantLedgerPaymentContext,
  mapUnionToLedgerRow,
  paymentAmountsForSpravochnik,
  resolveLedgerAgentFilter,
  territoryLabel
} from "./client-balance-ledger.helpers";
import { buildLedgerAgentCards } from "./client-balance-ledger.agents";

export async function getClientBalanceLedger(
  tenantId: number,
  clientId: number,
  q: ClientLedgerQuery
): Promise<ClientBalanceLedgerResponse> {
`;

w(
  path.join(clients, "client-balance-ledger.get.ts"),
  [
    getImports,
    slice(lines, 301, 331),
    "  const { agent_cards } = await buildLedgerAgentCards(tenantId, clientId, sprLabels, paymentMethodEntries);",
    '  const excluded = ["cancelled", "returned"] as const;',
    slice(lines, 471, 653),
    slice(lines, 655, 814)
  ].join("\n")
);

w(
  path.join(clients, "client-balance-ledger.service.ts"),
  `export * from "./client-balance-ledger.types";
export * from "./client-balance-ledger.helpers";
export * from "./client-balance-ledger.agents";
export * from "./client-balance-ledger.get";
`
);

console.log("Phase 57 client-balance-ledger split done.");
