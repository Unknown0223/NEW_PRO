"use client";

import { OrderSseListener } from "@/components/dashboard/order-sse-listener";
import { SalesArenaLogo } from "@/components/brand/sales-arena-logo";
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
  dashboardUsersNav,
  flattenMobileNavItems,
  resolvePageBreadcrumb,
  type NavItem
} from "@/components/dashboard/nav-config";
import { isNavItemAllowed } from "@/lib/nav-route-access";
import { Button } from "@/components/ui/button";
import { ClientLucideIcon } from "@/components/ui/client-lucide-icon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { decodeAccessTokenTenantSlug, useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import {
  ME_PERMISSIONS_REFETCH_INTERVAL_MS,
  ME_PERMISSIONS_STALE_MS,
  mePermissionKeySet,
  mePermissionsQueryKey,
  normalizeMePermissionKeys
} from "@/lib/me-permissions";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { isFullHeightWorkspaceRoute } from "@/lib/full-height-workspace-routes";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { WorkSlotsPendingBell } from "@/components/work-slots/work-slots-pending-bell";
import { WorkSlotProfileBadge } from "@/components/work-slots/work-slot-profile-badge";
import { UserMenu } from "@/components/dashboard/user-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Loader2,
  Lightbulb,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Table2,
  TrendingUp,
  Truck,
  Users,
  UserSquare2,
  Wallet,
  Warehouse
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function isNavActive(pathname: string, href: string): boolean {
  const pathOnly = href.split("?")[0] ?? href;
  if (pathOnly === "/dashboard") return pathname === "/dashboard";
  // Ro‘yxat ildizi — bolalar sahifalarida sariq bo‘lib qolmasin (merge / group-processing va h.k.)
  if (pathOnly === "/clients") return pathname === "/clients" || pathname === "/clients/";
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

/** Заявки: `/orders?status=…`, `/returns/new?…` va boshqalar */
function orderNavItemActive(pathname: string, searchParams: URLSearchParams, href: string): boolean {
  const q = href.indexOf("?");
  const pathPart = (q >= 0 ? href.slice(0, q) : href) || href;
  const qs = q >= 0 ? href.slice(q + 1) : "";

  if (pathPart === "/orders") {
    if (pathname !== "/orders") return false;
    const want = qs ? new URLSearchParams(qs).get("status") : null;
    const cur = searchParams.get("status");
    if (want === "cancelled") return cur === "cancelled";
    return cur !== "cancelled";
  }

  if (pathPart === "/returns/new" && pathname === "/returns/new") {
    if (!qs) {
      return !searchParams.get("by_order") && searchParams.get("intent") !== "exchange";
    }
    const sp = new URLSearchParams(qs);
    for (const [k, v] of Array.from(sp.entries())) {
      if (searchParams.get(k) !== v) return false;
    }
    return true;
  }

  if (pathPart === "/settings") {
    return pathname === "/settings" || pathname.startsWith("/settings/");
  }

  if (qs) {
    if (pathname !== pathPart) return false;
    const sp = new URLSearchParams(qs);
    for (const [k, v] of Array.from(sp.entries())) {
      if (searchParams.get(k) !== v) return false;
    }
    return true;
  }

  return pathname === pathPart || pathname.startsWith(`${pathPart}/`);
}

/** Bir xil queryKey uchun eski keshda `Set` ham bo‘lishi mumkin — `string[]` / `Set` → `Set`. */
function permissionKeysFromQueryData(data: unknown): Set<string> | null {
  if (data === undefined) return null;
  return mePermissionKeySet(data);
}

function navItemVisible(item: NavItem, role: string | null, permissionKeys: Set<string> | null): boolean {
  return isNavItemAllowed(item, role, permissionKeys);
}

function navItemsSomeVisible(
  items: NavItem[],
  role: string | null,
  permissionKeys: Set<string> | null
): boolean {
  return items.some(
    (item) =>
      !item.placeholder &&
      !item.disabled &&
      item.href !== "#" &&
      navItemVisible(item, role, permissionKeys)
  );
}

function usersNavChildActive(pathname: string): boolean {
  return dashboardUsersNav.groups.some((g) =>
    g.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href))
  );
}

function clientsNavChildActive(pathname: string): boolean {
  return dashboardClientsNav.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href));
}

function dashboardNavChildActive(pathname: string): boolean {
  return dashboardHomeNav.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href));
}

