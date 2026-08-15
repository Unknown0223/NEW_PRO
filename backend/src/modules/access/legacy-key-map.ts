/**
 * Eski (legacy) tekis kalitlarni yangi strukturali `<module>.<section>.<action>`
 * kalitlarga moslashtirish jadvali.
 *
 * Migratsiya skripti (`scripts/migrate-permissions-to-crud.ts`) shu yordamda
 * eski role/user biriktirishlarni yangi kalitlarga ko'chiradi. Mapping
 * NON-DESTRUCTIVE: eski kalitlar saqlanadi, yangilari qo'shiladi.
 */
import type { PermissionAction } from "./permission-model";
import { extractAction } from "./permission-model";

/** Oxirgi segment / butun kalitdagi verb naqshlari → amal tipi. */
const ACTION_PATTERNS: { re: RegExp; action: PermissionAction }[] = [
  // delete oldin tekshiriladi (udalit/udalenie)
  { re: /(udalit|udalenie|udalyon)/, action: "delete" },
  { re: /(deaktiv)/, action: "deactivate" },
  { re: /(aktiv)/, action: "activate" },
  { re: /(import)/, action: "import" },
  { re: /(skachat|excel|eksport|raspechat|pechat|vygruz)/, action: "copy" },
  { re: /(sozdat|sozdanie|dobavit|dobavlenie|generatsiya)/, action: "create" },
  { re: /(izmenit|izmenenie|redaktirovanie|sohranit|sohranenie|sohran|ustanovit)/, action: "update" },
  { re: /(podtverdit|podtverzhdenie|otmenit|otmena|status|otpravit_na_utverzhdenie|sborka|proverka|sformirovat|zakryt|izyatie|zavershit|zavershenie)/, action: "status" },
  { re: /(odobreno|utverzh)/, action: "approve" },
  { re: /(prikrepit|otkrepit|privyazk|prikrepite)/, action: "assign" },
  { re: /(peremeshch)/, action: "transfer" },
  // istoriya → history (view emas) — history tugmalari view bilan ochilmasin
  { re: /(istoriya)/, action: "history" },
  { re: /(spisok|prosmotr|detal|detali|spisok_aktivnyh|rezultat|posmotret|otchet|otchyot|dnevnoy|dostup)/, action: "view" }
];

/** Eski `module.section` → yangi `module.section` slug aliaslari. */
const SECTION_ALIAS: Record<string, string> = {
  // orders
  "orders.zakaz": "orders.zakaz",
  "orders.vozvrat": "orders.vozvrat",
  "orders.obmen_i_otkaz": "orders.obmen_i_otkaz",
  "orders.status": "orders.status",
  "orders.usloviya_ogranicheniya_zakaza": "orders.usloviya_ogranicheniya",
  "orders.predlozhenie_dlya_sozdaniya_zakaza": "orders.predlozhenie",
  "orders.drugie_operytsii": "orders.drugie_operacii",
  // clients (top-level → klient)
  "clients": "clients.klient",
  "clients.profil_klienta": "clients.profil",
  "clients.qr_kody_klientov": "clients.klient",
  "clients.oborudovanie": "clients.oborudovanie",
  "clients.obedinenye": "clients.obedinenie",
  "clients.otchety": "clients.otchety",
  // invoices
  "invoices.sborochnye_nakladnye": "invoices.sborochnye",
  "invoices.otgruzochnye_nakladnye": "invoices.otgruzochnye",
  "invoices.vozvratnye_nakladnye": "invoices.vozvratnye",
  // cash
  "cash.oplaty_klientov": "cash.oplaty_klientov",
  "cash.rashody_klienta": "cash.rashody_klienta",
  "cash.nachalnye_balansy_klientov": "cash.nachalnye_balansy",
  "cash.otchety": "cash.otchety",
  "cash": "cash.kassa",
  "cash.kurs_valyuty": "cash.kurs_valyuty",
  "cash.prihody": "cash.prihody",
  "cash.zayavki_na_oplatu": "cash.zayavki_na_oplatu",
  "cash.dolgi_ekspeditora": "cash.dolgi_ekspeditora",
  // warehouse
  "warehouse.postuplenie_sklada": "warehouse.postuplenie",
  "warehouse.ostatki_tovarov": "warehouse.ostatki",
  // suppliers
  "suppliers": "suppliers.postavshchik",
  "suppliers.oplaty_postavshchikam": "suppliers.oplaty",
  "suppliers.nachalnye_balansy_postavshchikov": "suppliers.balansy",
  // plans
  "plans.nastroyka_utverzhdayushchih": "plans.nastroyka_utverzhdayushchih",
  "plans.ustanovka_planov": "plans.ustanovka_planov",
  "plans.otchety": "reports.otchety",
  "plans.otchety.konstruktor_otchetov": "reports.konstruktor.view",
  "plans.otchety.sozdat_publichnuyu_konfiguratsiyu": "reports.konstruktor.create",
  "plans.otchety.excel_eksport": "reports.konstruktor.copy",
  // staff
  "staff.agent": "staff.agent",
  "staff.ekspeditor": "staff.ekspeditor",
  "staff.supervayzer": "staff.supervayzer",
  "staff.inkassator": "staff.inkassator",
  "staff.auditor": "staff.auditor",
  "staff.nastroyki_audita": "staff.nastroyki_audita",
  "staff.sotrudniki": "staff.sotrudniki",
  "staff.partnyory": "staff.partnery",
  "staff.kpi": "staff.kpi",
  "staff.zarplaty": "staff.zarplaty",
  "staff.rabochie_dni": "staff.rabochie_dni",
  "staff.tabel": "staff.tabel",
  "staff.zadachi": "staff.zadachi",
  // gps
  "gps": "gps.gps"
};

