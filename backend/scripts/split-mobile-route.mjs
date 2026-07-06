import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const srcPath = join(dir, "../src/modules/mobile/mobile.route.ts");
const lines = readFileSync(srcPath, "utf8").split(/\r?\n/);

function sliceRoutes(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join("\n");
}

const shared = `import { jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";
import {
  MOBILE_FIELD_ROLE_NAMES,
  requireActiveMobileSession,
  requireMobileAppAccess
} from "../auth/app-access.service";

/** Mobil foto: agent/ekspeditor o'z rolidagi + faqat bugungi kun. */
export function mobilePhotoReportListOpts(viewer: { role: string }) {
  const viewerRole =
    viewer.role === "agent" || viewer.role === "expeditor" ? viewer.role : null;
  return { viewerRole, todayOnly: true as const };
}

/** Agent-konfig — zakazlar/mijozlar/konfig kalitlari. */
export const MOBILE_AGENT_CONFIG_ANY = [
  "orders.view",
  "orders.create",
  "orders.zakaz.spisok_zakazov",
  "orders.zakaz.prosmotr_zakaza",
  "orders.zakaz.sozdanie_zakaza",
  "clients.spisok_klientov",
  "clients.prosmotr_profilya_klienta",
  "staff.agent.konfiguratsii",
  "staff.agent.prosmotr_agenta"
] as const;

/** Sinxron + FCM — sklad + dashboard (supervisor mobil). */
export const MOBILE_SYNC_AND_PUSH_ANY = [
  ...MOBILE_AGENT_CONFIG_ANY,
  "warehouse.view",
  "dashboard.view",
  "dashboard.supervayzer",
  "dashboard.prodazhi"
] as const;

/** Oflayn navbat / enqueue — zakaz yaratish. */
export const MOBILE_OFFLINE_ORDER_ANY = ["orders.create", "orders.zakaz.sozdanie_zakaza"] as const;

export const mobileJwtRoles = [
  jwtAccessVerify,
  requireRoles(...MOBILE_FIELD_ROLE_NAMES),
  requireMobileAppAccess,
  requireActiveMobileSession
] as const;

export const mobileAgentConfigPreHandler = [
  ...mobileJwtRoles,
  requireAnyPermission([...MOBILE_AGENT_CONFIG_ANY])
] as const;

export const mobileSyncPreHandler = [
  ...mobileJwtRoles,
  requireAnyPermission([...MOBILE_SYNC_AND_PUSH_ANY])
] as const;

export const mobileOfflineOrderPreHandler = [
  ...mobileJwtRoles,
  requireAnyPermission([...MOBILE_OFFLINE_ORDER_ANY])
] as const;

export function parseDateLike(raw: string | null | undefined): Date | null | undefined {
  if (!raw) return null;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}
`;

const publicImports = `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { mobileApkExists, openMobileApkReadStream } from "./mobile-apk.service";
`;

const commonImports = `import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  mobileChangePasswordBodySchema,
  mobileClientPhotoBodySchema,
  mobileClientPhotoLinkBodySchema,
  mobilePatchProfileBodySchema,
  mobilePresenceBodySchema,
  mobileRegisterFcmBodySchema,
  mobileSyncDeltaBodySchema,
  mobileSyncFullBodySchema
} from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import {
  createOrderCashInBodySchema,
  orderCashInContextQuerySchema
} from "../../contracts/payments.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { bindQrByCode, unbindQrByCode } from "../client-qr/client-qr.write";
import { getClientPhotoReportById, listClientPhotoReports } from "../clients/client-assets.service";
import {
  createOrderCashInBatch,
  getOrderCashInContext
} from "../payments/payment.order-cash-in";
import {
  changeMobileMePassword,
  getMobileMeProfile,
  patchMobileMeProfile
} from "./mobile-profile.service";
import { recordMobileStockSnapshot } from "./mobile-order-policy";
import {
  createMobileClientPhotoReport,
  createMobileExpeditorClientPhotoReport,
  deleteMobileClientPhotoReport,
  deleteMobileExpeditorClientPhotoReport,
  linkMobileClientPhotoToOrder,
  registerFcmToken,
  reportMobilePresence,
  syncDelta,
  syncFull
} from "./mobile.service";
import {
  mobileAgentConfigPreHandler,
  mobileOfflineOrderPreHandler,
  mobilePhotoReportListOpts,
  mobileSyncPreHandler,
  parseDateLike
} from "./mobile.route.shared";
`;

