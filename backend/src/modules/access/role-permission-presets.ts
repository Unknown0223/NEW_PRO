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

/** Modul bo'yicha faqat ko'rish (+copy, Excel) kalitlari. */
function modViewOnly(module: string): string[] {
  return CATALOG.filter((e) => e.module === module && (e.action === "view" || e.action === "copy" || e.action === "export")).map(
    (e) => e.key
  );
}

function uniq(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

/** O‘zining mobil belgisi + shaxsiy ariza (agent, kassir, ombor…). */
function tabelOwnPunch(): string[] {
  return uniq(
    secOnly("tabel", "mobilnaya_otmetka", ["view", "create"]),
    secOnly("tabel", "zayavki", ["view", "create"])
  );
}

/** Jamoa: jurnal, statistika, arizalarni tasdiqlash. */
function tabelLeadView(): string[] {
  return uniq(
    tabelOwnPunch(),
    secOnly("staff", "tabel", ["view"]),
    secOnly("tabel", "otmetki", ["view"]),
    secOnly("tabel", "statistika", ["view"]),
    secOnly("tabel", "zayavki", ["view", "create", "approve"]),
    secOnly("tabel", "smeny", ["view"]),
    secOnly("tabel", "ustroystva", ["assign"])
  );
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
      secOnly("orders", "zakaz", ["view", "update", "copy", "export", "history"]),
      orderCreate("sozdanie", "vozvrat_polki", "vozvrat_po_zakazu"),
      orderStatus(...ALL_ORDER_STATUS_SLUGS),
      secOnly("invoices", "vozvratnye", ["view"]),
      secOnly("clients", "klient", ["view", "create", "update"]),
      secOnly("clients", "profil", ["update"]),
      clientGroupOps(),
      secOnly("clients", "karta", ["view"]),
      secOnly("clients", "foto", ["view"]),
      secOnly("work_slots", "raboche_mesto", ["view"]),
      secOnly("staff", "konsignatsiya", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view"]),
      secOnly("reports", "dnevnye_kpi_plany", ["view"]),
      tabelOwnPunch()
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
      sec("staff", "zadachi_spisok"),
      sec("staff", "avans"),
      tabelLeadView(),
      secOnly("tabel", "statistika", ["view", "export"]),
      secOnly("tabel", "otmetki", ["view", "export"]),
      secOnly("settings", "tabel_pravila", ["view"])
    ),

  sales_director: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      mod("plans"),
      secOnly("work_slots", "raboche_mesto", ["view", "update", "history"]),
      sec("staff", "zadachi_spisok"),
      sec("staff", "avans"),
      tabelLeadView()
    ),

  regional_manager: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      sec("plans", "nastroyka_utverzhdayushchih"),
      secOnly("plans", "ustanovka_planov", ["view", "update", "approve"]),
      sec("staff", "zadachi_spisok"),
      sec("staff", "avans"),
      tabelLeadView()
    ),

  commercial_director: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      mod("plans"),
      tabelLeadView()
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
      secOnly("staff", "tabel_normativ", ["view"]),
      secOnly("tabel", "statistika", ["view"]),
      secOnly("tabel", "otmetki", ["view"]),
      secOnly("tabel", "zayavki", ["view"]),
      secOnly("tabel", "obhodnye", ["view"])
    ),

  cashier: () => uniq(mod("cash"), modViewOnly("orders"), modViewOnly("clients"), tabelOwnPunch()),

  warehouse_manager: () =>
    uniq(
      mod("warehouse"),
      mod("invoices"),
      modViewOnly("orders"),
      modViewOnly("suppliers"),
      sec("staff", "skladchik"),
      tabelOwnPunch()
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
      secOnly("warehouse", "peremeshchenie_filial", ["view", "create", "status", "transfer"]),
      secOnly("warehouse", "bloki", ["create", "update"]),
      secOnly("staff", "skladchik", ["view"]),
      modViewOnly("invoices"),
      tabelOwnPunch()
    ),

  skladchik: () =>
    uniq(
      modViewOnly("warehouse"),
      secOnly("warehouse", "postuplenie", ["create", "update", "import", "status", "history"]),
      secOnly("warehouse", "peremeshchenie", ["create", "update", "transfer", "history"]),
      secOnly("warehouse", "peremeshchenie_filial", ["view", "create", "status", "transfer"]),
      secOnly("warehouse", "bloki", ["create", "update"]),
      secOnly("staff", "skladchik", ["view"]),
      modViewOnly("invoices"),
      tabelOwnPunch()
    ),

  // Agent — buyurtma yaratish, mijoz qo'shish, dashboard
  agent: () =>
    uniq(
      secOnly("orders", "zakaz", ["view", "copy", "export"]),
      orderCreate("sozdanie", "vozvrat_polki", "vozvrat_po_zakazu"),
      secOnly("invoices", "vozvratnye", ["view"]),
      secOnly("clients", "klient", ["view", "create", "update"]),
      secOnly("clients", "foto", ["view", "create", "void"]),
      sec("clients", "profil"),
      secOnly("dashboard", "prodazhi", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view", "update"]),
      secOnly("reports", "dnevnye_kpi_plany", ["view"]),
      secOnly("staff", "kpi", ["view"]),
      secOnly("staff", "tabel", ["view"]),
      tabelOwnPunch()
    ),

  // Supervisor — ko'rish + agentlar + buyurtma tasdiqlash zanjirida qatnashish
  supervisor: () =>
    uniq(
      modViewOnly("orders"),
      modViewOnly("clients"),
      /** Mobil SVR yangi TT: agentga biriktirib yaratish */
      secOnly("clients", "klient", ["activate", "create"]),
      secOnly("clients", "profil", ["update"]),
      secOnly("clients", "foto", ["view"]),
      secOnly("staff", "agent", ["view", "activate", "assign"]),
      secOnly("staff", "supervayzer", ["view"]),
      secOnly("staff", "kpi", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view", "approve"]),
      secOnly("reports", "dnevnye_kpi_plany", ["view"]),
      secOnly("work_slots", "raboche_mesto", ["view", "create", "update", "assign", "history"]),
      /** Kassa: mijoz balanslari (qarz/to‘lov) — Access orqali ham beriladi. */
      secOnly("cash", "balansy_klientov", ["view", "export"]),
      mod("dashboard"),
      sec("gps", "agenty"),
      sec("gps", "trek"),
      sec("gps", "marshrut"),
      sec("staff", "zadachi_spisok"),
      sec("staff", "avans"),
      tabelLeadView()
    ),

  expeditor: () =>
    uniq(
      secOnly("orders", "zakaz", ["view", "export"]),
      orderStatus("delivering", "delivered", "returned", "revert", "date"),
      orderCreate("vozvrat_polki", "vozvrat_po_zakazu"),
      secOnly("clients", "foto", ["view", "create", "void"]),
      modViewOnly("invoices"),
      secOnly("cash", "zayavki_na_oplatu", ["view"]),
      secOnly("cash", "dolgi_ekspeditora", ["view", "copy"]),
      tabelOwnPunch()
    ),

  auditor: () =>
    uniq(
      sec("staff", "auditor"),
      sec("staff", "nastroyki_audita"),
      mod("audit"),
      modViewOnly("clients"),
      modViewOnly("orders"),
      tabelOwnPunch()
    ),

  collector: () =>
    uniq(secOnly("cash", "zayavki_na_oplatu", ["view"]), secOnly("cash", "oplaty_klientov", ["view", "create", "export"]), tabelOwnPunch()),
  gruzchik: () => uniq(modViewOnly("invoices"), modViewOnly("warehouse"), tabelOwnPunch()),
  driver: () =>
    uniq(modViewOnly("orders"), modViewOnly("invoices"), sec("gps", "dostavshchiki"), sec("gps", "trek"), sec("gps", "marshrut"), tabelOwnPunch()),
  dispatcher: () => uniq(modViewOnly("orders"), mod("gps"), sec("reports", "gps"), tabelLeadView()),
  logist: () =>
    uniq(
      modViewOnly("orders"),
      sec("gps", "dostavshchiki"),
      sec("gps", "trek"),
      sec("gps", "marshrut"),
      sec("reports", "gps"),
      modViewOnly("warehouse"),
      tabelLeadView()
    ),
  merchandiser: () => uniq(modViewOnly("clients"), secOnly("dashboard", "prodazhi", ["view"]), tabelOwnPunch()),
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
      sec("staff", "zadachi_spisok"),
      sec("staff", "avans"),
      tabelLeadView()
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
