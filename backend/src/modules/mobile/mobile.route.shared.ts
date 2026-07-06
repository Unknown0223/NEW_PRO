import { jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";
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