/** Dashboard — har bir kalit alohida view bo'lim. */
const DASHBOARD_MAP: Record<string, string> = {
  "dashboard.prodazhi": "dashboard.prodazhi.view",
  "dashboard.finansy": "dashboard.finansy.view",
  "dashboard.supervayzer": "dashboard.supervayzer.view",
  "dashboard.plan_fakt": "dashboard.plan_fakt.view"
};

/** Structured → legacy (Access UI structured deny must also drop legacy API keys). */
const DASHBOARD_STRUCTURED_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(DASHBOARD_MAP).map(([legacy, structured]) => [structured, legacy])
);

/** Modul-level `module.view` ↔ asosiy section `.view` (nav OR-gate uchun). */
const MODULE_VIEW_COMPANIONS: Record<string, string[]> = {
  "orders.view": ["orders.zakaz.view"],
  "orders.zakaz.view": ["orders.view"],
  "clients.view": ["clients.klient.view"],
  "clients.klient.view": ["clients.view"],
  "suppliers.view": ["suppliers.postavshchik.view"],
  "suppliers.postavshchik.view": ["suppliers.view"],
  "cash.view": ["cash.kassa.view"],
  "cash.kassa.view": ["cash.view"],
  "reports.view": ["reports.otchety.view", "reports.konstruktor.view"],
  "reports.otchety.view": ["reports.view"],
  "reports.konstruktor.view": ["reports.view", "pivot.otchety.view"],
  "pivot.view": ["pivot.otchety.view", "reports.konstruktor.view"],
  "pivot.otchety.view": ["pivot.view", "reports.konstruktor.view"],
  "warehouse.view": ["warehouse.ostatki.view"],
  "warehouse.ostatki.view": ["warehouse.view"]
};

let explicitReverseCache: Map<string, string[]> | null = null;

function reverseExplicitMap(): Map<string, string[]> {
  if (explicitReverseCache) return explicitReverseCache;
  const m = new Map<string, string[]>();
  for (const [legacy, structured] of Object.entries(EXPLICIT_MAP)) {
    const arr = m.get(structured) ?? [];
    arr.push(legacy);
    m.set(structured, arr);
  }
  explicitReverseCache = m;
  return m;
}

/**
 * Access patch / resolve: bitta kalit → juftliklar (legacy ↔ structured, modul.view).
 * Admin «Снять» / «Дополнительно» allow: orphan juftliklar me-permissions / navda
 * qolmasin yoki yo‘qolmasin (deny bilan simmetrik).
 *
 * Muhim: allaqachon strukturali `module.section.action` kalitlarga
 * `mapLegacyKeyToStructured` qo‘llanmaydi — aks holda `staff.agent.activate`
 * noto‘g‘ri `staff.agent.view` ga aylanib, deny view ni «yutib yuboradi».
 */
