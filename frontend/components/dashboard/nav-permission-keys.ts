/**
 * Sidebar / RouteAccessGate — bo‘lim uchun kamida bitta kalit yetarli.
 * Legacy + structured juftliklar (dashboard kabi) qo‘shilgan.
 *
 * Over-grant: OR-ro‘yxatda faqat shu bo‘limga tegishli kalitlar bo‘lsin —
 * masalan warehouse.sklady.view Users→Складчик ni ochmasin.
 */

export const NAV_PERM = {
  ordersView: ["orders.zakaz.view", "orders.view"],
  ordersCreate: ["orders.zakaz.create", "orders.create"],
  returnsCreate: ["orders.vozvrat.create"],
  returnsView: ["orders.vozvrat.view"],
  exchangeCreate: ["orders.obmen_i_otkaz.create"],
  exchangeView: ["orders.obmen_i_otkaz.view"],
  automation: ["automation.zaiavki.view"],

  clients: ["clients.klient.view", "clients.view"],
  clientsMap: ["clients.klient.view", "clients.klienty_na_karte"],
  clientsMerge: ["clients.obedinenie.view", "clients.obedinenye.view"],
  clientsEquipment: ["clients.oborudovanie.view"],
  /** Faqat ombor qoldiq — clients.view retail stock ni ochmasin. */
  clientsRetailStock: ["warehouse.ostatki.view"],
  /** GPS kalitlari — clients.klient.view visit planner ni ochmasin. */
  visitPlanner: ["gps.gps.view", "gps.dostup_k_gps"],

  invoicesAssembly: ["invoices.sborochnye.view", "invoices.sborochnye_nakladnye.view"],
  invoicesShipment: ["invoices.otgruzochnye.view", "invoices.otgruzochnye_nakladnye.view"],
  invoicesReturns: ["invoices.vozvratnye.view", "invoices.vozvratnye_nakladnye.view"],

  stockWarehouses: ["warehouse.sklady.view"],
  stockBlocks: ["warehouse.bloki.view"],
  stockBalances: ["warehouse.ostatki.view", "warehouse.ostatki_tovarov.view"],
  stockRecommended: ["warehouse.rekomendovannyy_zapas.view"],
  stockByDate: ["warehouse.ostatki_na_datu.view"],
  stockReceipts: ["warehouse.postuplenie.view", "warehouse.postuplenie_sklada.view"],
  stockTransfers: ["warehouse.peremeshchenie.view", "warehouse.transfer"],
  stockCorrection: ["warehouse.korrektirovka.view"],
  stockMaterial: ["warehouse.materialnyy_otchet.view"],

  cashPayments: ["cash.oplaty_klientov.view"],
  cashClientExpenses: ["cash.rashody_klienta.view"],
  cashOpeningBalances: ["cash.nachalnye_balansy.view", "cash.nachalnye_balansy_klientov.view"],
  cashClientBalances: ["cash.otchety.view", "cash.balansy.view"],
  /** Faqat kassa otchet — reports.view barcha kassa otchetlarini ochmasin. */
  cashReports: ["cash.otchety.view"],
  cashDesks: ["cash.kassa.view", "cash.view"],
  cashCurrency: ["cash.kurs_valyuty.view"],
  cashExpenses: ["cash.rashody_klienta.view", "cash.rashody.view"],
  cashPaymentRequests: ["cash.zayavki_na_oplatu.view"],

  suppliers: ["suppliers.postavshchik.view", "suppliers.view"],
  suppliersPayments: ["suppliers.oplaty.view", "suppliers.oplaty_postavshchikam.view"],
  suppliersBalances: ["suppliers.balansy.view", "suppliers.nachalnye_balansy_postavshchikov.view"],
  suppliersReconciliation: ["suppliers.postavshchik.view", "suppliers.akt.view"],

  reports: ["reports.otchety.view", "reports.view"],
  reportBuilder: [
    "reports.konstruktor.view",
    "reports.otchety.view",
    "reports.view",
    "pivot.otchety.view",
    "pivot.view",
    "plans.otchety.konstruktor_otchetov"
  ],

  /** Structured + legacy «список/просмотр» — Access «Дополнительно» ko‘pincha legacy beradi. */
  staffAgent: [
    "staff.agent.view",
    "staff.agent.spisok_agentov",
    "staff.agent.prosmotr_agenta"
  ],
  staffExpeditor: [
    "staff.ekspeditor.view",
    "staff.ekspeditor.spisok_ekspeditorov",
    "staff.ekspeditor.prosmotr_ekspeditor"
  ],
  staffSupervisor: [
    "staff.supervayzer.view",
    "staff.supervayzer.spisok_supervayzerov",
    "staff.supervayzer.prosmotr_detal"
  ],
  /** Faqat staff.skladchik — warehouse.sklady.view Users→Складчик ni ochmasin. */
  staffSkladchik: ["staff.skladchik.view"],
  staffCollector: ["staff.inkassator.view", "staff.inkassator.spisok", "staff.inkassator.detal"],
  staffAuditor: ["staff.auditor.view", "staff.auditor.spisok", "staff.auditor.detal"],
  staffEmployees: ["staff.sotrudniki.view", "staff.sotrudniki.polzovatel_spisok"],
  /** Faqat konsignatsiya — clients.klient.view ochmasin. */
  staffConsignment: ["staff.konsignatsiya.view"],
  staffPayroll: ["staff.zarplaty.view"],
  staffWorkdays: ["staff.rabochie_dni.view", "staff.tabel.view"],
  staffTimesheet: ["staff.tabel.view"],
  staffTasks: ["staff.zadachi.view"],
  workSlots: ["work_slots.raboche_mesto.view"],

  audit: ["audit.log.view", "audit.view"],
  settings: [
    "settings.profil_kompanii.view",
    "settings.tovar.view",
    "settings.tsena.view",
    "settings.filial.view"
  ]
} as const;
