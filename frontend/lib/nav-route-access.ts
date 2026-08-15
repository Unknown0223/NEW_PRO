import type { NavItem } from "@/components/dashboard/nav-config";
import {
  dashboardClientsNav,
  dashboardHomeNav,
  dashboardInvoicesNav,
  dashboardKassaNav,
  dashboardOrdersNav,
  dashboardPlansNav,
  dashboardReportsNav,
  dashboardSidebarLayout,
  dashboardStockNav,
  dashboardSuppliersNav,
  dashboardUsersNav
} from "@/components/dashboard/nav-config";

function pathOnly(href: string): string {
  const raw = href.split("?")[0] ?? href;
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw;
}

function collectNavItems(): NavItem[] {
  const out: NavItem[] = [];
  out.push(...dashboardHomeNav.items);
  out.push(...dashboardStockNav.items);
  for (const g of dashboardOrdersNav.groups) out.push(...g.items);
  out.push(...dashboardInvoicesNav.items);
  for (const g of dashboardKassaNav.groups) out.push(...g.items);
  out.push(...dashboardClientsNav.items);
  out.push(...dashboardSuppliersNav.items);
  out.push(...dashboardPlansNav.items);
  out.push(...dashboardReportsNav.items);
  for (const g of dashboardUsersNav.groups) out.push(...g.items);
  for (const entry of dashboardSidebarLayout) {
    if (entry.kind === "link") out.push(entry.item);
  }
  return out;
}

const ALL_NAV_ITEMS = collectNavItems();

/**
 * Joriy yo‘l uchun eng aniq (eng uzun) nav bandini topadi.
 * Faqat `roles` yoki `showIfAnyPermission` berilgan bandlar — deep-link gate uchun.
 */
export function findGatedNavItemForPath(pathname: string): NavItem | null {
  const path = pathOnly(pathname);
  let best: NavItem | null = null;
  let bestLen = -1;
  for (const item of ALL_NAV_ITEMS) {
    if (item.placeholder || item.href === "#") continue;
    const hasGate = Boolean(item.roles?.length || item.showIfAnyPermission?.length);
    if (!hasGate) continue;
    const hrefPath = pathOnly(item.href);
    if (path === hrefPath || path.startsWith(`${hrefPath}/`)) {
      if (hrefPath.length > bestLen) {
        best = item;
        bestLen = hrefPath.length;
      }
    }
  }
  return best;
}

/** Rol + permission bo‘yicha nav bandi ko‘rinadimi (app-shell bilan bir xil mantiq). */
export function isNavItemAllowed(
  item: NavItem,
  role: string | null,
  permissionKeys: Set<string> | null
): boolean {
  if (role === "admin") return true;
  if (item.showIfAnyPermission?.length && permissionKeys) {
    if (item.showIfAnyPermission.some((k) => permissionKeys.has(k))) return true;
  }
  if (!item.roles?.length) {
    // Faqat permission gate — ruxsat yo‘q bo‘lsa yopiq.
    if (item.showIfAnyPermission?.length) return false;
    return true;
  }
  return role != null && item.roles.includes(role);
}
