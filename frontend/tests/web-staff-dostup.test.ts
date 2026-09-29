import { describe, expect, it } from "vitest";
import {
  dashboardClientsNav,
  dashboardHomeNav,
  dashboardInvoicesNav,
  dashboardKassaNav,
  dashboardOrdersNav,
  dashboardPayrollNav,
  dashboardPlansNav,
  dashboardReportsNav,
  dashboardSidebarLayout,
  dashboardStockNav,
  dashboardSuppliersNav,
  dashboardUsersNav,
  flattenMobileNavItems,
  type NavItem
} from "@/components/dashboard/nav-config";
import { isNavItemAllowed } from "@/lib/nav-route-access";
import {
  filterSettingsSectionsForAccess,
  isSettingsItemAllowedForAccess,
  settingsItemViewPermissions,
  settingsSections
} from "@/lib/settings-structure";

function item(href: string) {
  const found = flattenMobileNavItems().find((i) => (i.href.split("?")[0] ?? "") === href);
  if (!found) throw new Error(`nav yo‘q: ${href}`);
  return found;
}

describe("web staff nav — Dostup cheklovlari", () => {
  it("kassir to‘lovlarni ko‘radi, omborni yo‘q; deny yopadi", () => {
    const keys = new Set(["cash.oplaty_klientov.view"]);
    expect(isNavItemAllowed(item("/payments"), "cashier", keys)).toBe(true);
    expect(isNavItemAllowed(item("/stock/receipts"), "cashier", keys)).toBe(false);
    expect(isNavItemAllowed(item("/payments"), "cashier", new Set())).toBe(false);
  });

  it("operator buyurtmani ko‘radi, kassani yo‘q", () => {
    const keys = new Set(["orders.zakaz.view", "orders.zakaz.create", "clients.klient.view"]);
    expect(isNavItemAllowed(item("/orders"), "operator", keys)).toBe(true);
    expect(isNavItemAllowed(item("/payments"), "operator", keys)).toBe(false);
    expect(isNavItemAllowed(item("/stock/balances"), "operator", keys)).toBe(false);
  });

  it("SVR work-slots ni ko‘radi; deny yopadi", () => {
    const keys = new Set(["work_slots.raboche_mesto.view", "dashboard.supervayzer.view"]);
    expect(isNavItemAllowed(item("/work-slots"), "supervisor", keys)).toBe(true);
    expect(isNavItemAllowed(item("/work-slots"), "supervisor", new Set(["dashboard.supervayzer.view"]))).toBe(
      false
    );
    const cashDesk = dashboardKassaNav.groups
      .flatMap((g) => g.items)
      .find((i) => i.href === "/settings/cash-desks");
    expect(cashDesk).toBeTruthy();
    expect(isNavItemAllowed(cashDesk!, "supervisor", keys)).toBe(false);
  });

  it("skladchik omborni ko‘radi, kassani yo‘q", () => {
    const keys = new Set(["warehouse.ostatki.view", "warehouse.postuplenie.view"]);
    expect(isNavItemAllowed(item("/stock/balances"), "skladchik", keys)).toBe(true);
    expect(isNavItemAllowed(item("/stock/receipts"), "skladchik", keys)).toBe(true);
    expect(isNavItemAllowed(item("/payments"), "skladchik", keys)).toBe(false);
    const warehouses = dashboardStockNav.items.find((i) => i.href === "/stock/warehouses");
    expect(warehouses).toBeTruthy();
    expect(isNavItemAllowed(warehouses!, "skladchik", keys)).toBe(false);
  });

  it("kassir + skladchik paket: to‘lov va ombor qoldig‘i ochiladi (asosiy rol kassir)", () => {
    const keys = new Set(["cash.oplaty_klientov.view", "warehouse.ostatki.view", "warehouse.postuplenie.view"]);
    expect(isNavItemAllowed(item("/payments"), "cashier", keys)).toBe(true);
    expect(isNavItemAllowed(item("/stock/balances"), "cashier", keys)).toBe(true);
    expect(isNavItemAllowed(item("/stock/receipts"), "cashier", keys)).toBe(true);
  });

  it("Зарплата bo‘limi: kassir faqat navbatni, hisobchi hisobni ko‘radi", () => {
    const payroll = dashboardPayrollNav.groups.flatMap((g) => g.items);
    const byHref = (href: string) => payroll.find((i) => i.href === href)!;
    const cashier = new Set(["cash.vydacha_zarplaty.view"]);
    expect(isNavItemAllowed(byHref("/finance/cashier-queue"), "cashier", cashier)).toBe(true);
    expect(isNavItemAllowed(byHref("/users/salary"), "cashier", cashier)).toBe(false);
    const accountant = new Set(["staff.zarplaty.view", "staff.avans.view"]);
    expect(isNavItemAllowed(byHref("/users/salary"), "operator", accountant)).toBe(true);
    expect(isNavItemAllowed(byHref("/users/advances"), "operator", accountant)).toBe(true);
    expect(isNavItemAllowed(byHref("/finance/advances/approval"), "operator", accountant)).toBe(false);
    expect(item("/users/salary/formulas")).toBeTruthy();
  });

  it("Users → Складчик warehouse.sklady.view bilan ochilmasin", () => {
    const skladchikNav = dashboardUsersNav.groups
      .flatMap((g) => g.items)
      .find((i) => i.href === "/settings/spravochnik/skladchik");
    expect(skladchikNav).toBeTruthy();
    expect(
      isNavItemAllowed(skladchikNav!, "operator", new Set(["warehouse.sklady.view"]))
    ).toBe(false);
    expect(
      isNavItemAllowed(skladchikNav!, "skladchik", new Set(["staff.skladchik.view"]))
    ).toBe(true);
  });
});

