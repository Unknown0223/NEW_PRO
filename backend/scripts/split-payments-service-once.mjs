import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../src/modules/payments");
const backup = path.join(dir, "payments.service.backup.ts");
const lines = fs.readFileSync(backup, "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");
const header = slice(1, 17);

let queryBody = slice(339, 1124);
queryBody = queryBody
  .replace(/^function paymentListInclude/m, "export function paymentListInclude")
  .replace(/^function mapPaymentToListRow/m, "export function mapPaymentToListRow")
  .replace(/^async function getPaymentDetail/m, "export async function getPaymentDetail")
  .replace(/^async function resolveLedgerAgentId/m, "export async function resolveLedgerAgentId");

fs.writeFileSync(path.join(dir, "payment.query.ts"), `${header}\n${queryBody}\n`);

fs.writeFileSync(
  path.join(dir, "payment.balance.ts"),
  `${header}
import { getPaymentDetail, type PaymentDetailPayload } from "./payment.query";

${slice(18, 338)}
`
);

fs.writeFileSync(
  path.join(dir, "payment.create.ts"),
  `${header}
import type { CreatePaymentInput, PaymentListRow } from "./payment.query";
import {
  getPaymentDetail,
  mapPaymentToListRow,
  paymentListInclude,
  resolveLedgerAgentId
} from "./payment.query";

${slice(1126, lines.length)}
`
);

fs.writeFileSync(
  path.join(dir, "payment.consignment.ts"),
  `${header}
export type PaymentDealTypeFilter = "regular" | "consignment" | "both";
`
);

fs.writeFileSync(
  path.join(dir, "payments.service.ts"),
  `export * from "./payment.balance";
export * from "./payment.consignment";
export * from "./payment.query";
export * from "./payment.create";
export * from "./payment-allocations.service";
`
);

console.log("Payments split done.");
