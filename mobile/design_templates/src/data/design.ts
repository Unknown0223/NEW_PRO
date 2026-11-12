export type ViewKey = "rollar" | "prototip" | "katalog" | "dizayn" | "harakat" | "tezlik" | "audit" | "flutter";

export const workspaceViews: {
  key: ViewKey;
  label: string;
  short: string;
  icon: string;
  group: "Mahsulot" | "Tizim";
  hint: string;
}[] = [
  { key: "rollar", label: "Rollar", short: "Rollar", icon: "users", group: "Mahsulot", hint: "4 rol va ularning ekranlari" },
  { key: "prototip", label: "Mobil Ilova", short: "Ilova", icon: "phone", group: "Mahsulot", hint: "54 interaktiv ekran · kirishdan buyurtmagacha" },
  { key: "katalog", label: "Shablonlar", short: "Katalog", icon: "grid", group: "Mahsulot", hint: "27 shablon · 54 ekran" },
  { key: "dizayn", label: "Dizayn tizimi", short: "Dizayn", icon: "palette", group: "Tizim", hint: "Token, tipografiya, komponentlar" },
  { key: "harakat", label: "Harakat", short: "Harakat", icon: "motion", group: "Tizim", hint: "Motion presetlar va qoidalar" },
  { key: "tezlik", label: "Unumdorlik", short: "Tezlik", icon: "gauge", group: "Tizim", hint: "60 FPS va optimizatsiyalar" },
  { key: "audit", label: "Audit & qamrov", short: "Audit", icon: "audit", group: "Tizim", hint: "Repo ekranlari, topilmalar va tuzatishlar" },
  { key: "flutter", label: "Flutter paket", short: "Flutter", icon: "code", group: "Tizim", hint: "Loyihaga tayyor kod · 14 fayl" },
];

export type RoleKey = "agent" | "expeditor" | "supervisor" | "cashier";

export type ScreenKey =
  | "home"
  | "visits"
  | "clients"
  | "order"
  | "kpi"
  | "notifications"
  | "login"
  | "bootstrap"
  | "orders"
  | "client-detail"
  | "new-client"
  | "search"
  | "kpi-calc"
  | "debtors-by-orders"
  | "start-visit"
  | "permissions"
  | "sync-success"
  | "exp-invoices"
  | "exp-visits"
  | "exp-pay-info"
  | "sup-outlets"
  | "sup-report"
  | "task-create"
  | "task-detail"
  | "order-detail"
  | "bonuses"
  | "report"
  | "map"
  | "route-plan"
  | "sync"
  | "profile"
  | "menu"
  | "tabel"
  | "tabel-detail"
  | "shelf-return"
  | "warehouse"
  | "drafts"
  | "attendance"
  | "tasks"
  | "exp-home"
  | "exp-deliveries"
  | "exp-delivery"
  | "exp-payments"
  | "exp-returns"
  | "exp-debtors"
  | "sup-home"
  | "sup-agents"
  | "sup-gps"
  | "sup-visits"
  | "sup-kpi"
  | "sup-clients"
  | "cash-home"
  | "cash-inbox"
  | "cash-detail";

export type Role = {
  key: RoleKey;
  name: string;
  short: string;
  description: string;
  accentId: string;
  homeScreen: ScreenKey;
  modules: string[];
  screensCount: number;
  nav: { key: ScreenKey; label: string }[];
  fab: { key: ScreenKey; label: string };
};

export const roles: Role[] = [
  {
    key: "agent",
    name: "Savdo agenti",
    short: "Agent",
    description: "Vizitlar, buyurtma yaratish, mijozlar va KPI. Kunlik marshrut bo'yicha ishlaydi.",
    accentId: "teal",
    homeScreen: "home",
    modules: ["Menyu (18)", "Vizitlar", "Buyurtmalar", "Katalog + Bonus", "Xarita", "Tabel"],
    screensCount: 30,
    nav: [
      { key: "home", label: "Asosiy" },
      { key: "visits", label: "Vizitlar" },
      { key: "clients", label: "Mijozlar" },
      { key: "profile", label: "Profil" },
    ],
    fab: { key: "order", label: "Buyurtma" },
  },
  {
    key: "expeditor",
    name: "Ekspeditor",
    short: "Ekspeditor",
    description: "Yetkazib berish, nakladnoy, to'lov qabul qilish, qaytarishlar va qarzdorlar.",
    accentId: "green",
    homeScreen: "exp-home",
    modules: ["Yetkazish", "Nakladnoy", "To'lovlar", "Qaytarish", "Qarzdorlar", "Xarita"],
    screensCount: 21,
    nav: [
      { key: "exp-home", label: "Asosiy" },
      { key: "exp-deliveries", label: "Yetkazish" },
      { key: "exp-debtors", label: "Qarzdor" },
      { key: "profile", label: "Profil" },
    ],
    fab: { key: "exp-payments", label: "To'lov" },
  },
  {
    key: "supervisor",
    name: "Supervayzer",
    short: "Supervayzer",
    description: "Jamoa nazorati: agentlar, GPS monitoring, vizit tekshiruvi va hudud KPI.",
    accentId: "emerald",
    homeScreen: "sup-home",
    modules: ["Dashboard", "Agentlar", "GPS", "Vizitlar", "KPI", "Mijozlar"],
    screensCount: 15,
    nav: [
      { key: "sup-home", label: "Asosiy" },
      { key: "sup-agents", label: "Agentlar" },
      { key: "sup-visits", label: "Vizitlar" },
      { key: "profile", label: "Profil" },
    ],
    fab: { key: "sup-gps", label: "GPS" },
  },
  {
    key: "cashier",
    name: "Kassir",
    short: "Kassir",
    description: "Bank o'tkazmalari inbox'i, to'lovlarni tasdiqlash va eksport.",
    accentId: "deep",
    homeScreen: "cash-home",
    modules: ["Inbox", "Tasdiqlash", "Eksport", "Naqd to'lov"],
    screensCount: 3,
    nav: [
      { key: "cash-home", label: "Asosiy" },
      { key: "cash-inbox", label: "Inbox" },
      { key: "tasks", label: "Vazifa" },
      { key: "profile", label: "Profil" },
    ],
    fab: { key: "cash-detail", label: "Tasdiq" },
  },
];

