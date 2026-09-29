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
  cashBankTransfers: ["cash.perechisleniya.view"],
  cashClientExpenses: ["cash.rashody_klienta.view"],
  cashOpeningBalances: [
    "cash.nachalnye_balansy.view",
    "cash.nachalnye_balansy_klientov.view",
    "cash.nachalnye_balansy_klientov.spisok_nachalnye_balansy"
  ],
  /** Faqat balanslar — `cash.otchety` barcha kassa otchetlarini ochmasin. Legacy Access «Дополнительно» ham. */
  cashClientBalances: [
    "cash.balansy_klientov.view",
    "cash.balansy.view",
    "cash.otchety.spisok_balansy_klientov",
    "cash.otchety.spisok_balansy_klientov_po_konsignatsii",
    "cash.otchety.detal_balans_klienta",
    "cash.otchety.detal_balans_klienta_po_konsignatsii"
  ],
  /** Faqat kassa otchet — balanslar menyusini ochmasin. */
  cashReports: ["cash.otchety.view"],
  cashDesks: ["cash.kassa.view", "cash.view"],
  cashCurrency: ["cash.kurs_valyuty.view"],
  cashExpenses: ["cash.rashody_klienta.view", "cash.rashody.view"],
  cashPaymentRequests: ["cash.zayavki_na_oplatu.view"],
  cashExpeditorDebts: ["cash.dolgi_ekspeditora.view"],

  suppliers: ["suppliers.postavshchik.view", "suppliers.view"],
  suppliersPayments: ["suppliers.oplaty.view", "suppliers.oplaty_postavshchikam.view"],
  suppliersBalances: ["suppliers.balansy.view", "suppliers.nachalnye_balansy_postavshchikov.view"],
  suppliersReconciliation: ["suppliers.postavshchik.view", "suppliers.akt.view"],

  reports: ["reports.otchety.view", "reports.view"],
  dailyKpi: ["reports.dnevnye_kpi_plany.view"],
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
  staffAdvances: ["staff.avans.view"],
  staffAdvanceLimits: ["staff.avans_limity.view", "staff.avans_limity.update"],
  financeAdvances: ["finance.avans.view", "finance.avans.approve"],
  cashPayrollQueue: ["cash.vydacha_zarplaty.view", "cash.vydacha_zarplaty.history"],
  staffWorkdays: ["staff.rabochie_dni.view", "staff.tabel.view"],
  staffTimesheet: ["staff.tabel.view"],
  staffTasks: ["staff.zadachi.view"],
  workSlots: ["work_slots.raboche_mesto.view"],

  audit: ["audit.log.view", "audit.view"],
  activity: ["activity.history.view"],
  settings: [
    "settings.profil_kompanii.view",
    "settings.tovar.view",
    "settings.kategoriya_tovara.view",
    "settings.tsena.view",
    "settings.tip_tseny.view",
    "settings.territoriya.view",
    "settings.sposob_oplaty.view",
    "settings.valyuty.view",
    "settings.filial.view",
    "settings.dolzhnost.view",
    "settings.edinitsy.view",
    "settings.brend.view",
    "settings.segment.view",
    "settings.kanal_sbyta.view",
    "settings.napravlenie_torgovli.view",
    "settings.format_klienta.view",
    "settings.tip_klienta.view",
    "settings.kategoriya_klienta.view",
    "settings.bonusy_i_skidki.view",
    "settings.ustanovit_natsenku.view",
    "settings.zakrytie_perioda.view",
    "settings.prichiny.view",
    "settings.tipy_zadach.view",
    "settings.inventar_i_korobka.view",
    "settings.oborudovanie.view",
    "settings.baza_znaniy.view",
    "settings.seansy.view",
    "settings.geo_granitsy.view",
    "settings.appearance.view",
    "settings.mobile_app.view",
    "settings.returns_filter.view",
    "settings.document_edit_lock.view",
    "settings.orders_consignment.view",
    "settings.web_staff_positions.view",
    "settings.timezone.view",
    "settings.initial_setup.view",
    "settings.system_migration.view"
  ]
} as const;
