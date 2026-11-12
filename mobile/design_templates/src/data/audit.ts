import type { RoleKey, ScreenKey } from "./design";

/**
 * Audit source of truth — `Unknown0223/NEW_PRO`, branch `main`,
 * `mobile/lib/features/**` (300 dart files · 80 page/screen widgets).
 * Each repo screen is mapped to the prototype screen that covers it.
 */
export type Coverage = "done" | "partial" | "todo";

export type RepoScreen = {
  file: string;
  label: string;
  role: RoleKey | "shared";
  screen?: ScreenKey;
  status: Coverage;
  note?: string;
};

export const repoScreens: RepoScreen[] = [
  /* ── auth (6) ─────────────────────────────────────────── */
  { file: "auth/session_splash_screen.dart", label: "Session splash", role: "shared", screen: "login", status: "done" },
  { file: "auth/login_screen.dart", label: "Login (slug + parol)", role: "shared", screen: "login", status: "done" },
  { file: "auth/pin_setup_screen.dart", label: "PIN o'rnatish", role: "shared", screen: "login", status: "done" },
  { file: "auth/pin_unlock_screen.dart", label: "PIN unlock", role: "shared", screen: "login", status: "done" },
  { file: "auth/bootstrap_screen.dart", label: "Bootstrap / full sync", role: "shared", screen: "bootstrap", status: "done" },
  { file: "auth/permission_gate_page.dart", label: "Ruxsatlar gate", role: "shared", screen: "permissions", status: "done", note: "Yangi qo'shildi" },

  /* ── agent (30) ───────────────────────────────────────── */
  { file: "agent/home/agent_home_page.dart", label: "Agent home", role: "agent", screen: "home", status: "done" },
  { file: "agent/visits/agent_visits_page.dart", label: "Vizitlar", role: "agent", screen: "visits", status: "done" },
  { file: "agent/visits/start_visit_screen.dart", label: "Vizitni boshlash", role: "agent", screen: "start-visit", status: "done", note: "Yangi qo'shildi" },
  { file: "agent/visits/visit_in_progress_screen.dart", label: "Faol vizit", role: "agent", screen: "visits", status: "done" },
  { file: "agent/clients/agent_clients_page.dart", label: "Savdo nuqtalari", role: "agent", screen: "clients", status: "done" },
  { file: "agent/clients/client_detail_screen.dart", label: "Mijoz kartasi", role: "agent", screen: "client-detail", status: "done", note: "Yangi qo'shildi" },
  { file: "agent/clients/new_client_page.dart", label: "Yangi nuqta", role: "agent", screen: "new-client", status: "done", note: "Yangi qo'shildi" },
  { file: "agent/clients/client_location_map_page.dart", label: "Mijoz lokatsiyasi", role: "agent", screen: "map", status: "done" },
  { file: "agent/clients/agent_debtors_page.dart", label: "Qarzdorlar", role: "agent", screen: "exp-debtors", status: "done" },
  { file: "agent/clients/agent_debtors_by_orders_page.dart", label: "Buyurtma bo'yicha qarz", role: "agent", screen: "debtors-by-orders", status: "done", note: "Yangi qo'shildi" },
  { file: "agent/orders/create_order_screen.dart", label: "Zakaz yaratish", role: "agent", screen: "order", status: "done" },
  { file: "agent/orders/agent_orders_page.dart", label: "Buyurtmalar", role: "agent", screen: "orders", status: "done" },
  { file: "agent/orders/agent_order_detail_page.dart", label: "Buyurtma detali", role: "agent", screen: "order-detail", status: "done" },
  { file: "agent/orders/agent_misc_orders_page.dart", label: "Maxsus zakazlar", role: "agent", screen: "shelf-return", status: "done" },
  { file: "agent/kpi/agent_kpi_page.dart", label: "KPI", role: "agent", screen: "kpi", status: "done" },
  { file: "agent/kpi/agent_kpi_calc_page.dart", label: "KPI oylik hisob", role: "agent", screen: "kpi-calc", status: "done", note: "Yangi qo'shildi" },
  { file: "agent/kpi/agent_kpi_route_page.dart", label: "Marshrut rejasi", role: "agent", screen: "route-plan", status: "done" },
  { file: "agent/kpi/agent_kpi_diagnostics_days_page.dart", label: "KPI kunlar diagnostikasi", role: "agent", screen: "kpi-calc", status: "partial", note: "Hisob ekranida tab" },
  { file: "agent/report/agent_report_page.dart", label: "Hisobotlar", role: "agent", screen: "report", status: "done" },
  { file: "agent/route/agent_route_page.dart", label: "Marshrut", role: "agent", screen: "route-plan", status: "done" },
  { file: "agent/misc/agent_map_page.dart", label: "Xarita", role: "agent", screen: "map", status: "done" },
  { file: "agent/misc/agent_search_page.dart", label: "Global qidiruv", role: "agent", screen: "search", status: "done", note: "Yangi qo'shildi" },
  { file: "agent/misc/agent_draft_page.dart", label: "Qoralamalar", role: "agent", screen: "drafts", status: "done" },
  { file: "agent/misc/agent_notifications_page.dart", label: "Bildirishnomalar", role: "agent", screen: "notifications", status: "done" },
  { file: "agent/misc/agent_settings_page.dart", label: "Sozlamalar", role: "agent", screen: "profile", status: "done" },
  { file: "agent/warehouse/agent_warehouse_stock_page.dart", label: "Ombor qoldig'i", role: "agent", screen: "warehouse", status: "done" },
  { file: "agent/tabel/agent_tabel_page.dart", label: "Tabel", role: "agent", screen: "tabel", status: "done" },
  { file: "agent/tabel/agent_tabel_detail_page.dart", label: "Tabel detallari", role: "agent", screen: "tabel-detail", status: "done" },
  { file: "agent/sync/manual_sync_screen.dart", label: "Manual sync", role: "agent", screen: "sync", status: "done" },
  { file: "agent/sync/sync_success_screen.dart", label: "Sync success", role: "agent", screen: "sync-success", status: "done", note: "Yangi qo'shildi" },

  /* ── expeditor (21) ───────────────────────────────────── */
  { file: "expeditor/home/expeditor_home_page.dart", label: "Ekspeditor home", role: "expeditor", screen: "exp-home", status: "done" },
  { file: "expeditor/deliveries/expeditor_deliveries_page.dart", label: "Yetkazishlar", role: "expeditor", screen: "exp-deliveries", status: "done" },
  { file: "expeditor/deliveries/expeditor_delivery_detail_page.dart", label: "Yetkazish detali", role: "expeditor", screen: "exp-delivery", status: "done" },
  { file: "expeditor/invoices/expeditor_invoices_page.dart", label: "Nakladnoylar", role: "expeditor", screen: "exp-invoices", status: "done", note: "Yangi qo'shildi" },
  { file: "expeditor/invoices/expeditor_invoice_detail_page.dart", label: "Nakladnoy detali", role: "expeditor", screen: "exp-invoices", status: "partial", note: "Sheet ichida" },
  { file: "expeditor/payments/expeditor_payments_page.dart", label: "To'lovlar", role: "expeditor", screen: "exp-payments", status: "done" },
  { file: "expeditor/payments/expeditor_payments_info_page.dart", label: "To'lov rekvizitlari", role: "expeditor", screen: "exp-pay-info", status: "done", note: "Yangi qo'shildi" },
  { file: "expeditor/returns/expeditor_returns_page.dart", label: "Qaytarishlar", role: "expeditor", screen: "exp-returns", status: "done" },
  { file: "expeditor/returns/expeditor_my_returns_page.dart", label: "Mening qaytarishlarim", role: "expeditor", screen: "exp-returns", status: "done" },
  { file: "expeditor/returns/expeditor_return_by_order_page.dart", label: "Buyurtma bo'yicha qaytarish", role: "expeditor", screen: "shelf-return", status: "done" },
  { file: "expeditor/debtors/expeditor_debtors_page.dart", label: "Qarzdorlar", role: "expeditor", screen: "exp-debtors", status: "done" },
  { file: "expeditor/debtors/expeditor_debtor_client_page.dart", label: "Qarzdor mijoz", role: "expeditor", screen: "exp-debtors", status: "done" },
  { file: "expeditor/debtors/expeditor_client_ledger_page.dart", label: "Mijoz ledger", role: "expeditor", screen: "exp-debtors", status: "done" },
  { file: "expeditor/debtors/expeditor_client_orders_page.dart", label: "Mijoz buyurtmalari", role: "expeditor", screen: "debtors-by-orders", status: "done" },
  { file: "expeditor/visits/expeditor_visits_page.dart", label: "Ekspeditor vizitlari", role: "expeditor", screen: "exp-visits", status: "done", note: "Yangi qo'shildi" },
  { file: "expeditor/visits/expeditor_unfinished_page.dart", label: "Tugallanmaganlar", role: "expeditor", screen: "exp-visits", status: "done", note: "Tab ichida" },
  { file: "expeditor/visits/expeditor_visits_map_page.dart", label: "Vizitlar xaritasi", role: "expeditor", screen: "map", status: "done" },
  { file: "expeditor/visits/expeditor_client_detail_page.dart", label: "Mijoz kartasi", role: "expeditor", screen: "client-detail", status: "done" },
  { file: "expeditor/visits/expeditor_client_map_page.dart", label: "Mijoz xaritasi", role: "expeditor", screen: "map", status: "done" },
  { file: "expeditor/settings/expeditor_settings_page.dart", label: "Sozlamalar", role: "expeditor", screen: "profile", status: "done" },
  { file: "expeditor/sync/expeditor_manual_sync_screen.dart", label: "Manual sync", role: "expeditor", screen: "sync", status: "done" },

  /* ── supervisor (15) ──────────────────────────────────── */
  { file: "supervisor/home/supervisor_home_page.dart", label: "Supervayzer home", role: "supervisor", screen: "sup-home", status: "done" },
  { file: "supervisor/dashboard/supervisor_dashboard_page.dart", label: "Dashboard", role: "supervisor", screen: "sup-home", status: "done" },
  { file: "supervisor/agents/supervisor_agents_page.dart", label: "Agentlar", role: "supervisor", screen: "sup-agents", status: "done" },
  { file: "supervisor/gps/supervisor_gps_page.dart", label: "GPS monitoring", role: "supervisor", screen: "sup-gps", status: "done" },
  { file: "supervisor/visits/supervisor_visits_page.dart", label: "Vizit nazorati", role: "supervisor", screen: "sup-visits", status: "done" },
  { file: "supervisor/kpi/supervisor_kpi_page.dart", label: "Hudud KPI", role: "supervisor", screen: "sup-kpi", status: "done" },
  { file: "supervisor/kpi/supervisor_kpi_route_page.dart", label: "Marshrut KPI", role: "supervisor", screen: "route-plan", status: "done" },
  { file: "supervisor/clients/supervisor_clients_page.dart", label: "Mijozlar", role: "supervisor", screen: "sup-clients", status: "done" },
  { file: "supervisor/clients/supervisor_new_client_page.dart", label: "Yangi mijoz", role: "supervisor", screen: "new-client", status: "done" },
  { file: "supervisor/clients/supervisor_client_edit_page.dart", label: "Mijozni tahrirlash", role: "supervisor", screen: "client-detail", status: "partial", note: "Kartada tahrir" },
  { file: "supervisor/clients/supervisor_notifications_page.dart", label: "Bildirishnomalar", role: "supervisor", screen: "notifications", status: "done" },
  { file: "supervisor/outlets/supervisor_outlets_page.dart", label: "Nuqtalar bazasi", role: "supervisor", screen: "sup-outlets", status: "done", note: "Yangi qo'shildi" },
  { file: "supervisor/report/supervisor_report_page.dart", label: "Hudud hisoboti", role: "supervisor", screen: "sup-report", status: "done", note: "Yangi qo'shildi" },
  { file: "supervisor/menu/supervisor_menu_page.dart", label: "Menyu", role: "supervisor", screen: "menu", status: "done" },
  { file: "supervisor/settings/supervisor_settings_page.dart", label: "Sozlamalar", role: "supervisor", screen: "profile", status: "done" },

  /* ── cashier (3) ──────────────────────────────────────── */
  { file: "cashier/cashier_home_page.dart", label: "Kassa home", role: "cashier", screen: "cash-home", status: "done" },
  { file: "cashier/bank_transfer_inbox_page.dart", label: "Bank inbox", role: "cashier", screen: "cash-inbox", status: "done" },
  { file: "cashier/bank_transfer_inbox_detail_page.dart", label: "O'tkazma detali", role: "cashier", screen: "cash-detail", status: "done" },

  /* ── shared / tasks / attendance (5) ──────────────────── */
  { file: "shared/profile/profile_page.dart", label: "Profil", role: "shared", screen: "profile", status: "done" },
  { file: "attendance/attendance_hub_screen.dart", label: "Davomat hub", role: "shared", screen: "attendance", status: "done" },
  { file: "tasks/tasks_page.dart", label: "Vazifalar", role: "shared", screen: "tasks", status: "done" },
  { file: "tasks/task_create_page.dart", label: "Vazifa yaratish", role: "shared", screen: "task-create", status: "done", note: "Yangi qo'shildi" },
  { file: "tasks/task_detail_page.dart", label: "Vazifa detali", role: "shared", screen: "task-detail", status: "done", note: "Yangi qo'shildi" },
];

