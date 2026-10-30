import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

/**
 * Klient katalogi: admin/operator-like + supervayzer.
 * Yozish/o‘qish hali RBAC (`clients.klient.*`) va actor scope bilan cheklanadi.
 */
export const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
