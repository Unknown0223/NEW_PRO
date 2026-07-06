/**
 * Eski (legacy) tekis kalitlarni yangi strukturali `<module>.<section>.<action>`
 * kalitlarga moslashtirish jadvali.
 *
 * Migratsiya skripti (`scripts/migrate-permissions-to-crud.ts`) shu yordamda
 * eski role/user biriktirishlarni yangi kalitlarga ko'chiradi. Mapping
 * NON-DESTRUCTIVE: eski kalitlar saqlanadi, yangilari qo'shiladi.
 */
import type { PermissionAction } from "./permission-model";

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
  { re: /(spisok|prosmotr|detal|detali|spisok_aktivnyh|rezultat|posmotret|istoriya|otchet|otchyot|dnevnoy|dostup)/, action: "view" }
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
  "clients.qr_kody_klientov": "clients.qr_kody",
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

/** To'g'ridan-to'g'ri (qo'lda) moslashtirishlar — heuristika noto'g'ri ishlaganda. */
const EXPLICIT_MAP: Record<string, string> = {
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
