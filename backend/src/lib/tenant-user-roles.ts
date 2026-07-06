/**
 * Tenant `User.role` qiymatlari — distribusiya rejasi (bosqich A: faqat rollar).
 * Ruxsat matritsasi keyin; marshrutlarda `admin` + operator-like rollar bir xil katalog kirish.
 */

export const TENANT_ADMIN_ROLE = "admin" as const;

/**
 * Distribusiya veb-lavozimlari — `operator` bilan bir xil yaratilish shabloni (panel, max_sessions, …).
 */
export const DISTRIBUTION_WEB_STAFF_ROLES = [
  "director",
  "sales_director",
  "manager",
  "regional_manager",
  "accountant",
  "warehouse_manager"
] as const;

export type DistributionWebStaffRole = (typeof DISTRIBUTION_WEB_STAFF_ROLES)[number];

/** Operator + distribusiya veb-rollari (kassa bog‘lanishi faqat `operator` uchun). */
export const OPERATOR_LIKE_WEB_ROLES = ["operator", ...DISTRIBUTION_WEB_STAFF_ROLES] as const;

export type OperatorLikeWebRole = (typeof OPERATOR_LIKE_WEB_ROLES)[number];

/** Veb-panel + omborchi (sessiya / bulk / filter opsiyalari). */
export const WEB_PANEL_STAFF_ROLES = [...OPERATOR_LIKE_WEB_ROLES, "skladchik"] as const;

/** Marshrutlarda `["admin","operator"]` o‘rniga — hozircha ruxsatsiz kengaytirish. */
export const ADMIN_AND_OPERATOR_LIKE_ROLES = ["admin", ...OPERATOR_LIKE_WEB_ROLES] as const;

/** Buyurtma tasdiqlash zanjirida ishtirok etuvchi rollar (API preHandler). */
export const ORDER_APPROVAL_ROUTE_ROLES = [
  ...ADMIN_AND_OPERATOR_LIKE_ROLES,
  "supervisor",
  "commercial_director"
] as const;

export function isDistributionWebStaffRole(role: string): role is DistributionWebStaffRole {
  return (DISTRIBUTION_WEB_STAFF_ROLES as readonly string[]).includes(role);
}

export function isOperatorLikeWebRole(role: string): role is OperatorLikeWebRole {
  return (OPERATOR_LIKE_WEB_ROLES as readonly string[]).includes(role);
}

export function isWebPanelStaffRole(role: string): boolean {
  return (WEB_PANEL_STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * KOMANDA rollari — faqat mobil ilova (veb «Доступ» ro‘yxatida ko‘rsatilmaydi).
 * Supervisor veb + mobil — ro‘yxatda qoladi.
 */
export const MOBILE_ONLY_KOMANDA_ROLES = ["agent", "expeditor", "collector", "auditor"] as const;

export type MobileOnlyKomandaRole = (typeof MOBILE_ONLY_KOMANDA_ROLES)[number];

export function isMobileOnlyKomandaRole(role: string): boolean {
  return (MOBILE_ONLY_KOMANDA_ROLES as readonly string[]).includes(role.trim());
}

/** «Доступ» → «Пользователи» va veb huquq modallari: mobil-only KOMANDA chiqariladi. */
export function isExcludedFromAccessWebUsersList(role: string): boolean {
  return isMobileOnlyKomandaRole(role);
}

/**
 * «Состав ролей по умолчанию» (`ensureTenantRolesForRoleDefaults`) uchun boshlang‘ich rol kalitlari.
 * `StaffKind` / marshrutlar bilan bir qatorda — import yoki maxsus `users.role` uchun (masalan, logist).
 * Yangi doimiy rol qo‘shilsa, shu ro‘yxatga ham qo‘shing (va `rbac.service` dagi RU nomlar xaritasiga).
 */
export const TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION: readonly string[] = [
  TENANT_ADMIN_ROLE,
  "agent",
  "supervisor",
  "expeditor",
  "collector",
  "auditor",
  "gruzchik",
  "cashier",
  "storekeeper",
  "partner",
  "logist",
  "merchandiser",
  "driver",
  "dispatcher",
  ...WEB_PANEL_STAFF_ROLES
];