const agentImports = `import type { FastifyInstance } from "fastify";
import {
  mobileCreateClientBodySchema,
  mobileCreateOrderBodySchema,
  mobileEnqueueBodySchema,
  mobileOrderBonusPreviewBodySchema,
  mobileOrderCreateContextQuerySchema,
  mobileOrderStockQuerySchema,
  mobileOrdersHistoryQuerySchema,
  mobilePatchClientBodySchema,
  mobileWarehouseStockQuerySchema
} from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { getErrorCode } from "../../lib/app-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { listOrderDebtsReport } from "../reports/order-debts-report.service";
import { previewMobileOrderBonus } from "./mobile-order-bonus-preview.service";
import {
  createMobileAgentClient,
  createMobileOrder,
  enqueueOrder,
  getMobileAgentConfigPayload,
  getMobileAgentDailySales,
  getMobileAgentDashboard,
  getMobileAgentOrderDetail,
  getMobileOrderCreateContext,
  getMobileOrderStock,
  getMobileWarehouseStockView,
  getPendingCount,
  listMobileAgentDebtors,
  listMobileAgentOrdersHistory,
  patchMobileAgentClient,
  syncOrders
} from "./mobile.service";
import {
  mobileAgentConfigPreHandler,
  mobileOfflineOrderPreHandler
} from "./mobile.route.shared";
`;

const expeditorImports = `import type { FastifyInstance } from "fastify";
import {
  mobileExpeditorClientLocationBodySchema,
  mobileExpeditorPartialReturnBodySchema,
  mobileExpeditorPaymentBodySchema,
  mobileExpeditorReloadBodySchema,
  mobileExpeditorReturnByOrderBodySchema,
  mobileExpeditorReturnByOrderPreviewBodySchema
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
  createMobileExpeditorReturnByOrder,
  getMobileExpeditorOrderDetail,
  getMobileExpeditorPaymentContext,
  getMobileExpeditorReturnByOrderComposition,
  listMobileExpeditorDeliveries,
  listMobileExpeditorReturnByOrderOrders,
  listMobileExpeditorReturns,
  patchMobileExpeditorClientLocation,
  patchMobileExpeditorOrderStatus,
  previewMobileExpeditorReturnByOrder
} from "./mobile.expeditor.service";
import {
  confirmMobileExpeditorShipmentDocument,
  getMobileExpeditorClientBalanceDetail,
  getMobileExpeditorClientDetail,
  getMobileExpeditorClientLedger,
  getMobileExpeditorDashboard,
  getMobileExpeditorShipmentDocumentDetail,
  getMobileExpeditorVehicleStock,
  listMobileExpeditorClientOrders,
  listMobileExpeditorDebtors,
  listMobileExpeditorPayments,
  listMobileExpeditorReturnedPayments,
  listMobileExpeditorShipmentDocuments,
  listMobileExpeditorVisits,
  listMobileExpeditorWarehouses
} from "./mobile.expeditor.workflow.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`;

const supervisorImports = `import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { applySupervisorSelfScope } from "../dashboard/dashboard.routes.shared";
import {
  getSupervisorProducts,
  getSupervisorSummary,
  getSupervisorVisits
} from "../dashboard/dashboard.supervisor.snapshot.partials";
import { parseSupervisorDashboardFilters } from "../dashboard/dashboard.supervisor.scope";
import { listMobileSupervisorAgentLocations } from "./mobile.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";
`;

function wrap(name, imports, body) {
  return `${imports}
export async function ${name}(app: FastifyInstance) {
${body}
}
`;
}

const outDir = join(dir, "../src/modules/mobile");

writeFileSync(join(outDir, "mobile.route.shared.ts"), shared);

writeFileSync(
  join(outDir, "mobile.route.public.ts"),
  wrap("registerMobilePublicRoutes", publicImports, sliceRoutes(180, 230))
);

writeFileSync(
  join(outDir, "mobile.route.common.ts"),
  wrap(
    "registerMobileCommonRoutes",
    commonImports,
    [sliceRoutes(266, 435), sliceRoutes(1831, 2172)].join("\n\n")
  )
);

writeFileSync(
  join(outDir, "mobile.route.agent.ts"),
  wrap(
    "registerMobileAgentRoutes",
    agentImports,
    [sliceRoutes(235, 260), sliceRoutes(440, 939)].join("\n\n")
  )
);

writeFileSync(
  join(outDir, "mobile.route.expeditor.ts"),
  wrap("registerMobileExpeditorRoutes", expeditorImports, sliceRoutes(944, 1758))
);

writeFileSync(
  join(outDir, "mobile.route.supervisor.ts"),
  wrap("registerMobileSupervisorRoutes", supervisorImports, sliceRoutes(1763, 1826))
);

const hub = `import type { FastifyInstance } from "fastify";
import { registerMobileAgentRoutes } from "./mobile.route.agent";
import { registerMobileCommonRoutes } from "./mobile.route.common";
import { registerMobileExpeditorRoutes } from "./mobile.route.expeditor";
import { registerMobilePublicRoutes } from "./mobile.route.public";
import { registerMobileSupervisorRoutes } from "./mobile.route.supervisor";

export async function registerMobileRoutes(app: FastifyInstance) {
  await registerMobilePublicRoutes(app);
  await registerMobileAgentRoutes(app);
  await registerMobileCommonRoutes(app);
  await registerMobileExpeditorRoutes(app);
  await registerMobileSupervisorRoutes(app);
}
`;

writeFileSync(join(outDir, "mobile.route.ts"), hub);
console.log("Split complete");