export type Finding = {
  id: string;
  severity: "blocker" | "major" | "minor";
  area: string;
  title: string;
  detail: string;
  fix: string;
  screen?: ScreenKey;
};

/** Issues found in this audit pass and the repair applied to the prototype. */
export const findings: Finding[] = [
  {
    id: "F-01", severity: "blocker", area: "Mijozlar",
    title: "Mijoz kartasi yo'q edi",
    detail: "client_detail_screen.dart — repo'dagi eng ko'p chaqiriladigan ekran. Ro'yxatdan bosilganda hech qayerga bormasdi.",
    fix: "Foto hisobot, qarz, buyurtma tarixi va sticky CTA bilan to'liq karta qurildi.",
    screen: "client-detail",
  },
  {
    id: "F-02", severity: "blocker", area: "Mijozlar",
    title: "Yangi nuqta formasi yo'q edi",
    detail: "new_client_page.dart — menyudagi «Добавить новую торговую точку» bandi ishlamasdi.",
    fix: "GPS olish, shahar, INN, toifa va foto majburiyligi bilan 3 qadamli forma.",
    screen: "new-client",
  },
  {
    id: "F-03", severity: "major", area: "KPI",
    title: "Oylik KPI hisob-kitobi yo'q edi",
    detail: "agent_kpi_calc_page.dart — «Расчёт по KPI», ish kunlari va premiya formulasi ko'rsatilmagan.",
    fix: "Ish kunlari, kunlik baza, oylik fakt, premiya va «bugun nima qilish» bloklari.",
    screen: "kpi-calc",
  },
  {
    id: "F-04", severity: "major", area: "Qidiruv",
    title: "Global qidiruv yo'q edi",
    detail: "agent_search_page.dart — mijoz, mahsulot va buyurtma bo'yicha yagona qidiruv.",
    fix: "Uch tur bo'yicha jonli filtr, so'nggi so'rovlar va bo'sh holat.",
    screen: "search",
  },
  {
    id: "F-05", severity: "major", area: "Ekspeditor",
    title: "Nakladnoylar bo'limi yo'q edi",
    detail: "expeditor_invoices_page.dart — jo'natma va qaytarma nakladnoylar, ombor/status filtri.",
    fix: "Ikki tab, filtr, qidiruv va detal sheet bilan ro'yxat.",
    screen: "exp-invoices",
  },
  {
    id: "F-06", severity: "major", area: "Ekspeditor",
    title: "Vizitlar va tugallanmaganlar yo'q edi",
    detail: "expeditor_visits_page.dart + expeditor_unfinished_page.dart.",
    fix: "Vizit ro'yxati, tugallanmagan tab va davom ettirish amali.",
    screen: "exp-visits",
  },
  {
    id: "F-07", severity: "major", area: "Vazifalar",
    title: "Vazifa yaratish/detal yo'q edi",
    detail: "task_create_page.dart va task_detail_page.dart — topshiriq faqat ko'rilardi.",
    fix: "Ijrochi, muddat, prioritet tanlovi va izohlar oqimi bilan CRUD.",
    screen: "task-create",
  },
  {
    id: "F-08", severity: "major", area: "Qarzlar",
    title: "Buyurtma bo'yicha qarzlar yo'q edi",
    detail: "agent_debtors_by_orders_page.dart — qarz faqat mijoz kesimida edi.",
    fix: "Nakladnoy kesimida aging, qisman to'lov va eslatma.",
    screen: "debtors-by-orders",
  },
  {
    id: "F-09", severity: "major", area: "Supervayzer",
    title: "Nuqtalar bazasi va hisobot yo'q edi",
    detail: "supervisor_outlets_page.dart va supervisor_report_page.dart.",
    fix: "Hudud kesimida nuqtalar, qamrov foizi va eksport.",
    screen: "sup-outlets",
  },
  {
    id: "F-10", severity: "minor", area: "Onboarding",
    title: "Ruxsatlar gate yo'q edi",
    detail: "permission_gate_page.dart — GPS/kamera/bildirishnoma ruxsati so'ralmasdi.",
    fix: "Har bir ruxsat uchun holat, «ruxsat berish» va o'tkazib yuborish.",
    screen: "permissions",
  },
  {
    id: "F-11", severity: "minor", area: "Vizit",
    title: "Vizit boshlash gate yo'q edi",
    detail: "start_visit_screen.dart — GPS aniqligi tekshiruvisiz vizit boshlanardi.",
    fix: "Masofa, aniqlik va selfie tekshiruvi bilan boshlash ekrani.",
    screen: "start-visit",
  },
  {
    id: "F-12", severity: "minor", area: "Sinxron",
    title: "Sync success ekrani yo'q edi",
    detail: "sync_success_screen.dart — yakuniy hisobot ko'rsatilmasdi.",
    fix: "Yuborilgan/qabul qilingan hisoblagichlar va keyingi qadam.",
    screen: "sync-success",
  },
  {
    id: "F-13", severity: "minor", area: "To'lovlar",
    title: "To'lov rekvizitlari yo'q edi",
    detail: "expeditor_payments_info_page.dart — mijozga hisob raqam berish yo'li yo'q.",
    fix: "Rekvizitlar, QR va nusxalash amali.",
    screen: "exp-pay-info",
  },
  {
    id: "F-14", severity: "minor", area: "Navigatsiya",
    title: "Menyu bandlari bo'sh ekranga borardi",
    detail: "18 bandli menyuda 6 ta band mos ekranga ulanmagan edi.",
    fix: "Barcha bandlar yangi ekranlarga ulandi; «Скоро» faqat Maosh uchun qoldi.",
    screen: "menu",
  },
];

export const auditModules = [
  { key: "auth", label: "Auth & onboarding", files: 23, icon: "lock" },
  { key: "agent", label: "Agent", files: 89, icon: "user" },
  { key: "expeditor", label: "Ekspeditor", files: 47, icon: "truck" },
  { key: "supervisor", label: "Supervayzer", files: 23, icon: "users" },
  { key: "cashier", label: "Kassir", files: 4, icon: "bank" },
  { key: "tasks", label: "Vazifalar & davomat", files: 13, icon: "list" },
] as const;

export function moduleOf(file: string) {
  if (file.startsWith("auth/")) return "auth";
  if (file.startsWith("agent/")) return "agent";
  if (file.startsWith("expeditor/")) return "expeditor";
  if (file.startsWith("supervisor/")) return "supervisor";
  if (file.startsWith("cashier/")) return "cashier";
  return "tasks";
}

export const repoStats = {
  repo: "Unknown0223/NEW_PRO",
  branch: "main",
  dartFiles: 300,
  screenWidgets: repoScreens.length,
  backendModules: 41,
  appVersion: "3.2.8+400",
};