describe("sozlamalar hub — Dostup kalitlari", () => {
  it("tovar view valyutalarni ochmasin", () => {
    const keys = new Set(["settings.tovar.view"]);
    const sections = filterSettingsSectionsForAccess(settingsSections, "operator", keys);
    const titles = sections.flatMap((s) => s.items.map((i) => i.title));
    expect(titles).toContain("Продукт");
    expect(titles).not.toContain("Валюты");
    expect(titles).not.toContain("Мобильное приложение");
  });

  it("mobile_app view faqat mobil ilovani ochadi", () => {
    const keys = new Set(["settings.mobile_app.view"]);
    const sections = filterSettingsSectionsForAccess(settingsSections, "operator", keys);
    const titles = sections.flatMap((s) => s.items.map((i) => i.title));
    expect(titles).toContain("Мобильное приложение");
    expect(titles).not.toContain("Продукт");
  });

  it("admin barcha punktlarni ko‘radi", () => {
    const sections = filterSettingsSectionsForAccess(settingsSections, "admin", new Set());
    expect(sections.length).toBeGreaterThan(5);
  });

  it("har bir mapped punkt view kalitiga ega", () => {
    const product = settingsSections
      .flatMap((s) => s.items)
      .find((i) => i.title === "Продукт");
    expect(product).toBeTruthy();
    expect(settingsItemViewPermissions(product!)).toContain("settings.tovar.view");
    expect(isSettingsItemAllowedForAccess(product!, "operator", new Set(["settings.tovar.view"]))).toBe(
      true
    );
    expect(isSettingsItemAllowedForAccess(product!, "operator", new Set(["settings.valyuty.view"]))).toBe(
      false
    );
  });
});

function collectGatedNavItems(): NavItem[] {
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
  for (const g of dashboardPayrollNav.groups) out.push(...g.items);
  for (const entry of dashboardSidebarLayout) {
    if (entry.kind === "link") out.push(entry.item);
  }
  const seen = new Set<string>();
  const uniq: NavItem[] = [];
  for (const it of out) {
    if (!it.showIfAnyPermission?.length || it.placeholder) continue;
    const id = `${it.href}|${it.label}`;
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(it);
  }
  return uniq;
}