export const sharedModules = [
  { key: "login" as ScreenKey, label: "Kirish / PIN", text: "Barcha rollar uchun bitta auth oqimi" },
  { key: "attendance" as ScreenKey, label: "Davomat", text: "Selfie + GPS bilan kelish/ketish" },
  { key: "tasks" as ScreenKey, label: "Vazifalar", text: "Supervayzerdan agentga topshiriq" },
  { key: "notifications" as ScreenKey, label: "Bildirishnoma", text: "Rolga qarab guruhlangan" },
];

export type ThemeMode = "light" | "dark";
export type MotionLevel = "full" | "soft" | "off";

export type Accent = {
  id: string;
  name: string;
  hex: string;
  soft: string;
  ink: string;
  /** readable text colour when the accent itself is the background */
  onAccent: string;
  /** luminous variant for accent-coloured text on dark surfaces */
  bright: string;
  gradient: string;
};

export const accents: Accent[] = [
  { id: "teal", name: "Agent Iris", hex: "#5548F0", soft: "#EEEBFF", ink: "#2A1F9E", onAccent: "#FFFFFF", bright: "#A79BFF", gradient: "linear-gradient(135deg,#6A5BFF 0%,#3B2BD9 100%)" },
  { id: "green", name: "Ekspeditor Lime", hex: "#4ADE80", soft: "#EAFBF0", ink: "#14532D", onAccent: "#052E16", bright: "#86EFAC", gradient: "linear-gradient(135deg,#A3E635 0%,#34D399 100%)" },
  { id: "emerald", name: "Supervayzer Sky", hex: "#0369A1", soft: "#E6F4FB", ink: "#0B4A6F", onAccent: "#FFFFFF", bright: "#5CC8F5", gradient: "linear-gradient(135deg,#0A7BBD 0%,#075985 100%)" },
  { id: "deep", name: "Kassir Fuchsia", hex: "#C026D3", soft: "#FBEAFD", ink: "#701A75", onAccent: "#FFFFFF", bright: "#E879F9", gradient: "linear-gradient(135deg,#C026D3 0%,#86198F 100%)" },
  { id: "blue", name: "Azure", hex: "#2563EB", soft: "#E8F0FF", ink: "#12358F", onAccent: "#FFFFFF", bright: "#8FB4FF", gradient: "linear-gradient(135deg,#2F6BF0 0%,#1D3FBF 100%)" },
  { id: "violet", name: "Coral", hex: "#E0453A", soft: "#FFECEA", ink: "#8C1F17", onAccent: "#FFFFFF", bright: "#FF9A91", gradient: "linear-gradient(135deg,#E0453A 0%,#B32A21 100%)" },
  { id: "coral", name: "Amber", hex: "#F5A524", soft: "#FFF4DD", ink: "#7A4B00", onAccent: "#2B1A00", bright: "#FFCB6B", gradient: "linear-gradient(135deg,#FFC14D 0%,#F08C00 100%)" },
];