function ordersNavModuleOpen(pathname: string): boolean {
  return (
    pathname.startsWith("/orders") ||
    pathname.startsWith("/returns") ||
    pathname.startsWith("/orders/automation")
  );
}

function invoicesNavChildActive(pathname: string): boolean {
  return dashboardInvoicesNav.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href));
}

function stockNavChildActive(pathname: string): boolean {
  return dashboardStockNav.items.some((item) => isNavActive(pathname, item.href));
}

function suppliersNavChildActive(pathname: string): boolean {
  if (pathname === "/suppliers" || pathname.startsWith("/suppliers/")) return true;
  return dashboardSuppliersNav.items.some(
    (item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href)
  );
}

function kassaNavChildActive(pathname: string): boolean {
  return dashboardKassaNav.groups.some((g) =>
    g.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href))
  );
}

function reportsNavChildActive(pathname: string): boolean {
  return dashboardReportsNav.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href));
}

function plansNavChildActive(pathname: string): boolean {
  return dashboardPlansNav.items.some((item) => !item.disabled && item.href !== "#" && isNavActive(pathname, item.href));
}

function placeholderIcon(icon: "plans" | "pivot" | "audit") {
  if (icon === "plans") return CalendarRange;
  if (icon === "pivot") return Table2;
  return ShieldCheck;
}

/**
 * Ichki menyu bandi (bosib bo‘lmaydigan):
 * - `placeholder` → sariq «скоро» (loyihada hali yo‘q, keyin qo‘shamiz);
 * - aks holda → kulrang (disabled).
 */
function MutedNavLeaf({ item, withDot = false }: { item: NavItem; withDot?: boolean }) {
  const ph = Boolean(item.placeholder);
  return (
    <span
      className={cn(
        withDot
          ? "flex w-full select-none items-start gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium"
          : "block select-none rounded-lg px-3 py-2 text-[13px] font-medium",
        ph ? "cursor-default text-amber-300/90" : "cursor-not-allowed text-sidebar-foreground/40"
      )}
      title={ph ? "Скоро" : undefined}
      aria-disabled
    >
      {withDot ? (
        <span
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", ph ? "bg-amber-300/70" : "bg-sidebar-foreground/25")}
          aria-hidden
        />
      ) : null}
      {item.label}
    </span>
  );
}

