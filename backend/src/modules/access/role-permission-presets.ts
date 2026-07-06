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

/** Admin — hamma narsa + boshqaruv kalitlari. */
const ADMIN_KEYS = uniq(ALL_KEYS, ["access.manage", "users.manage", "audit.view"]);

const PRESET_BUILDERS: Record<string, () => string[]> = {
  admin: () => ADMIN_KEYS,

  // Operator — admin'dan tashqari deyarli barcha veb-operatsiyalar (access.manage'siz)
  operator: () => ALL_KEYS.filter((k) => k !== "access.upravlenie.view"),

  director: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      mod("pivot"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      modViewOnly("cash"),
      modViewOnly("warehouse"),
      modViewOnly("suppliers"),
      modViewOnly("staff"),
      mod("finance"),
      mod("audit"),
      sec("plans", "ustanovka_planov"),
      secOnly("staff", "agent", ["activate", "deactivate"]),
      secOnly("staff", "sotrudniki", ["activate", "deactivate"])
    ),

  sales_director: () =>
    uniq(mod("dashboard"), mod("reports"), modViewOnly("orders"), modViewOnly("clients"), mod("plans")),

  regional_manager: () =>
    uniq(
      mod("dashboard"),
      mod("reports"),
      modViewOnly("orders"),
      modViewOnly("clients"),
      sec("plans", "nastroyka_utverzhdayushchih"),
      secOnly("plans", "ustanovka_planov", ["view", "update", "approve"])
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
      mod("suppliers"),
      mod("reports"),
      modViewOnly("orders"),
      sec("settings", "valyuty"),
      sec("settings", "zakrytie_perioda")
    ),

  cashier: () => uniq(mod("cash"), modViewOnly("orders"), modViewOnly("clients")),

  warehouse_manager: () =>
    uniq(mod("warehouse"), mod("invoices"), modViewOnly("orders"), modViewOnly("suppliers")),

  storekeeper: () => uniq(mod("warehouse"), modViewOnly("invoices")),

  skladchik: () => uniq(mod("warehouse"), mod("invoices")),

  // Agent — buyurtma yaratish, mijoz qo'shish, dashboard
  agent: () =>
    uniq(
      secOnly("orders", "zakaz", ["view", "create", "copy"]),
      secOnly("orders", "vozvrat", ["view", "create"]),
      secOnly("clients", "klient", ["view", "create", "update"]),
      sec("clients", "profil"),
      secOnly("dashboard", "prodazhi", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view", "update"])
    ),

  // Supervisor — ko'rish + agentlar + buyurtma tasdiqlash zanjirida qatnashish
  supervisor: () =>
    uniq(
      modViewOnly("orders"),
      modViewOnly("clients"),
      secOnly("clients", "klient", ["activate"]),
      secOnly("staff", "agent", ["view", "activate", "assign"]),
      secOnly("staff", "supervayzer", ["view"]),
      secOnly("plans", "ustanovka_planov", ["view", "approve"]),
      mod("dashboard"),
      sec("gps", "gps")
    ),

  expeditor: () =>
    uniq(
      secOnly("orders", "zakaz", ["view", "status"]),
      secOnly("orders", "vozvrat", ["view", "create", "status"]),
      modViewOnly("invoices"),
      secOnly("cash", "zayavki_na_oplatu", ["view"])
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
      secOnly("plans", "nastroyka_utverzhdayushchih", ["view"])
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