export const screens: {
  key: ScreenKey;
  label: string;
  short: string;
  group: string;
  role: RoleKey | "shared";
  description: string;
  tags: string[];
}[] = [
  {
    key: "home",
    label: "Bosh sahifa",
    short: "Home",
    group: "Asosiy",
    role: "agent",
    description: "Boshqaruv paneli: oylik reja, savdo dinamikasi, buyurtmalar oqimi, qarzdorlik, vazifalar va top mahsulotlar.",
    tags: ["Dashboard", "Bar chart", "Order flow"],
  },
  {
    key: "visits",
    label: "Vizitlar",
    short: "Visits",
    group: "Operatsiya",
    role: "agent",
    description: "Faol vizit kartasi, 4 bosqichli progress va tasdiqlash sheet'i. Haptic-ready tugmalar.",
    tags: ["Spring sheet", "Progress", "Haptic"],
  },
  {
    key: "clients",
    label: "Mijozlar",
    short: "Clients",
    group: "Operatsiya",
    role: "agent",
    description: "Qarz holati bo'yicha vizual prioritet, debounced qidiruv va virtual ro'yxat.",
    tags: ["Debounce 180ms", "Virtual list", "Chips"],
  },
  {
    key: "order",
    label: "Buyurtma",
    short: "Order",
    group: "Operatsiya",
    role: "agent",
    description: "Loyihadagi haqiqiy ketma-ketlik: mijoz → parametrlar → 8 ta majburiy shart → katalog → bonus va skidka → tasdiqlash zanjiri → kutish oynasi → yuborildi.",
    tags: ["8 shart", "Bonus strategiya", "Held oyna"],
  },
  {
    key: "kpi",
    label: "KPI paneli",
    short: "KPI",
    group: "Analitika",
    role: "agent",
    description: "Reja va fakt, animatsiyalangan bar chart, bonus zinapoyasi va reyting.",
    tags: ["Bar grow", "Ring", "Count-up"],
  },
  {
    key: "notifications",
    label: "Bildirishnomalar",
    short: "Inbox",
    group: "Analitika",
    role: "shared",
    description: "Guruhlangan bildirishnomalar, o'qilgan holat va sinxronlash ogohlantirishlari.",
    tags: ["Grouped", "Read state", "Toast"],
  },
  {
    key: "login",
    label: "Kirish / PIN",
    short: "Auth",
    group: "Onboarding",
    role: "shared",
    description: "Sales Arena brendli kirish: logotip chiziladi va tepaga ko'tariladi, maydonlar ketma-ket ochiladi, pastdan brend to'lqini ko'tariladi. PIN/Face ID dan so'ng ekranni to'lqin qoplaydi.",
    tags: ["Brend to'lqini", "Logotip chizish", "PIN + Face ID"],
  },
  {
    key: "profile",
    label: "Profil",
    short: "Profile",
    group: "Asosiy",
    role: "shared",
    description: "Profil, tema tanlovi, sinxronlash holati va tizim sozlamalari.",
    tags: ["Theme switch", "Sync", "Settings"],
  },
  {
    key: "bootstrap",
    label: "Kirish animatsiyasi",
    short: "Motion",
    group: "Onboarding",
    role: "shared",
    description: "Kirish tasdiqlangach: brend to'lqini pastga oqib tushadi, rolga xos transport sahnasi, ism bilan salomlashuv va 6 bosqichli ish joyi tayyorlanishi — so'ng transport jo'nab ketadi.",
    tags: ["Rol sahnasi", "Brend to'lqini", "Sinxron"],
  },
  {
    key: "sync",
    label: "Oddiy sinxronlash",
    short: "Sync",
    group: "Onboarding",
    role: "shared",
    description: "Alohida oddiy sinxron ekrani: rolga tegishli ma'lumotlar ro'yxati va «Hozir sinxronlash» tugmasi.",
    tags: ["Ro'yxat", "Oflayn kesh", "Qo'lda sinxron"],
  },
  {
    key: "menu",
    label: "To'liq Menyu (Drawer)",
    short: "Menyu",
    group: "Asosiy",
    role: "shared",
    description: "Rolga mos barcha 18 ta bo'lim: yangi nuqta, almashtirish, s polki vazvrat, qoldiq, tabel va sozlamalar.",
    tags: ["18 band", "Rolga mos", "Drawer"],
  },
  {
    key: "tabel",
    label: "Tabel · Oylik kalendar",
    short: "Tabel",
    group: "Analitika",
    role: "agent",
    description: "0 / 0.5 / 1 / В / О / Б / К statuslari bilan to'liq oylik davomat kalendari va kunlik sheet.",
    tags: ["7 status", "Kalendar", "Day sheet"],
  },
  {
    key: "tabel-detail",
    label: "Tabel · Detal jadval",
    short: "Tabel+",
    group: "Analitika",
    role: "agent",
    description: "Statuslar bo'yicha yig'indi kartalari, filtr chiplari va kunlik ish soatlari jadvali.",
    tags: ["Filter chips", "Summary", "Audit"],
  },
  {
    key: "shelf-return",
    label: "Vazvrat va S polki",
    short: "S polki",
    group: "Operatsiya",
    role: "agent",
    description: "3 xil qaytarish: To'liq, Qisman va Polkadan (s polki) + Almashtirish so'rovi, sabablar va foto.",
    tags: ["S polki", "Almashtirish", "Foto"],
  },
  {
    key: "warehouse",
    label: "Ombor qoldiqlari",
    short: "Qoldiq",
    group: "Operatsiya",
    role: "agent",
    description: "Omborlar kesimida mahsulot qoldiqlari, korobka/dona hisobi va narx turlari.",
    tags: ["Ombor", "Korobka", "Qidiruv"],
  },
  {
    key: "drafts",
    label: "Qoralamalar (Draft)",
    short: "Draft",
    group: "Operatsiya",
    role: "agent",
    description: "Tugallanmagan buyurtmalar, ushlab turilgan zakazlar va bir bosishda davom ettirish.",
    tags: ["Offline", "Resume", "Sync"],
  },
  {
    key: "orders",
    label: "Mening buyurtmalarim",
    short: "Zakazlar",
    group: "Operatsiya",
    role: "agent",
    description: "Agentning barcha buyurtmalari: holat filtri, summa va detalga o'tish.",
    tags: ["Status filter", "Haftalik", "Detail"],
  },
  {
    key: "order-detail",
    label: "Buyurtma detali",
    short: "Detail",
    group: "Operatsiya",
    role: "agent",
    description: "Holat tarixi (timeline), tovarlar va 5 daqiqalik tahrirlash oynasi taymeri.",
    tags: ["Timeline", "Edit window 5:00", "Bekor qilish"],
  },
  {
    key: "bonuses",
    label: "Mening bonuslarim",
    short: "Bonuslar",
    group: "Analitika",
    role: "agent",
    description: "Hisoblangan bonuslar, zinapoya (3% / 5% / 8%) va aksiya qoidalari tarixi.",
    tags: ["Zinapoya", "842 500 so'm", "Aksiyalar"],
  },
  {
    key: "report",
    label: "Hisobotlar",
    short: "Hisobot",
    group: "Analitika",
    role: "agent",
    description: "Haftalik/oylik yakun: savdo, buyurtmalar, qaytarishlar va kunlik grafik.",
    tags: ["Hafta / Oy", "Export", "Grafik"],
  },
  {
    key: "map",
    label: "Xarita",
    short: "Xarita",
    group: "Operatsiya",
    role: "agent",
    description: "Bugungi marshrut xaritada: nuqtalar, keyingi to'xtash va vizitni boshlash.",
    tags: ["Marshrut", "Pinlar", "Navigatsiya"],
  },
  {
    key: "route-plan",
    label: "Kunlik reja (marshrut)",
    short: "Reja",
    group: "Operatsiya",
    role: "agent",
    description: "Kunlik marshrut rejasi: vaqt chizig'i, bajarilish foizi va marshrut KPI.",
    tags: ["Timeline", "42%", "Route KPI"],
  },
  {
    key: "client-detail", label: "Mijoz kartasi", short: "Karta", group: "Operatsiya", role: "agent",
    description: "Balans, kredit qoldig'i, foto hisobot, buyurtmalar va ledger tablari, sticky CTA.",
    tags: ["Foto hisobot", "Ledger", "Sticky CTA"],
  },
  {
    key: "new-client", label: "Yangi savdo nuqtasi", short: "Yangi", group: "Operatsiya", role: "agent",
    description: "3 qadamli forma: nom/INN/shahar, GPS bilan bog'lash va foto, yakuniy tasdiq.",
    tags: ["GPS gate", "INN validatsiya", "3 qadam"],
  },
  {
    key: "search", label: "Global qidiruv", short: "Qidiruv", group: "Asosiy", role: "shared",
    description: "Mijoz, mahsulot va buyurtmalar bo'yicha yagona qidiruv, so'nggi so'rovlar tarixi.",
    tags: ["3 tur", "Jonli filtr", "Tarix"],
  },
  {
    key: "kpi-calc", label: "KPI oylik hisob", short: "Hisob", group: "Analitika", role: "agent",
    description: "Ish kunlari, kunlik baza, premiya formulasi va kunlar diagnostikasi.",
    tags: ["Premiya", "Diagnostika", "Prognoz"],
  },
  {
    key: "debtors-by-orders", label: "Buyurtma bo'yicha qarz", short: "Qarz+", group: "Operatsiya", role: "agent",
    description: "Nakladnoy kesimida aging guruhlari, eslatma va to'lov qabul qilish.",
    tags: ["Aging", "Eslatma", "To'lov"],
  },
  {
    key: "start-visit", label: "Vizitni boshlash", short: "Start", group: "Operatsiya", role: "agent",
    description: "GPS aniqligi va selfie tasdig'idan o'tgach vizit ochiladi.",
    tags: ["GPS gate", "Selfie", "Reja"],
  },
  {
    key: "permissions", label: "Ruxsatlar", short: "Ruxsat", group: "Onboarding", role: "shared",
    description: "GPS, kamera, bildirishnoma va xotira ruxsatlari; majburiylari ajratilgan.",
    tags: ["Gate", "Toggle", "Majburiy"],
  },
  {
    key: "sync-success", label: "Sinxron yakuni", short: "Success", group: "Onboarding", role: "shared",
    description: "Yuborilgan buyurtma/foto/mijoz hisoblagichlari va keyingi avtomatik sinxron.",
    tags: ["Hisoblagich", "Konfetti", "Keyingi qadam"],
  },
  {
    key: "exp-invoices", label: "Nakladnoylar", short: "Nakladnoy", group: "Ekspeditor", role: "expeditor",
    description: "Jo'natma va qaytarma nakladnoylar, ombor filtri, qidiruv va detal sheet.",
    tags: ["2 tab", "Ombor filtr", "Sheet"],
  },
  {
    key: "exp-visits", label: "Ekspeditor vizitlari", short: "Vizit", group: "Ekspeditor", role: "expeditor",
    description: "Bajarilgan va tugallanmagan tashriflar, sabab va davom ettirish.",
    tags: ["Unfinished", "Sabab", "Davom"],
  },
  {
    key: "exp-pay-info", label: "To'lov rekvizitlari", short: "Rekvizit", group: "Ekspeditor", role: "expeditor",
    description: "Hisob raqam, MFO, INN, QR va mijozga yuborish.",
    tags: ["QR", "Nusxalash", "SMS"],
  },
  {
    key: "sup-outlets", label: "Nuqtalar bazasi", short: "Nuqtalar", group: "Supervayzer", role: "supervisor",
    description: "Hudud kesimida nuqtalar, qamrov foizi va biriktirilmagan nuqtalar.",
    tags: ["Qamrov", "Hudud", "Biriktirish"],
  },
  {
    key: "sup-report", label: "Hudud hisoboti", short: "Hisobot", group: "Supervayzer", role: "supervisor",
    description: "Reja/fakt, agentlar kesimi va diqqat talab qiladigan holatlar.",
    tags: ["Agentlar", "Ogohlantirish", "Eksport"],
  },
  {
    key: "task-create", label: "Vazifa yaratish", short: "Yangi", group: "Umumiy", role: "shared",
    description: "Ijrochi, muddat, prioritet va tur tanlovi bilan topshiriq biriktirish.",
    tags: ["Ijrochi", "Muddat", "Validatsiya"],
  },
  {
    key: "task-detail", label: "Vazifa detali", short: "Vazifa", group: "Umumiy", role: "shared",
    description: "Topshiriq kartasi, mijoz/xarita havolalari va jonli izohlar oqimi.",
    tags: ["Izohlar", "Bajarildi", "Havolalar"],
  },
  {
    key: "attendance",
    label: "Davomat",
    short: "Attendance",
    group: "Umumiy",
    role: "shared",
    description: "Selfie va GPS bilan kelish/ketish. Oflayn navbat, kechikish ogohlantirishi.",
    tags: ["Camera", "GPS", "Offline queue"],
  },
  {
    key: "tasks",
    label: "Vazifalar",
    short: "Tasks",
    group: "Umumiy",
    role: "shared",
    description: "Supervayzerdan agentga topshiriqlar, muddat, holat va izohlar.",
    tags: ["Kanban", "Deadline", "Comments"],
  },
  {
    key: "exp-home",
    label: "Ekspeditor · Bosh sahifa",
    short: "Exp Home",
    group: "Ekspeditor",
    role: "expeditor",
    description: "Bugungi yetkazishlar, yig'ilgan naqd pul, marshrut progressi va sinxron holati.",
    tags: ["Cash counter", "Route progress", "Sync"],
  },
  {
    key: "exp-deliveries",
    label: "Yetkazishlar",
    short: "Deliveries",
    group: "Ekspeditor",
    role: "expeditor",
    description: "Nakladnoylar ro'yxati, mijoz bo'yicha guruhlash, holat filtrlari.",
    tags: ["Status chips", "Swipe", "Grouped"],
  },
  {
    key: "exp-delivery",
    label: "Yetkazish detali",
    short: "Delivery",
    group: "Ekspeditor",
    role: "expeditor",
    description: "Nakladnoy pozitsiyalari, qisman yetkazish, imzo va foto tasdiq.",
    tags: ["Partial", "Signature", "Photo"],
  },
  {
    key: "exp-payments",
    label: "To'lov qabul qilish",
    short: "Payments",
    group: "Ekspeditor",
    role: "expeditor",
    description: "Naqd / karta / o'tkazma, summa klaviaturasi, chek chop etish.",
    tags: ["Numpad", "Receipt", "Split"],
  },
  {
    key: "exp-returns",
    label: "Qaytarishlar",
    short: "Returns",
    group: "Ekspeditor",
    role: "expeditor",
    description: "Buyurtma bo'yicha qaytarish, sabab, foto va ombor tasdiqlash.",
    tags: ["Reason", "Photo", "Approve"],
  },
  {
    key: "exp-debtors",
    label: "Qarzdorlar",
    short: "Debtors",
    group: "Ekspeditor",
    role: "expeditor",
    description: "Mijoz kitobi (ledger), muddati o'tgan qarzlar va yig'ish rejasi.",
    tags: ["Ledger", "Overdue", "Aging"],
  },
  {
    key: "sup-home",
    label: "Supervayzer · Dashboard",
    short: "Sup Home",
    group: "Supervayzer",
    role: "supervisor",
    description: "Jamoa holati real vaqtda: faol agentlar, vizitlar, reja bajarilishi.",
    tags: ["Realtime", "Team KPI", "Alerts"],
  },
  {
    key: "sup-agents",
    label: "Agentlar",
    short: "Agents",
    group: "Supervayzer",
    role: "supervisor",
    description: "Har bir agentning kunlik progressi, oxirgi lokatsiyasi va natijalari.",
    tags: ["Ranking", "Last seen", "Progress"],
  },
  {
    key: "sup-gps",
    label: "GPS monitoring",
    short: "GPS",
    group: "Supervayzer",
    role: "supervisor",
    description: "Xaritada agentlar, marshrut tarixi va geo-fence buzilishlari.",
    tags: ["Map", "Trail", "Geofence"],
  },
  {
    key: "sup-visits",
    label: "Vizit nazorati",
    short: "Visits",
    group: "Supervayzer",
    role: "supervisor",
    description: "Agentlar vizitlarini tekshirish, foto hisobotlarni tasdiqlash yoki rad etish.",
    tags: ["Review", "Approve", "Photo"],
  },
  {
    key: "sup-kpi",
    label: "Hudud KPI",
    short: "KPI",
    group: "Supervayzer",
    role: "supervisor",
    description: "Hudud bo'yicha reja/fakt, agentlar taqqoslash va trend.",
    tags: ["Compare", "Trend", "Export"],
  },
  {
    key: "sup-clients",
    label: "Mijozlar boshqaruvi",
    short: "Clients",
    group: "Supervayzer",
    role: "supervisor",
    description: "Yangi mijoz tasdiqlash, tahrirlash va agentga biriktirish.",
    tags: ["Approve", "Assign", "Edit"],
  },
  {
    key: "cash-home",
    label: "Kassir · Bosh sahifa",
    short: "Cash Home",
    group: "Kassir",
    role: "cashier",
    description: "Kunlik kassa, kutilayotgan tasdiqlar va bank o'tkazmalari statistikasi.",
    tags: ["Daily total", "Pending", "Stats"],
  },
  {
    key: "cash-inbox",
    label: "Bank o'tkazmalar inbox",
    short: "Inbox",
    group: "Kassir",
    role: "cashier",
    description: "Kelgan o'tkazmalar ro'yxati, mijozga bog'lash va tasdiqlash navbati.",
    tags: ["Inbox", "Match", "Queue"],
  },
  {
    key: "cash-detail",
    label: "O'tkazma detali",
    short: "Detail",
    group: "Kassir",
    role: "cashier",
    description: "Buyurtma bilan solishtirish, tasdiqlash yoki qaytarish, eksport.",
    tags: ["Compare", "Approve", "Export"],
  },
];

