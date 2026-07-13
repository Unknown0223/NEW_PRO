/** Barrel re-export — agent sync domain (Q-09 split). */
export {
  agentScopedClientWhere,
  agentScopedOrderWhere,
  assertAgentScopedClient,
  assertMobilePhotoReportForClient,
  clientSyncSelect,
  compactClient,
  getMobileAgentConfigPayload,
  loadAgentMobileConfig,
  localTodayRange,
  monthUtcRange,
  normalizePhotoBase64Url,
  registerFcmToken,
  reportMobilePresence,
  type CompactClientRow
} from "./mobile-agent-sync.config.service";

export { syncFull } from "./mobile-agent-sync.full.service";

export {
  enqueueOrder,
  getPendingCount,
  syncDelta,
  syncOrders
} from "./mobile-agent-sync.delta.service";
