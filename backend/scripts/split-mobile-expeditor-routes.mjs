/**
 * One-time split: mobile.route.expeditor.ts → mobile.route.expeditor.*.ts
 * Run: node scripts/split-mobile-expeditor-routes.mjs
 */
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("src/modules/mobile");
const srcPath = path.join(dir, "mobile.route.expeditor.ts");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const header = `import type { FastifyInstance } from "fastify";
`;

const slices = [
  {
    file: "mobile.route.expeditor.deliveries.ts",
    imports: `import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { listMobileExpeditorDeliveries } from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileExpeditorDeliveryRoutes",
    start: 47,
    end: 65
  },
  {
    file: "mobile.route.expeditor.orders.ts",
    imports: `import {
  mobileExpeditorPartialReturnBodySchema,
  mobileExpeditorPaymentBodySchema,
  mobileExpeditorReloadBodySchema
} from "../../contracts/mobile.schemas";
import { patchOrderStatusBodySchema } from "../../contracts/orders.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  createMobileExpeditorOrderPayment,
  createMobileExpeditorPartialReturn,
  createMobileExpeditorReloadFromVehicle,
  getMobileExpeditorOrderDetail,
  getMobileExpeditorPaymentContext,
  patchMobileExpeditorOrderStatus
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileExpeditorOrderRoutes",
    start: 66,
    end: 317
  },
  {
    file: "mobile.route.expeditor.returns.ts",
    imports: `import {
  mobileExpeditorReturnByOrderBodySchema,
  mobileExpeditorReturnByOrderPreviewBodySchema
} from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  createMobileExpeditorReturnByOrder,
  getMobileExpeditorReturnByOrderComposition,
  listMobileExpeditorReturnByOrderOrders,
  listMobileExpeditorReturns,
  previewMobileExpeditorReturnByOrder
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileExpeditorReturnRoutes",
    start: 318,
    end: 532
  },
  {
    file: "mobile.route.expeditor.dashboard.ts",
    imports: `import { mobileExpeditorClientLocationBodySchema } from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  getMobileExpeditorDashboard,
  listMobileExpeditorDebtors,
  listMobileExpeditorReturnedPayments,
  listMobileExpeditorVisits,
  patchMobileExpeditorClientLocation
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileExpeditorDashboardRoutes",
    start: 533,
    end: 640
  },
  {
    file: "mobile.route.expeditor.clients.ts",
    imports: `import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  getMobileExpeditorClientBalanceDetail,
  getMobileExpeditorClientDetail,
  getMobileExpeditorClientLedger,
  listMobileExpeditorClientOrders
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileExpeditorClientRoutes",
    start: 641,
    end: 739
  },
  {
    file: "mobile.route.expeditor.shipments.ts",
    imports: `import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  confirmMobileExpeditorShipmentDocument,
  getMobileExpeditorShipmentDocumentDetail,
  getMobileExpeditorVehicleStock,
  listMobileExpeditorPayments,
  listMobileExpeditorShipmentDocuments,
  listMobileExpeditorWarehouses
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`,
    fn: "registerMobileExpeditorShipmentRoutes",
    start: 740,
    end: 861
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
import { registerMobileExpeditorClientRoutes } from "./mobile.route.expeditor.clients";
import { registerMobileExpeditorDashboardRoutes } from "./mobile.route.expeditor.dashboard";
import { registerMobileExpeditorDeliveryRoutes } from "./mobile.route.expeditor.deliveries";
import { registerMobileExpeditorOrderRoutes } from "./mobile.route.expeditor.orders";
import { registerMobileExpeditorReturnRoutes } from "./mobile.route.expeditor.returns";
import { registerMobileExpeditorShipmentRoutes } from "./mobile.route.expeditor.shipments";

export async function registerMobileExpeditorRoutes(app: FastifyInstance) {
  await registerMobileExpeditorDeliveryRoutes(app);
  await registerMobileExpeditorOrderRoutes(app);
  await registerMobileExpeditorReturnRoutes(app);
  await registerMobileExpeditorDashboardRoutes(app);
  await registerMobileExpeditorClientRoutes(app);
  await registerMobileExpeditorShipmentRoutes(app);
}
`;

fs.writeFileSync(srcPath, barrel, "utf8");
console.log("Replaced mobile.route.expeditor.ts with barrel");
