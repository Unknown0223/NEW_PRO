/**
 * One-time split: mobile.route.agent.ts → mobile.route.agent.*.ts
 * Run: node scripts/split-mobile-agent-routes.mjs
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("src/modules/mobile");
const srcPath = path.join(dir, "mobile.route.agent.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const header = `import type { FastifyInstance } from "fastify";
`;

const slices = [
  {
    file: "mobile.route.agent.config.ts",
    imports: `import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { mobileOrderCreateContextQuerySchema } from "./mobile.route.agent.schemas";
import { getMobileAgentConfigPayload, getMobileOrderCreateContext } from "./mobile.service";
import { mobileAgentConfigPreHandler, mobileOfflineOrderPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileAgentConfigRoutes",
    start: 45,
    end: 92
  },
  {
    file: "mobile.route.agent.orders.ts",
    imports: `import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { getErrorCode } from "../../lib/app-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { previewMobileOrderBonus } from "./mobile-order-bonus-preview.service";
import {
  mobileCreateOrderBodySchema,
  mobileEnqueueBodySchema,
  mobileOrderBonusPreviewBodySchema,
  mobileOrderStockQuerySchema,
  mobileOrdersHistoryQuerySchema,
  mobileWarehouseStockQuerySchema
} from "./mobile.route.agent.schemas";
import {
  createMobileOrder,
  enqueueOrder,
  getMobileAgentOrderDetail,
  getMobileOrderStock,
  getMobileWarehouseStockView,
  getPendingCount,
  listMobileAgentOrdersHistory,
  syncOrders
} from "./mobile.service";
import {
  mobileAgentConfigPreHandler,
  mobileOfflineOrderPreHandler,
  parseDateLike
} from "./mobile.route.shared";
`,
    fn: "registerMobileAgentOrderRoutes",
    start: 93,
    end: 407
  },
  {
    file: "mobile.route.agent.dashboard.ts",
    imports: `import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getMobileAgentDailySales, getMobileAgentDashboard } from "./mobile.service";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileAgentDashboardRoutes",
    start: 408,
    end: 443
  },
  {
    file: "mobile.route.agent.clients.ts",
    imports: `import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { listOrderDebtsReport } from "../reports/order-debts-report.service";
import {
  mobileCreateClientBodySchema,
  mobilePatchClientBodySchema
} from "./mobile.route.agent.schemas";
import {
  createMobileAgentClient,
  listMobileAgentDebtors,
  patchMobileAgentClient
} from "./mobile.service";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileAgentClientRoutes",
    start: 444,
    end: 571
  }
];

for (const slice of slices) {
  const body = lines.slice(slice.start - 1, slice.end).join("\n");
  const content = `${header}${slice.imports}
export async function ${slice.fn}(app: FastifyInstance) {
${body}
}
`;
  fs.writeFileSync(path.join(dir, slice.file), content, "utf8");
  console.log(`Wrote ${slice.file}`);
}

const barrel = `import type { FastifyInstance } from "fastify";
import { registerMobileAgentClientRoutes } from "./mobile.route.agent.clients";
import { registerMobileAgentConfigRoutes } from "./mobile.route.agent.config";
import { registerMobileAgentDashboardRoutes } from "./mobile.route.agent.dashboard";
import { registerMobileAgentOrderRoutes } from "./mobile.route.agent.orders";

export async function registerMobileAgentRoutes(app: FastifyInstance) {
  await registerMobileAgentConfigRoutes(app);
  await registerMobileAgentOrderRoutes(app);
  await registerMobileAgentDashboardRoutes(app);
  await registerMobileAgentClientRoutes(app);
}
`;

fs.writeFileSync(srcPath, barrel, "utf8");
console.log("Replaced mobile.route.agent.ts with barrel");