export type Template = {
  id: string;
  no: string;
  role: RoleKey | "shared";
  title: string;
  subtitle: string;
  category: "Onboarding" | "Operatsiya" | "Analitika" | "Sozlama";
  status: "Tayyor" | "Konsept" | "Yangi";
  screen?: ScreenKey;
  kind:
    | "login"
    | "home"
    | "visits"
    | "visit-live"
    | "clients"
    | "client"
    | "order"
    | "catalog"
    | "kpi"
    | "notifications"
    | "tabel"
    | "settings"
    | "delivery"
    | "payment"
    | "map"
    | "team"
    | "inbox"
    | "attendance"
    | "tasks";
  tags: string[];
  effort: string;
};

export const templates: Template[] = [
  {
    id: "t1",
    role: "shared",
    no: "01",
    title: "Kirish va PIN",
    subtitle: "Biometrik kirish, 4 xonali PIN, oflayn indikator",
    category: "Onboarding",
    status: "Tayyor",
    screen: "login",
    kind: "login",
    tags: ["pin-dots", "biometric", "fade-up"],
    effort: "0.5 kun",
  },
  {
    id: "t2",
    role: "agent",
    no: "02",
    title: "Bosh sahifa",
    subtitle: "Reja, savdo grafigi, buyurtma oqimi va vazifalar",
    category: "Onboarding",
    status: "Yangi",
    screen: "home",
    kind: "home",
    tags: ["stagger", "live-timer", "gradient-hero"],
    effort: "1 kun",
  },
  {
    id: "t3",
    role: "agent",
    no: "03",
    title: "Vizitlar ro'yxati",
    subtitle: "Marshrut, prioritet va bugungi vizitlar",
    category: "Operatsiya",
    status: "Tayyor",
    screen: "visits",
    kind: "visits",
    tags: ["filter-chips", "swipe", "skeleton"],
    effort: "0.5 kun",
  },
  {
    id: "t4",
    role: "agent",
    no: "04",
    title: "Faol vizit",
    subtitle: "Jonli taymer, 4 qadam va yakunlash sheet'i",
    category: "Operatsiya",
    status: "Yangi",
    screen: "visits",
    kind: "visit-live",
    tags: ["spring-sheet", "timer", "haptic"],
    effort: "1 kun",
  },
  {
    id: "t5",
    role: "agent",
    no: "05",
    title: "Mijozlar",
    subtitle: "Qarz prioriteti va tezkor qidiruv",
    category: "Operatsiya",
    status: "Tayyor",
    screen: "clients",
    kind: "clients",
    tags: ["debounce", "virtual-list", "bold-chip"],
    effort: "0.5 kun",
  },
  {
    id: "t6",
    role: "agent",
    no: "06",
    title: "Mijoz kartasi",
    subtitle: "Foto hisobot, qarz va buyurtma tarixi",
    category: "Operatsiya",
    status: "Konsept",
    kind: "client",
    tags: ["photo-grid", "timeline", "sticky-cta"],
    effort: "1.5 kun",
  },
  {
    id: "t7",
    role: "agent",
    no: "07",
    title: "Buyurtma yaratish",
    subtitle: "8 shart, bonus strategiyasi, bog'langan skidka, held oyna",
    category: "Operatsiya",
    status: "Yangi",
    screen: "order",
    kind: "order",
    tags: ["step-flow", "live-total", "optimistic"],
    effort: "2 kun",
  },
  {
    id: "t8",
    role: "agent",
    no: "08",
    title: "Katalog grid",
    subtitle: "Kategoriyalar, tezkor qo'shish va qoldiq",
    category: "Operatsiya",
    status: "Konsept",
    kind: "catalog",
    tags: ["grid-2", "add-to-cart", "stock-badge"],
    effort: "1 kun",
  },
  {
    id: "t9",
    role: "agent",
    no: "09",
    title: "KPI paneli",
    subtitle: "Reja/fakt, grafik va bonus zinapoyasi",
    category: "Analitika",
    status: "Yangi",
    screen: "kpi",
    kind: "kpi",
    tags: ["bar-grow", "count-up", "ring"],
    effort: "1.5 kun",
  },
  {
    id: "t10",
    role: "shared",
    no: "10",
    title: "Bildirishnomalar",
    subtitle: "Guruhlangan xabarlar va sinxron holati",
    category: "Analitika",
    status: "Yangi",
    screen: "notifications",
    kind: "notifications",
    tags: ["grouped", "read-state", "toast"],
    effort: "0.5 kun",
  },
  {
    id: "t11",
    role: "agent",
    no: "11",
    title: "Tabel",
    subtitle: "Ish jadvali va oylik hisob-kitob",
    category: "Analitika",
    status: "Konsept",
    kind: "tabel",
    tags: ["calendar", "sticky-head", "summary"],
    effort: "1.5 kun",
  },
  {
    id: "t12",
    role: "shared",
    no: "12",
    title: "Profil va sozlamalar",
    subtitle: "Tema, til, sinxronlash va xavfsizlik",
    category: "Sozlama",
    status: "Tayyor",
    screen: "profile",
    kind: "settings",
    tags: ["theme-switch", "segmented", "offline"],
    effort: "0.5 kun",
  },
  {
    id: "t13", role: "expeditor", no: "13", title: "Ekspeditor bosh sahifa", subtitle: "Yetkazishlar, naqd pul hisoblagichi, marshrut",
    category: "Operatsiya", status: "Yangi", screen: "exp-home", kind: "delivery", tags: ["cash-counter", "route", "sync"], effort: "1 kun",
  },
  {
    id: "t14", role: "expeditor", no: "14", title: "Yetkazish detali", subtitle: "Nakladnoy, qisman yetkazish, imzo",
    category: "Operatsiya", status: "Yangi", screen: "exp-delivery", kind: "delivery", tags: ["partial", "signature", "photo"], effort: "1.5 kun",
  },
  {
    id: "t15", role: "expeditor", no: "15", title: "To'lov qabul qilish", subtitle: "Numpad, naqd/karta, chek",
    category: "Operatsiya", status: "Yangi", screen: "exp-payments", kind: "payment", tags: ["numpad", "receipt", "split"], effort: "1 kun",
  },
  {
    id: "t16", role: "expeditor", no: "16", title: "Qaytarish va qarzdorlar", subtitle: "Ledger, aging, qaytarish sababi",
    category: "Operatsiya", status: "Tayyor", screen: "exp-debtors", kind: "clients", tags: ["ledger", "overdue", "reason"], effort: "1 kun",
  },
  {
    id: "t17", role: "supervisor", no: "17", title: "Supervayzer dashboard", subtitle: "Jamoa real vaqtda, ogohlantirishlar",
    category: "Analitika", status: "Yangi", screen: "sup-home", kind: "team", tags: ["realtime", "alerts", "team-kpi"], effort: "1.5 kun",
  },
  {
    id: "t18", role: "supervisor", no: "18", title: "GPS monitoring", subtitle: "Xarita, marshrut izi, geofence",
    category: "Analitika", status: "Yangi", screen: "sup-gps", kind: "map", tags: ["map", "trail", "geofence"], effort: "2 kun",
  },
  {
    id: "t19", role: "supervisor", no: "19", title: "Agentlar va vizit nazorati", subtitle: "Reyting, foto tasdiqlash",
    category: "Operatsiya", status: "Tayyor", screen: "sup-agents", kind: "team", tags: ["ranking", "review", "approve"], effort: "1 kun",
  },
  {
    id: "t20", role: "cashier", no: "20", title: "Kassir inbox", subtitle: "Bank o'tkazmalar, mijozga bog'lash",
    category: "Operatsiya", status: "Yangi", screen: "cash-inbox", kind: "inbox", tags: ["inbox", "match", "queue"], effort: "1 kun",
  },
  {
    id: "t21", role: "cashier", no: "21", title: "O'tkazma tasdiqlash", subtitle: "Solishtirish, tasdiq, eksport",
    category: "Operatsiya", status: "Tayyor", screen: "cash-detail", kind: "inbox", tags: ["compare", "approve", "export"], effort: "0.5 kun",
  },
  {
    id: "t22", role: "shared", no: "22", title: "Davomat", subtitle: "Selfie + GPS, kelish/ketish",
    category: "Onboarding", status: "Tayyor", screen: "attendance", kind: "attendance", tags: ["camera", "gps", "queue"], effort: "1 kun",
  },
  {
    id: "t23", role: "shared", no: "23", title: "Vazifalar", subtitle: "Topshiriq, muddat, holat",
    category: "Sozlama", status: "Yangi", screen: "tasks", kind: "tasks", tags: ["kanban", "deadline", "comments"], effort: "1 kun",
  },
];

