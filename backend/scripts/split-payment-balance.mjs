/**
 * Split payment.balance.ts → void + pending + barrel
 */
import fs from "node:fs";
import path from "node:path";

const payDir = path.resolve("src/modules/payments");
const srcPath = path.join(payDir, "payment.balance.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const header = lines.slice(0, 20).join("\n");

const voidBody = lines.slice(21, 225).join("\n");
fs.writeFileSync(
  path.join(payDir, "payment.balance.void.ts"),
  `${header}

${voidBody}
`,
  "utf8"
);

const pendingHeader = `${header}
import { getPaymentDetail, type PaymentDetailPayload } from "./payment.query";
`;

const pendingBody = lines.slice(226, 547).join("\n");
fs.writeFileSync(
  path.join(payDir, "payment.balance.pending.ts"),
  `${pendingHeader}

${pendingBody}
`,
  "utf8"
);

fs.writeFileSync(
  srcPath,
  `export * from "./payment.balance.void";
export * from "./payment.balance.pending";
`,
  "utf8"
);

console.log("Split payment.balance.ts");
