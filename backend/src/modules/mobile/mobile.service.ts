/** Barrel re-export — route fayllar `./mobile.service` dan import qiladi. */
export {
  agentScopedClientWhere,
  getMobileAgentConfigPayload,
  getPendingCount,
  registerFcmToken,
  reportMobilePresence,
  syncDelta,
  syncFull,
  syncOrders,
  enqueueOrder
} from "./mobile-agent-sync.service";

export {
  createMobileAgentClient,
  createMobileClientPhotoReport,
  createMobileExpeditorClientPhotoReport,
  deleteMobileClientPhotoReport,
  deleteMobileExpeditorClientPhotoReport,
  linkMobileClientPhotoToOrder,
  listMobileSupervisorAgentLocations,
  patchMobileAgentClient
} from "./mobile-agent-clients.service";

export {
  createMobileOrder,
  getMobileAgentDailySales,
  getMobileAgentDashboard,
  getMobileAgentOrderDetail,
  getMobileOrderCreateContext,
  getMobileOrderStock,
  getMobileWarehouseStockView,
  listMobileAgentClientLedgerBalances,
  listMobileAgentDebtors,
  listMobileAgentOrdersHistory
} from "./mobile-agent-orders.service";