export const palette = [
  { name: "Iris 600", hex: "#5548F0", role: "Agent · asosiy CTA", dark: true },
  { name: "Lime 400", hex: "#4ADE80", role: "Ekspeditor aksenti", dark: false },
  { name: "Sky 700", hex: "#0369A1", role: "Supervayzer aksenti", dark: true },
  { name: "Fuchsia 600", hex: "#C026D3", role: "Kassir aksenti", dark: true },
  { name: "Night", hex: "#0A0D14", role: "Ilova dark surface", dark: true },
  { name: "Ink", hex: "#0E1420", role: "Asosiy matn", dark: true },
  { name: "Slate", hex: "#677386", role: "Ikkilamchi matn", dark: true },
  { name: "Muted", hex: "#6D827B", role: "Yordamchi matn", dark: false },
  { name: "Canvas", hex: "#F3F5F9", role: "Ilova foni", dark: false },
  { name: "Line", hex: "#E0E9E5", role: "Chegara, divider", dark: false },
  { name: "Lime", hex: "#C8F56A", role: "Muvaffaqiyat aksenti", dark: false },
  { name: "Coral", hex: "#FF7A59", role: "Xatolik, e'tibor", dark: false },
];

export const typeScale = [
  { name: "Display", size: "56 / 60", weight: "Sora · 700", sample: "Yangi avlod" },
  { name: "Title 1", size: "32 / 38", weight: "Sora · 600", sample: "Bugungi reja" },
  { name: "Title 2", size: "24 / 30", weight: "Sora · 600", sample: "Vizitlar" },
  { name: "Body", size: "16 / 26", weight: "Inter · 400", sample: "Mijoz bilan uchrashuv" },
  { name: "Caption", size: "12 / 16", weight: "Inter · 600", sample: "12:40 · Toshkent" },
  { name: "Mono", size: "13 / 18", weight: "JetBrains · 500", sample: "04:57" },
];

