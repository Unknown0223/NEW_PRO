/**
 * Rol bo'yicha default ruxsat to'plamlari (rol x bo'lim x amal).
 *
 * Strukturali `<module>.<section>.<action>` kalitlardan foydalanadi.
 * `seed-role-defaults.ts` skripti shu yordamda `setRolePermissions` chaqiradi.
 * `activate`/`deactivate` alohida berilishi mumkin (masalan supervisor faqat
 * `activate`, `deactivate` esa direktor/admin uchun).
 */
import {
  PERMISSION_SECTIONS,
  buildStructuredPermissionCatalog,
  permissionKey,
  type PermissionAction
} from "./permission-model";

const CATALOG = buildStructuredPermissionCatalog();
const ALL_KEYS = CATALOG.map((e) => e.key);

/** Bo'limning barcha amal kalitlari. */
function sec(module: string, section: string): string[] {
  const def = PERMISSION_SECTIONS.find((s) => s.module === module && s.section === section);
  return def ? def.actions.map((a) => permissionKey(module, section, a)) : [];
}

/** Bo'limning faqat tanlangan amallari. */
function secOnly(module: string, section: string, actions: PermissionAction[]): string[] {
  return actions.map((a) => permissionKey(module, section, a)).filter((k) => ALL_KEYS.includes(k));
}

/** Modulning barcha kalitlari. */
function mod(module: string): string[] {
  return CATALOG.filter((e) => e.module === module).map((e) => e.key);
}

/** Modul bo'yicha faqat ko'rish (+copy) kalitlari. */
function modViewOnly(module: string): string[] {
  return CATALOG.filter((e) => e.module === module && (e.action === "view" || e.action === "copy")).map((e) => e.key);
}