function linkIcon(href: string) {
  const path = href.split("?")[0] ?? href;
  if (path === "/dashboard") return LayoutDashboard;
  if (path === "/audit") return ShieldCheck;
  if (path.startsWith("/clients")) return Users;
  if (path.startsWith("/settings/cash-desks")) return Wallet;
  if (path === "/payments") return Wallet;
  if (path === "/currency-rates") return TrendingUp;
  if (path === "/expenses") return Receipt;
  if (path === "/stock/receipts") return Truck;
  if (path === "/reports" || path.startsWith("/reports/")) return BarChart3;
  if (path.startsWith("/suppliers")) return Truck;
  if (path.startsWith("/stock")) return Warehouse;
  if (path.startsWith("/orders") || path.startsWith("/returns")) return ShoppingCart;
  if (path.startsWith("/products")) return Package;
  if (path.startsWith("/settings")) return Settings;
  return LayoutDashboard;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hydrated = useAuthStoreHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { tenantSlug, clearSession } = useAuthStore();
  const effectiveRole = useEffectiveRole();
  const qc = useQueryClient();

  /** Eski JWT da `tenantSlug` bo‘lmasa — bazadan slugni `/auth/me` orqali store ga yozamiz (404 TenantNotFound oldini). */
  useEffect(() => {
    if (!hydrated || !accessToken) return;
    if (decodeAccessTokenTenantSlug(accessToken)) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<{ user: { tenantSlug?: string | null } }>("/auth/me");
        if (cancelled) return;
        const slug = data.user?.tenantSlug;
        if (slug && useAuthStore.getState().tenantSlug !== slug) {
          useAuthStore.setState({ tenantSlug: slug });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  const mePermsQ = useQuery({
    queryKey: mePermissionsQueryKey(tenantSlug),
    enabled: Boolean(tenantSlug),
    staleTime: ME_PERMISSIONS_STALE_MS,
    refetchOnWindowFocus: true,
    refetchInterval: tenantSlug ? ME_PERMISSIONS_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data } = await api.get<{ data: { keys: string[] } }>(`/api/${tenantSlug}/access/me-permissions`);
      return normalizeMePermissionKeys(data.data?.keys ?? []);
    },
    placeholderData: (prev) => prev
  });
  const permissionKeySet = permissionKeysFromQueryData(mePermsQ.data);
  const [openSection, setOpenSection] = useState<
    "dashboard" | "clients" | "orders" | "invoices" | "stock" | "suppliers" | "reports" | "plans" | "kassa" | "users" | null
  >(null);
  const [reportsSettingsOpen, setReportsSettingsOpen] = useState(false);
  const [reportsSearch, setReportsSearch] = useState("");
  const [localHiddenOverride, setLocalHiddenOverride] = useState<Set<string> | null>(null);
  const dashboardOpen = openSection === "dashboard";
  const clientsOpen = openSection === "clients";
  const usersOpen = openSection === "users";
  const stockOpen = openSection === "stock";
  const suppliersOpen = openSection === "suppliers";
  const reportsOpen = openSection === "reports";
  const plansOpen = openSection === "plans";
  const kassaOpen = openSection === "kassa";
  const ordersOpen = openSection === "orders";
  const invoicesOpen = openSection === "invoices";

  useEffect(() => {
    if (dashboardNavChildActive(pathname)) {
      setOpenSection("dashboard");
      return;
    }
    if (clientsNavChildActive(pathname)) {
      setOpenSection("clients");
      return;
    }
    if (ordersNavModuleOpen(pathname)) {
      setOpenSection("orders");
      return;
    }
    if (invoicesNavChildActive(pathname)) {
      setOpenSection("invoices");
      return;
    }
    if (stockNavChildActive(pathname)) {
      setOpenSection("stock");
      return;
    }
    if (suppliersNavChildActive(pathname)) {
      setOpenSection("suppliers");
      return;
    }
    if (reportsNavChildActive(pathname)) {
      setOpenSection("reports");
      return;
    }
    if (plansNavChildActive(pathname)) {
      setOpenSection("plans");
      return;
    }
    if (kassaNavChildActive(pathname)) {
      setOpenSection("kassa");
      return;
    }
    if (usersNavChildActive(pathname)) {
      setOpenSection("users");
      return;
    }
    setOpenSection(null);
  }, [pathname]);

  function toggleSection(
    section: "dashboard" | "clients" | "orders" | "invoices" | "stock" | "suppliers" | "reports" | "plans" | "kassa" | "users"
  ) {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  async function logout() {
    const rt = useAuthStore.getState().refreshToken;
    if (rt) {
      try {
        await api.post("/auth/logout", { refreshToken: rt });
      } catch {
        /* sessiyani baribir lokal tozalaymiz */
      }
    }
    clearSession();
    qc.clear();
    try {
      window.localStorage.removeItem("salec:rq:v1");
    } catch {
      /* ignore */
    }
    router.replace("/login");
    router.refresh();
  }

  /** Sticky jadval sahifalari — viewport to‘liq; qolganlari kontent bo‘yicha */
  const isFullHeightWorkspace = isFullHeightWorkspaceRoute(pathname);

  /** Tepa header chap qismi uchun: joriy sahifa nomi (bo'sh joyni to'ldiradi). */
  const breadcrumb = useMemo(() => resolvePageBreadcrumb(pathname), [pathname]);

  const uiPrefsQ = useQuery({
    queryKey: ["me", "ui-preferences", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        data?: { reports?: { hidden_menu_item_hrefs?: string[] } };
      }>(`/api/${tenantSlug}/me/ui-preferences`);
      return data.data ?? {};
    }
  });

  const reportItemHrefSet = useMemo(
    () =>
      new Set(
        dashboardReportsNav.items
          .filter((x) => !x.disabled && x.href !== "#" && x.href !== "/reports/settings")
          .filter((x) => navItemVisible(x, effectiveRole, permissionKeySet))
          .map((x) => x.href)
      ),
    [effectiveRole, permissionKeySet]
  );

  const hiddenReportHrefs = useMemo(() => {
    const raw = uiPrefsQ.data?.reports?.hidden_menu_item_hrefs;
    if (!Array.isArray(raw)) return new Set<string>();
    return new Set(
      raw
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && x.length <= 200 && reportItemHrefSet.has(x))
    );
  }, [uiPrefsQ.data?.reports?.hidden_menu_item_hrefs, reportItemHrefSet]);

  const hiddenReportsCurrent = localHiddenOverride ?? hiddenReportHrefs;

  const reportMenuItems = useMemo(
    () =>
      dashboardReportsNav.items.filter((item) => {
        if (!navItemVisible(item, effectiveRole, permissionKeySet)) return false;
        if (item.href === "/reports/settings") return true;
        return !hiddenReportsCurrent.has(item.href);
      }),
    [effectiveRole, permissionKeySet, hiddenReportsCurrent]
  );

  const mobileItems = flattenMobileNavItems().filter((item) => {
    if (!navItemVisible(item, effectiveRole, permissionKeySet)) return false;
    const isReport = item.href === "/reports" || item.href.startsWith("/reports/");
    if (!isReport) return true;
    if (item.href === "/reports/settings") return true;
    return !hiddenReportsCurrent.has(item.href);
  });

  const reportsSettingsItems = useMemo(
    () =>
      dashboardReportsNav.items
        .filter((x) => !x.disabled && x.href !== "#" && x.href !== "/reports/settings")
        .filter((x) => navItemVisible(x, effectiveRole, permissionKeySet))
        .map((x) => ({ href: x.href, label: x.label })),
    [effectiveRole, permissionKeySet]
  );
  const reportsSearchNorm = reportsSearch.trim().toLowerCase();
  const reportsSettingsVisibleItems = useMemo(
    () =>
      reportsSearchNorm
        ? reportsSettingsItems.filter((x) => x.label.toLowerCase().includes(reportsSearchNorm))
        : reportsSettingsItems,
    [reportsSearchNorm, reportsSettingsItems]
  );
  const allVisibleChecked =
    reportsSettingsVisibleItems.length > 0 && reportsSettingsVisibleItems.every((x) => !hiddenReportsCurrent.has(x.href));
  const shownReportsCount = reportsSettingsItems.reduce((acc, item) => acc + (hiddenReportsCurrent.has(item.href) ? 0 : 1), 0);

  const patchUiPrefsMut = useMutation({
    mutationFn: async (hiddenHrefs: string[]) => {
      const sanitizedHiddenHrefs = Array.from(
        new Set(hiddenHrefs.map((x) => x.trim()).filter((x) => x.length > 0 && x.length <= 200 && reportItemHrefSet.has(x)))
      );
      await api.patch(`/api/${tenantSlug}/me/ui-preferences`, {
        reports: { hidden_menu_item_hrefs: sanitizedHiddenHrefs }
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me", "ui-preferences", tenantSlug] });
      setLocalHiddenOverride(null);
      setReportsSettingsOpen(false);
    }
  });

  const setHiddenReports = (updater: (prev: Set<string>) => Set<string>) => {
    setLocalHiddenOverride((prev) => updater(prev ? new Set(prev) : new Set(hiddenReportHrefs)));
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <OrderSseListener />
      <aside className="scrollbar-none hidden min-h-0 w-[15.5rem] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[2px_0_12px_rgba(0,0,0,0.06)] md:flex">
        <div className="border-b border-sidebar-border/80 px-3 py-4">
          <SalesArenaLogo variant="dark" height={48} className="mb-2.5 w-full max-w-[220px]" />
          <p className="truncate text-sm font-semibold text-sidebar-foreground" title={tenantSlug ?? undefined}>
            {tenantSlug ?? "—"}
          </p>
        </div>
        <nav className="scrollbar-none flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2 overscroll-contain">
          {dashboardSidebarLayout.map((entry, idx) => {
            if (entry.kind === "link") {
              if (!navItemVisible(entry.item, effectiveRole, permissionKeySet)) return null;
              const { href, label, disabled } = entry.item;
              const active = !disabled && href !== "#" && isNavActive(pathname, href);
              const Icon = linkIcon(href);
              const className = cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                disabled || href === "#"
                  ? "cursor-not-allowed text-sidebar-foreground/45"
                  : active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/90 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
              );
              if (disabled || href === "#") {
                return (
                  <span key={`${href}-${label}-${idx}`} className={className} aria-disabled>
                    <ClientLucideIcon icon={Icon} className="size-[18px] shrink-0 opacity-90" />
                    {label}
                  </span>
                );
              }
              return (
                <Link key={`${href}-${idx}`} href={href} className={className}>
                  <ClientLucideIcon icon={Icon} className="size-[18px] shrink-0 opacity-90" />
                  {label}
                </Link>
              );
            }

            if (entry.kind === "placeholder") {
              const Icon = placeholderIcon(entry.icon);
              return (
                <div
                  key={`placeholder-${entry.label}-${idx}`}
                  className="flex cursor-default select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-300/90"
                  title="Скоро — раздел в разработке"
                  aria-disabled
                >
                  <ClientLucideIcon icon={Icon} className="size-[18px] shrink-0 opacity-90" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300/90">
                    скоро
                  </span>
                </div>
              );
            }

            if (entry.kind === "orders") {
              if (
                !navItemsSomeVisible(
                  dashboardOrdersNav.groups.flatMap((g) => g.items),
                  effectiveRole,
                  permissionKeySet
                )
              ) {
                return null;
              }
              return (
                <div key="orders" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("orders")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      ordersNavModuleOpen(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={ordersOpen}
                  >
                    <ClientLucideIcon icon={ShoppingCart} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardOrdersNav.sectionTitle}</span>
                    {ordersOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {ordersOpen && (
                    <div className="ml-1 space-y-3 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {dashboardOrdersNav.groups.map((group) => {
                        const visibleItems = group.items.filter((item) =>
                          navItemVisible(item, effectiveRole, permissionKeySet)
                        );
                        if (visibleItems.length === 0) return null;
                        return (
                        <div key={group.title}>
                          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/55">
                            {group.title}
                          </p>
                          <ul className="flex flex-col gap-0.5">
                            {visibleItems.map((item) => {
                                if (item.placeholder || item.disabled || item.href === "#") {
                                  return (
                                    <li key={`${group.title}-${item.label}-${item.href}`}>
                                      <MutedNavLeaf item={item} />
                                    </li>
                                  );
                                }
                                const active = orderNavItemActive(pathname, searchParams, item.href);
                                return (
                                  <li key={`${group.title}-${item.label}-${item.href}`}>
                                    <Link
                                      href={item.href}
                                      className={cn(
                                        "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                        active
                                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                      )}
                                    >
                                      {item.label}
                                    </Link>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (entry.kind === "invoices") {
              if (!navItemsSomeVisible(dashboardInvoicesNav.items, effectiveRole, permissionKeySet)) {
                return null;
              }
              return (
                <div key="invoices" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("invoices")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      invoicesNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={invoicesOpen}
                  >
                    <ClientLucideIcon icon={FileText} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardInvoicesNav.sectionTitle}</span>
                    {invoicesOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {invoicesOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {dashboardInvoicesNav.items
                        .filter((item) => navItemVisible(item, effectiveRole, permissionKeySet))
                        .map((item) => {
                          const muted = Boolean(item.disabled || item.href === "#");
                          const active = !muted && isNavActive(pathname, item.href);
                          return (
                            <li key={`${item.label}-${item.href}`}>
                              {muted ? (
                                <MutedNavLeaf item={item} withDot />
                              ) : (
                                <Link
                                  href={item.href}
                                  className={cn(
                                    "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                                    active
                                      ? "bg-sidebar-accent/35 text-sidebar-accent-foreground shadow-sm"
                                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                                      active ? "bg-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]" : "bg-sidebar-foreground/25"
                                    )}
                                    aria-hidden
                                  />
                                  {item.label}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "clients") {
              if (!navItemsSomeVisible(dashboardClientsNav.items, effectiveRole, permissionKeySet)) {
                return null;
              }
              return (
                <div key="clients" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("clients")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      clientsNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={clientsOpen}
                  >
                    <ClientLucideIcon icon={Users} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardClientsNav.sectionTitle}</span>
                    {clientsOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {clientsOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {dashboardClientsNav.items
                        .filter((item) => navItemVisible(item, effectiveRole, permissionKeySet))
                        .map((item) => {
                        const muted = Boolean(item.disabled || item.href === "#");
                        const active = !muted && isNavActive(pathname, item.href);
                        return (
                          <li key={`${item.label}-${item.href}`}>
                            {muted ? (
                              <MutedNavLeaf item={item} />
                            ) : (
                              item.href === "/reports/settings" ? (
                                <button
                                  type="button"
                                  className={cn(
                                    "block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                                    "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                  )}
                                  onClick={() => {
                                    setReportsSettingsOpen(true);
                                    setReportsSearch("");
                                    setLocalHiddenOverride(null);
                                  }}
                                >
                                  {item.label}
                                </button>
                              ) : (
                                <Link
                                  href={item.href}
                                  className={cn(
                                    "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                    active
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                  )}
                                >
                                  {item.label}
                                </Link>
                              )
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "dashboard") {
              const dashboardItems = dashboardHomeNav.items.filter((item) =>
                navItemVisible(item, effectiveRole, permissionKeySet)
              );
              if (dashboardItems.length === 0) return null;
              return (
                <div key="dashboard" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("dashboard")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      dashboardNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={dashboardOpen}
                  >
                    <ClientLucideIcon icon={LayoutDashboard} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardHomeNav.sectionTitle}</span>
                    {dashboardOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {dashboardOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {dashboardItems.map((item) => {
                        const muted = Boolean(item.disabled || item.href === "#");
                        const active = !muted && isNavActive(pathname, item.href);
                        return (
                          <li key={`${item.label}-${item.href}`}>
                            {muted ? (
                              <MutedNavLeaf item={item} />
                            ) : (
                              <Link
                                href={item.href}
                                className={cn(
                                  "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                  active
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {item.label}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "stock") {
              const stockItems = dashboardStockNav.items.filter((item) =>
                navItemVisible(item, effectiveRole, permissionKeySet)
              );
              if (!navItemsSomeVisible(stockItems, effectiveRole, permissionKeySet)) {
                return null;
              }
              return (
                <div key="stock" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("stock")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      stockNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={stockOpen}
                  >
                    <ClientLucideIcon icon={Package} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardStockNav.sectionTitle}</span>
                    {stockOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {stockOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {stockItems.map((item) => {
                        const muted = Boolean(item.disabled || item.href === "#");
                        const active = !muted && isNavActive(pathname, item.href);
                        return (
                          <li key={`${item.label}-${item.href}`}>
                            {muted ? (
                              <MutedNavLeaf item={item} />
                            ) : (
                              <Link
                                href={item.href}
                                className={cn(
                                  "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                  active
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {item.label}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "suppliers") {
              const suppliersItems = dashboardSuppliersNav.items.filter((item) =>
                navItemVisible(item, effectiveRole, permissionKeySet)
              );
              if (!navItemsSomeVisible(suppliersItems, effectiveRole, permissionKeySet)) {
                return null;
              }
              return (
                <div key="suppliers" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("suppliers")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      suppliersNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={suppliersOpen}
                  >
                    <ClientLucideIcon icon={Lightbulb} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardSuppliersNav.sectionTitle}</span>
                    {suppliersOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {suppliersOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {suppliersItems.map((item) => {
                        const muted = Boolean(item.disabled || item.href === "#");
                        const active = !muted && isNavActive(pathname, item.href);
                        return (
                          <li key={`${item.label}-${item.href}`}>
                            {muted ? (
                              <MutedNavLeaf item={item} />
                            ) : (
                              <Link
                                href={item.href}
                                className={cn(
                                  "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                  active
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {item.label}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "kassa") {
              if (
                !navItemsSomeVisible(
                  dashboardKassaNav.groups.flatMap((g) => g.items),
                  effectiveRole,
                  permissionKeySet
                )
              ) {
                return null;
              }
              const rowClass = (active: boolean, muted: boolean) =>
                cn(
                  "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  muted && "cursor-not-allowed text-sidebar-foreground/40",
                  !muted &&
                    (active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
                );
              return (
                <div key="kassa" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("kassa")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      kassaNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={kassaOpen}
                  >
                    <ClientLucideIcon icon={Wallet} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardKassaNav.sectionTitle}</span>
                    {kassaOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {kassaOpen && (
                    <div className="ml-1 space-y-3 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {dashboardKassaNav.groups.map((group) => {
                        const visibleItems = group.items.filter((item) =>
                          navItemVisible(item, effectiveRole, permissionKeySet)
                        );
                        if (visibleItems.length === 0) return null;
                        return (
                        <div key={group.title}>
                          <div className="relative py-1">
                            <div className="absolute inset-x-0 top-1/2 border-t border-sidebar-border/50" />
                            <p className="relative mx-auto w-fit bg-sidebar px-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                              {group.title}
                            </p>
                          </div>
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {visibleItems.map((item) => {
                              const muted = Boolean(item.disabled || item.href === "#");
                              const active = !muted && isNavActive(pathname, item.href);
                              return (
                                <li key={`${group.title}-${item.label}`}>
                                  {muted ? (
                                    <MutedNavLeaf item={item} withDot />
                                  ) : (
                                    <Link href={item.href} className={rowClass(active, false)}>
                                      <span
                                        className={cn(
                                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                                          active ? "bg-sidebar-primary-foreground/90" : "bg-sidebar-primary"
                                        )}
                                        aria-hidden
                                      />
                                      {item.label}
                                    </Link>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (entry.kind === "reports") {
              if (!navItemsSomeVisible(reportMenuItems, effectiveRole, permissionKeySet)) {
                return null;
              }
              return (
                <div key="reports" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("reports")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      reportsNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={reportsOpen}
                  >
                    <ClientLucideIcon icon={BarChart3} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardReportsNav.sectionTitle}</span>
                    {reportsOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {reportsOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {reportMenuItems.map((item) => {
                        const muted = Boolean(item.disabled || item.href === "#");
                        const active = !muted && isNavActive(pathname, item.href);
                        return (
                          <li key={`${item.label}-${item.href}`}>
                            {muted ? (
                              <MutedNavLeaf item={item} />
                            ) : item.href === "/reports/settings" ? (
                              <button
                                type="button"
                                className={cn(
                                  "block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                                  "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                                onClick={() => {
                                  setReportsSettingsOpen(true);
                                  setReportsSearch("");
                                  setLocalHiddenOverride(null);
                                }}
                              >
                                {item.label}
                              </button>
                            ) : (
                              <Link
                                href={item.href}
                                className={cn(
                                  "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                  active
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {item.label}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "plans") {
              const plansItems = dashboardPlansNav.items.filter((item) =>
                navItemVisible(item, effectiveRole, permissionKeySet)
              );
              if (plansItems.length === 0) return null;
              return (
                <div key="plans" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("plans")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      plansNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={plansOpen}
                  >
                    <ClientLucideIcon icon={CalendarRange} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardPlansNav.sectionTitle}</span>
                    {plansOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {plansOpen && (
                    <ul className="ml-1 flex flex-col gap-0.5 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {plansItems.map((item) => {
                        const active = isNavActive(pathname, item.href);
                        return (
                          <li key={`${item.label}-${item.href}`}>
                            <Link
                              href={item.href}
                              className={cn(
                                "block rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                                active
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                              )}
                            >
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            if (entry.kind === "users") {
              if (
                !navItemsSomeVisible(
                  dashboardUsersNav.groups.flatMap((g) => g.items),
                  effectiveRole,
                  permissionKeySet
                )
              ) {
                return null;
              }
              const rowClass = (active: boolean, muted: boolean) =>
                cn(
                  "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  muted && "cursor-not-allowed text-sidebar-foreground/40",
                  !muted &&
                    (active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
                );
              return (
                <div key="users" className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSection("users")}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      usersNavChildActive(pathname)
                        ? "bg-sidebar-accent/90 text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                    )}
                    aria-expanded={usersOpen}
                  >
                    <ClientLucideIcon icon={UserSquare2} className="size-[18px] shrink-0 opacity-90" />
                    <span className="min-w-0 flex-1">{dashboardUsersNav.sectionTitle}</span>
                    {usersOpen ? (
                      <ClientLucideIcon icon={ChevronDown} className="size-4 shrink-0 opacity-80" />
                    ) : (
                      <ClientLucideIcon icon={ChevronRight} className="size-4 shrink-0 opacity-80" />
                    )}
                  </button>
                  {usersOpen && (
                    <div className="ml-1 space-y-3 border-l border-sidebar-border/60 py-0.5 pl-2">
                      {dashboardUsersNav.groups.map((group) => {
                        const visibleItems = group.items.filter((item) =>
                          navItemVisible(item, effectiveRole, permissionKeySet)
                        );
                        if (visibleItems.length === 0) return null;
                        return (
                        <div key={group.title}>
                          <div className="relative py-1">
                            <div className="absolute inset-x-0 top-1/2 border-t border-sidebar-border/50" />
                            <p className="relative mx-auto w-fit bg-sidebar px-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                              {group.title}
                            </p>
                          </div>
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {visibleItems.map((item) => {
                                const muted = Boolean(item.disabled || item.href === "#");
                                const active = !muted && isNavActive(pathname, item.href);
                                return (
                                  <li key={`${group.title}-${item.label}`}>
                                    {muted ? (
                                      <MutedNavLeaf item={item} withDot />
                                    ) : (
                                      <Link href={item.href} className={rowClass(active, false)}>
                                        <span
                                          className={cn(
                                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                                            active ? "bg-sidebar-primary-foreground/90" : "bg-sidebar-primary"
                                          )}
                                          aria-hidden
                                        />
                                        {item.label}
                                      </Link>
                                    )}
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </nav>
      </aside>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isFullHeightWorkspace
            ? "overflow-hidden"
            : "overflow-y-auto overflow-x-hidden overscroll-contain bg-background"
        )}
      >
        <header className="sticky top-0 z-20 hidden shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-card/95 px-4 py-2 shadow-sm backdrop-blur-md md:flex">
          <div className="flex min-w-0 items-center gap-3">
            {breadcrumb ? (
              <div className="flex min-w-0 items-center gap-1.5">
                {breadcrumb.section ? (
                  <>
                    <span className="hidden truncate text-xs font-medium text-muted-foreground lg:inline">
                      {breadcrumb.section}
                    </span>
                    <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground/50 lg:block" aria-hidden />
                  </>
                ) : null}
                <span className="truncate text-sm font-semibold text-foreground">{breadcrumb.label}</span>
              </div>
            ) : null}
            <WorkSlotProfileBadge />
          </div>
          <div className="flex items-center gap-1.5">
            <WorkSlotsPendingBell tenantSlug={tenantSlug} />
            <NotificationBell tenantSlug={tenantSlug} />
            <UserMenu />
          </div>
        </header>

        <header className="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-border/80 bg-card/95 px-4 py-3 shadow-sm backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <SalesArenaLogo variant="light" height={36} className="mb-0.5 max-w-[200px]" />
              <span className="truncate text-sm font-semibold">{tenantSlug ?? "Панель"}</span>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={logout}>
              Выход
            </Button>
          </div>
          <nav className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
            {mobileItems.map((item) => {
              const active = orderNavItemActive(pathname, searchParams, item.href);
              if (item.href === "/reports/settings") {
                return (
                  <button
                    key={`${item.label}-${item.href}`}
                    type="button"
                    onClick={() => {
                      setReportsSettingsOpen(true);
                      setReportsSearch("");
                      setLocalHiddenOverride(null);
                    }}
                    className="shrink-0 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                  >
                    {item.label}
                  </button>
                );
              }
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div
          className={cn(
            "app-main-canvas flex flex-col",
            isFullHeightWorkspace
              ? "min-h-0 flex-1 overflow-hidden"
              : "h-auto min-h-0 shrink-0 grow-0"
          )}
        >
          <div
            className={cn(
              "flex flex-col",
              isFullHeightWorkspace
                ? "min-h-0 flex-1 overflow-hidden"
                : "px-2 py-3 sm:px-3 sm:py-5 md:px-4 md:py-6"
            )}
          >
            {children}
          </div>
        </div>
      </div>
      <Dialog
        open={reportsSettingsOpen}
        onOpenChange={(open) => {
          setReportsSettingsOpen(open);
          if (!open) {
            setReportsSearch("");
            setLocalHiddenOverride(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Показать/скрыть отчеты из меню</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={reportsSearch}
                onChange={(e) => setReportsSearch(e.target.value)}
                placeholder="Поиск"
                className="pl-8"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={(e) =>
                  setHiddenReports((prev) => {
                    for (const item of reportsSettingsVisibleItems) {
                      if (e.target.checked) prev.delete(item.href);
                      else prev.add(item.href);
                    }
                    return prev;
                  })
                }
              />
              Выбрать все
            </label>
            <div className="max-h-[52vh] space-y-1 overflow-y-auto rounded-md border p-2">
              {reportsSettingsVisibleItems.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Ничего не найдено</p>
              ) : (
                reportsSettingsVisibleItems.map((item) => {
                  const checked = !hiddenReportsCurrent.has(item.href);
                  return (
                    <label
                      key={item.href}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setHiddenReports((prev) => {
                            if (e.target.checked) prev.delete(item.href);
                            else prev.add(item.href);
                            return prev;
                          })
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Показано: {shownReportsCount} из {reportsSettingsItems.length}
              </p>
              <Button
                type="button"
                disabled={patchUiPrefsMut.isPending}
                onClick={() =>
                  void patchUiPrefsMut.mutateAsync(Array.from(hiddenReportsCurrent)).catch((err: unknown) => {
                    window.alert(getUserFacingError(err, "Ошибка сохранения"));
                  })
                }
              >
                {patchUiPrefsMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