export const motionPresets = [
  {
    id: "spring",
    name: "Spring pop",
    spec: "420ms · spring(0.34, 1.56)",
    use: "Sheet, FAB, tasdiqlash",
    demo: "pop",
  },
  {
    id: "rise",
    name: "Stagger rise",
    spec: "520ms · ease-out · 60ms",
    use: "Ro'yxat, kartalar",
    demo: "rise",
  },
  {
    id: "screen",
    name: "Screen slide",
    spec: "380ms · cubic-bezier(.16,1,.3,1)",
    use: "Ekran o'tishlari",
    demo: "slide",
  },
  {
    id: "grow",
    name: "Bar grow",
    spec: "900ms · ease-out",
    use: "KPI, grafiklar",
    demo: "grow",
  },
  {
    id: "pulse",
    name: "Live pulse",
    spec: "2000ms · infinite",
    use: "Faol vizit, sync",
    demo: "pulse",
  },
  {
    id: "shimmer",
    name: "Skeleton shimmer",
    spec: "1600ms · linear",
    use: "Yuklanish holati",
    demo: "shimmer",
  },
  {
    id: "press",
    name: "Press ripple",
    spec: "180ms · ease-out",
    use: "Tugma bosilishi",
    demo: "ripple",
  },
  {
    id: "count",
    name: "Count-up value",
    spec: "900ms · tabular-nums",
    use: "KPI raqamlari",
    demo: "count",
  },
  {
    id: "tilt",
    name: "Pointer tilt",
    spec: "240ms · responsive",
    use: "Karta fokusi",
    demo: "tilt",
  },
  {
    id: "launch",
    name: "Launch sequence",
    spec: "1800ms · 3 bosqich",
    use: "Ilovaga kirish",
    demo: "launch",
  },
];