function uniq(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

/** Zakaz status o'tishlari (`orders.status_<slug>.*`, daraxtda «Статус»). */
function orderStatus(...slugs: string[]): string[] {
  return slugs.flatMap((slug) => sec("orders", `status_${slug}`));
}

/** «Заявки» yaratish sahifalari (`orders.sozdanie|obmen|vozvrat_polki|vozvrat_po_zakazu.create`). */
function orderCreate(...sections: string[]): string[] {
  return sections.flatMap((section) => secOnly("orders", section, ["create"]));
}

/** «Клиенты → Групповая обработка» (`clients.gr_*.update`). */
function clientGroupOps(): string[] {
  return CATALOG.filter((e) => e.module === "clients" && e.section.startsWith("gr_")).map((e) => e.key);
}

const ALL_ORDER_STATUS_SLUGS = ["confirmed", "picking", "delivering", "delivered", "returned", "cancelled", "revert", "reopen", "date"];

/** Admin — hamma narsa + boshqaruv kalitlari. */
const ADMIN_KEYS = uniq(ALL_KEYS, ["access.manage", "users.manage", "audit.view"]);

const PRESET_BUILDERS: Record<string, () => string[]> = {
  admin: () => ADMIN_KEYS,

  /**
   * Operator — qisman veb-operator (buyurtma/mijoz/dashboard).
   * Kassir + skladchik + manager kombinatsiyasi EMAS: cash / warehouse / staff /
   * settings / access / reports to‘liq to‘plami defaultda YO‘Q — Access orqali beriladi.
   */
  operator: () =>
    uniq(
      mod("dashboard"),
      secOnly("orders", "zakaz", ["view", "update", "copy", "history"]),
      orderCreate("sozdanie", "vozvrat_polki", "vozvrat_po_zakazu"),
      orderStatus(...ALL_ORDER_STATUS_SLUGS),
      secOnly("invoices", "vozvratnye", ["view"]),
      secOnly("clients", "klient", ["view", "create", "update"]),
      clientGroupOps(),
      secOnly("clients", "karta", ["view"]),
      secOnly("clients", "foto", ["view"]),
      secOnly("work_slots", "raboche_mesto", ["view"]),
      secOnly("staff", "konsignatsiya", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view"]),
      secOnly("reports", "dnevnye_kpi_plany", ["view"])
    ),

  director: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      modViewOnly("cash"),
      modViewOnly("warehouse"),
      modViewOnly("suppliers"),
      modViewOnly("staff"),
      mod("finance"),
      mod("audit"),
      sec("plans", "ustanovka_planov"),
      secOnly("work_slots", "raboche_mesto", ["view", "history", "update"]),
      secOnly("staff", "agent", ["activate", "deactivate"]),
      secOnly("staff", "sotrudniki", ["activate", "deactivate"]),
      secOnly("staff", "zarplaty", ["view", "copy", "approve", "status"]),
      sec("staff", "avans")
    ),

  sales_director: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      mod("plans"),
      secOnly("work_slots", "raboche_mesto", ["view", "update", "history"]),
      sec("staff", "avans")
    ),

  regional_manager: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      sec("plans", "nastroyka_utverzhdayushchih"),
      secOnly("plans", "ustanovka_planov", ["view", "update", "approve"]),
      sec("staff", "avans")
    ),

  commercial_director: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      mod("plans")
    ),

  accountant: () =>
    uniq(
      mod("cash"),
      mod("finance"),
      secOnly("dashboard", "finansy", ["view"]),
      mod("suppliers"),
      mod("reports"),
      modViewOnly("orders"),
      sec("settings", "valyuty"),
      sec("settings", "zakrytie_perioda"),
      sec("staff", "zarplaty"),
      sec("staff", "avans_limity"),
      secOnly("staff", "avans", ["view", "copy"]),
      secOnly("staff", "tabel", ["view", "history"]),
      secOnly("staff", "tabel_normativ", ["view"])
    ),

  cashier: () => uniq(mod("cash"), modViewOnly("orders"), modViewOnly("clients")),

  warehouse_manager: () =>
    uniq(
      mod("warehouse"),
      mod("invoices"),
      modViewOnly("orders"),
      modViewOnly("suppliers"),
      sec("staff", "skladchik")
    ),

  /**
   * Ombor operatsiyalari (kirim/transfer/blok) — to‘liq warehouse.* CRUD emas.
   * sklady create/update/delete berilmaydi (Access orqali qo‘lda).
   */
  storekeeper: () =>
    uniq(
      modViewOnly("warehouse"),
      secOnly("warehouse", "postuplenie", ["create", "update", "import", "status", "history"]),
      secOnly("warehouse", "peremeshchenie", ["create", "update", "transfer", "history"]),
      secOnly("warehouse", "bloki", ["create", "update"]),
      secOnly("staff", "skladchik", ["view"]),
      modViewOnly("invoices")
    ),

  skladchik: () =>
    uniq(
      modViewOnly("warehouse"),
      secOnly("warehouse", "postuplenie", ["create", "update", "import", "status", "history"]),
      secOnly("warehouse", "peremeshchenie", ["create", "update", "transfer", "history"]),
      secOnly("warehouse", "bloki", ["create", "update"]),
      secOnly("staff", "skladchik", ["view"]),
      modViewOnly("invoices")
    ),

  // Agent — buyurtma yaratish, mijoz qo'shish, dashboard
  agent: () =>
    uniq(
      secOnly("orders", "zakaz", ["view", "copy"]),
      orderCreate("sozdanie", "vozvrat_polki", "vozvrat_po_zakazu"),
      secOnly("invoices", "vozvratnye", ["view"]),
      secOnly("clients", "klient", ["view", "create", "update"]),
      secOnly("clients", "foto", ["view", "create", "void"]),
      sec("clients", "profil"),
      secOnly("dashboard", "prodazhi", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view", "update"]),
      secOnly("reports", "dnevnye_kpi_plany", ["view"]),
      secOnly("staff", "kpi", ["view"]),
      secOnly("staff", "tabel", ["view"])
    ),

  // Supervisor — ko'rish + agentlar + buyurtma tasdiqlash zanjirida qatnashish
  supervisor: () =>
    uniq(
      modViewOnly("orders"),
      modViewOnly("clients"),
      /** Mobil SVR yangi TT: agentga biriktirib yaratish */
      secOnly("clients", "klient", ["activate", "create"]),
      secOnly("clients", "foto", ["view"]),
      secOnly("staff", "agent", ["view", "activate", "assign"]),
      secOnly("staff", "supervayzer", ["view"]),
      secOnly("staff", "kpi", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view", "approve"]),
      secOnly("reports", "dnevnye_kpi_plany", ["view"]),
      secOnly("work_slots", "raboche_mesto", ["view", "create", "update", "assign", "history"]),
      /** Kassa: mijoz balanslari (qarz/to‘lov) — Access orqali ham beriladi. */
      secOnly("cash", "balansy_klientov", ["view", "copy"]),
      mod("dashboard"),
      sec("gps", "gps"),
      sec("staff", "avans")
    ),

  expeditor: () =>
    uniq(
      secOnly("orders", "zakaz", ["view"]),
      orderStatus("delivering", "delivered", "returned", "revert", "date"),
      orderCreate("vozvrat_polki", "vozvrat_po_zakazu"),
      secOnly("clients", "foto", ["view", "create", "void"]),
      modViewOnly("invoices"),
      secOnly("cash", "zayavki_na_oplatu", ["view"]),
      secOnly("cash", "dolgi_ekspeditora", ["view", "copy"])
    ),

  auditor: () =>
    uniq(
      sec("staff", "auditor"),
      sec("staff", "nastroyki_audita"),
      mod("audit"),
      modViewOnly("clients"),
      modViewOnly("orders")
    ),

  collector: () => uniq(secOnly("cash", "zayavki_na_oplatu", ["view"]), secOnly("cash", "oplaty_klientov", ["view", "create"])),
  gruzchik: () => uniq(modViewOnly("invoices"), modViewOnly("warehouse")),
  driver: () => uniq(modViewOnly("orders"), modViewOnly("invoices"), mod("routes")),
  dispatcher: () => uniq(modViewOnly("orders"), mod("routes"), sec("gps", "gps")),
  logist: () => uniq(modViewOnly("orders"), mod("routes"), modViewOnly("warehouse")),
  merchandiser: () => uniq(modViewOnly("clients"), secOnly("dashboard", "prodazhi", ["view"])),
  manager: () =>
    uniq(
      mod("dashboard"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      mod("reports"),
      secOnly("plans", "ustanovka_planov", ["view", "update", "approve"]),
      secOnly("plans", "nastroyka_utverzhdayushchih", ["view"]),
      secOnly("work_slots", "raboche_mesto", ["view", "history"]),
      secOnly("staff", "konsignatsiya", ["view"]),
      sec("staff", "avans")
    ),
  partner: () => uniq(modViewOnly("orders"), modViewOnly("clients")),
  storekeeper_view: () => modViewOnly("warehouse")
};

/** Berilgan rol uchun default ruxsat kalitlari (preset yo'q bo'lsa bo'sh). */
export function buildRoleDefaultKeys(roleKey: string): string[] {
  const builder = PRESET_BUILDERS[roleKey];
  return builder ? builder() : [];
}

/** Preset mavjud rollar ro'yxati. */
export function rolesWithPresets(): string[] {
  return Object.keys(PRESET_BUILDERS);
}