describe("Dostup nav — har bir band grant/deny", () => {
  const gated = collectGatedNavItems();

  it("gated bandlar bor", () => {
    expect(gated.length).toBeGreaterThan(20);
  });

  it("bo‘sh kalit yopadi, birinchi kalit ochadi, olib tashlash yopadi", () => {
    for (const nav of gated) {
      const key = nav.showIfAnyPermission![0]!;
      expect(isNavItemAllowed(nav, "operator", new Set()), nav.href).toBe(false);
      expect(isNavItemAllowed(nav, "operator", new Set([key])), `${nav.href} grant`).toBe(true);
      expect(isNavItemAllowed(nav, "operator", new Set()), `${nav.href} deny`).toBe(false);
    }
  });
});

const ROLE_NAV: Array<{
  role: string;
  keys: string[];
  see: string[];
  hide: string[];
}> = [
  {
    role: "director",
    keys: ["dashboard.prodazhi.view", "reports.otchety.view", "orders.zakaz.view", "cash.oplaty_klientov.view"],
    see: ["/dashboard/sales", "/orders", "/payments"],
    hide: ["/access", "/orders/new?type=order"]
  },
  {
    role: "manager",
    keys: ["dashboard.prodazhi.view", "reports.otchety.view", "orders.zakaz.view", "staff.konsignatsiya.view"],
    see: ["/orders", "/settings/spravochnik/consignment"],
    hide: ["/payments", "/access", "/stock/receipts"]
  },
  {
    role: "sales_director",
    keys: ["dashboard.prodazhi.view", "reports.otchety.view", "orders.zakaz.view", "clients.klient.view"],
    see: ["/orders", "/clients"],
    hide: ["/payments", "/access", "/stock/balances"]
  },
  {
    role: "accountant",
    keys: ["cash.oplaty_klientov.view", "finance.obzor.view", "suppliers.postavshchik.view", "orders.zakaz.view"],
    see: ["/payments", "/suppliers", "/orders"],
    hide: ["/access", "/stock/receipts"]
  },
  {
    role: "warehouse_manager",
    keys: ["warehouse.sklady.view", "warehouse.postuplenie.view", "staff.skladchik.view", "orders.zakaz.view"],
    see: ["/stock/warehouses", "/stock/receipts", "/settings/spravochnik/skladchik"],
    hide: ["/payments", "/access"]
  },
  {
    role: "agent",
    keys: ["orders.zakaz.view", "orders.zakaz.create", "clients.klient.view", "dashboard.prodazhi.view"],
    see: ["/orders", "/orders/new?type=order", "/clients"],
    hide: ["/payments", "/access", "/stock/receipts"]
  },
  {
    role: "expeditor",
    keys: ["orders.zakaz.view", "orders.vozvrat.view", "cash.dolgi_ekspeditora.view"],
    see: ["/orders"],
    hide: ["/payments", "/access", "/clients"]
  },
  {
    role: "collector",
    keys: ["cash.oplaty_klientov.view", "cash.zayavki_na_oplatu.view"],
    see: ["/payments"],
    hide: ["/orders", "/access", "/stock/balances"]
  },
  {
    role: "auditor",
    keys: ["audit.log.view", "clients.klient.view", "orders.zakaz.view", "staff.auditor.view"],
    see: ["/orders", "/clients"],
    hide: ["/payments", "/access"]
  },
  {
    role: "regional_manager",
    keys: ["dashboard.prodazhi.view", "reports.otchety.view", "orders.zakaz.view"],
    see: ["/orders", "/dashboard/sales"],
    hide: ["/orders/new?type=order", "/access", "/payments"]
  }
];

describe("Dostup nav — qolgan rollar (ko‘rinadi / yashirin)", () => {
  for (const spec of ROLE_NAV) {
    it(`${spec.role}`, () => {
      const keys = new Set(spec.keys);
      for (const href of spec.see) {
        const path = href.split("?")[0] ?? href;
        const nav = item(path);
        expect(isNavItemAllowed(nav, spec.role, keys), `${spec.role} see ${href}`).toBe(true);
      }
      for (const href of spec.hide) {
        const path = href.split("?")[0] ?? href;
        let nav: NavItem | undefined;
        try {
          nav = item(path);
        } catch {
          nav = collectGatedNavItems().find((n) => (n.href.split("?")[0] ?? "") === path);
        }
        if (!nav) continue;
        expect(isNavItemAllowed(nav, spec.role, keys), `${spec.role} hide ${href}`).toBe(false);
      }
    });
  }
});