export const motionRules = [
  { rule: "120ms dan qisqa", value: "Bosish / tap feedback" },
  { rule: "180–240ms", value: "Toggle, chip, checkbox" },
  { rule: "320–420ms", value: "Ekran va sheet o'tishlari" },
  { rule: "600ms+", value: "Faqat ma'lumot animatsiyasi" },
];

export const optimizations = [
  {
    category: "Render",
    title: "RepaintBoundary / memo",
    description: "Jonli taymer va progress faqat o'z konteynerini qayta chizadi. Ro'yxatlar memoizatsiya qilinadi.",
    gain: "−38% repaint",
    icon: "layers",
  },
  {
    category: "Ro'yxat",
    title: "Virtual scroll",
    description: "Mijozlar va katalog uchun lazy list. 1 200 qator o'rniga ekranda 12 ta element render qilinadi.",
    gain: "12× tezroq",
    icon: "list",
  },
  {
    category: "Tarmoq",
    title: "Oflayn-first + diff sync",
    description: "Lokal SQLite darhol javob beradi, sync fonda ishlaydi. Faqat o'zgargan yozuvlar yuboriladi.",
    gain: "0ms seziladi",
    icon: "wifi",
  },
  {
    category: "Rasm",
    title: "Keshlangan foto + WebP",
    description: "Foto hisobot 3 o'lchamda saqlanadi, skeleton bilan bosqichma-bosqich ochiladi.",
    gain: "−61% trafik",
    icon: "image",
  },
  {
    category: "Qidiruv",
    title: "Debounce + prefetch",
    description: "180ms debounce, mahalliy indeks va oldindan yuklangan mijoz kartalari.",
    gain: "−74% so'rov",
    icon: "search",
  },
  {
    category: "Effekt",
    title: "Adaptiv sifat",
    description: "Past quvvatli qurilmada blur, shimmer va zarrachalar avtomatik o'chadi. 60 FPS saqlanadi.",
    gain: "60 FPS",
    icon: "zap",
  },
];

export const metrics = [
  { label: "Birinchi chizish", before: 2.4, after: 0.9, unit: "s", icon: "spark" },
  { label: "Ekran o'tishi", before: 480, after: 220, unit: "ms", icon: "move" },
  { label: "Bundle hajmi", before: 1.9, after: 1.1, unit: "MB", icon: "package" },
  { label: "Sync vaqti", before: 24, after: 8, unit: "s", icon: "sync" },
];