export function expandPermissionKeyAliases(keys: readonly string[]): string[] {
  const out = new Set<string>();
  let touchesDashboard = false;
  const rev = reverseExplicitMap();

  for (const raw of keys) {
    const key = raw.trim();
    if (!key) continue;
    out.add(key);

    const structuredDash = DASHBOARD_MAP[key];
    if (structuredDash) out.add(structuredDash);
    const legacyDash = DASHBOARD_STRUCTURED_TO_LEGACY[key];
    if (legacyDash) out.add(legacyDash);
    // Faqat aniq dashboard.view / bare dashboard — section view siblinglarni bog‘lamaydi.
    if (key === "dashboard.view" || key === "dashboard") touchesDashboard = true;

    const mapped = EXPLICIT_MAP[key];
    if (mapped) out.add(mapped);
    for (const legacy of rev.get(key) ?? []) out.add(legacy);

    // Legacy leaf (`staff.agent.spisok_agentov`) → structured (`staff.agent.view`).
    // Structured CRUD kalitlarga heuristika qo‘llanmaydi.
    if (!extractAction(key)) {
      const heur = mapLegacyKeyToStructured(key);
      if (heur) {
        out.add(heur);
        for (const companion of MODULE_VIEW_COMPANIONS[heur] ?? []) out.add(companion);
        for (const legacy of rev.get(heur) ?? []) out.add(legacy);
      }
    }

    for (const companion of MODULE_VIEW_COMPANIONS[key] ?? []) out.add(companion);
  }
  if (touchesDashboard) out.add("dashboard.view");
  return [...out];
}

/** To'g'ridan-to'g'ri (qo'lda) moslashtirishlar — heuristika noto'g'ri ishlaganda. */
export const EXPLICIT_MAP: Record<string, string> = {
  ...DASHBOARD_MAP,
  "orders.zakaz.spisok_zakazov": "orders.zakaz.view",
  "orders.zakaz.prosmotr_zakaza": "orders.zakaz.view",
  "orders.zakaz.sozdanie_zakaza": "orders.zakaz.create",
  "orders.drugie_operytsii.prihod_v_kassu": "orders.drugie_operacii.update",
  "orders.drugie_operytsii.izmenit_konsignatsiyu": "orders.drugie_operacii.update",
  "clients.spisok_klientov": "clients.klient.view",
  "clients.prosmotr_profilya_klienta": "clients.klient.view",
  "clients.dobavlenie_klienta": "clients.klient.create",
  "clients.import_fayla_excel_klient": "clients.klient.import",
  "clients.obnovlenie_klientov_s_excel": "clients.klient.import",
  "clients.klienty_na_karte": "clients.klient.view",
  "suppliers.spisok_postavshchikov": "suppliers.postavshchik.view",
  "suppliers.prosmotr_detal_postavshchikov": "suppliers.postavshchik.view",
  "suppliers.sozdanie_postavshchikov": "suppliers.postavshchik.create",
  "suppliers.izmenenie_postavshchikov": "suppliers.postavshchik.update",
  "suppliers.udalenie_postavshchikov": "suppliers.postavshchik.delete",
  "cash.spisok_kassy": "cash.kassa.view",
  "cash.zakryt_kassu": "cash.kassa.status",
  "gps.dostup_k_gps": "gps.gps.view",
  "gps.planiruemaya_posledovatelnost_vizita_sotrudnikov_izmenenie": "gps.gps.update",
  "access.manage": "access.manage"
};

function detectAction(s: string): PermissionAction {
  for (const { re, action } of ACTION_PATTERNS) {
    if (re.test(s)) return action;
  }
  return "view";
}

/**
 * Eski kalitni yangi strukturali kalitga moslashtiradi.
 * Topa olmasa `null` qaytaradi (legacy kalit o'z holicha qoladi).
 */
export function mapLegacyKeyToStructured(oldKey: string): string | null {
  if (EXPLICIT_MAP[oldKey]) return EXPLICIT_MAP[oldKey];

  const parts = oldKey.split(".");
  if (parts.length < 2) return null;
  const module = parts[0];

  // section: oxirgi segment "leaf", undan oldingilari section yo'li
  const leaf = parts[parts.length - 1];
  const sectionPath = parts.slice(0, -1).join("."); // module.section yoki module

  let newModuleSection = SECTION_ALIAS[sectionPath];
  if (!newModuleSection && parts.length === 2) {
    // module.leaf (top-level operatsiya) — module bo'yicha alias
    newModuleSection = SECTION_ALIAS[module];
  }
  if (!newModuleSection) return null;

  const action = detectAction(leaf || sectionPath);
  return `${newModuleSection}.${action}`;
}
