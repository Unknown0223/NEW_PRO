import { useState } from "react";
import {
  ArrowRight,
  Play,
  Users,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Copy,
  Gauge,
  Home,
  Lock,
  MapPin,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  Store,
  UserRound,
  Wand2,
  Zap,
  Truck,
  Wallet,
  CheckCheck,
  Inbox,
  ListTodo,
  Landmark,
  Navigation,
  Camera,
  Receipt,
  Gift,
  Calculator,
  CheckCircle2,
  Search,
  ShieldCheck,

  Calendar,
  Warehouse,
  Menu,
  RefreshCw,
  Table2,
  FileText,
  Package,
  RotateCcw as ReturnIcon,
  type LucideIcon,
} from "lucide-react";
import PhoneFrame from "./phone/PhoneFrame";
import { accents, roles, screens, type Accent, type MotionLevel, type RoleKey, type ScreenKey, type ThemeMode } from "../data/design";
import { LiveBadge, Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

const icons: Record<ScreenKey, LucideIcon> = {
  home: Home, visits: MapPin, clients: Store, order: ShoppingBag, kpi: BarChart3, notifications: Bell, login: Lock, profile: UserRound,
  bootstrap: RefreshCw, sync: Sparkles, menu: Menu, tabel: Calendar, "tabel-detail": Table2, "shelf-return": ReturnIcon, warehouse: Warehouse, drafts: FileText, attendance: Camera, tasks: ListTodo,
  "exp-home": Home, "exp-deliveries": Truck, "exp-delivery": Package, "exp-payments": Wallet, "exp-returns": ReturnIcon, "exp-debtors": Users,
  "sup-home": Home, "sup-agents": Users, "sup-gps": Navigation, "sup-visits": CheckCheck, "sup-kpi": BarChart3, "sup-clients": Store,
  "cash-home": Home, "cash-inbox": Inbox, "cash-detail": Landmark, orders: Receipt, "order-detail": FileText, bonuses: Gift, report: BarChart3, map: MapPin, "route-plan": Navigation,
  "client-detail": Store, "new-client": UserRound, search: Search, "kpi-calc": Calculator, "debtors-by-orders": Wallet,
  "start-visit": Navigation, permissions: ShieldCheck, "sync-success": CheckCircle2, "exp-invoices": FileText,
  "exp-visits": Truck, "exp-pay-info": Landmark, "sup-outlets": Store, "sup-report": BarChart3,
  "task-create": ListTodo, "task-detail": ListTodo,
};

const featureMap: Partial<Record<ScreenKey, string[]>> = {
  home: [
    "Oylik reja halqasi va kunlik maqsad",
    "Hafta / oy savdo grafigi — bosilganda summa",
    "Buyurtmalar oqimi: draft → yetkazildi",
    "Qarzdorlik aging va bir bosishda ochish",
    "Vazifalarni belgilash, top mahsulotlar, davomat",
  ],
  visits: ["Bottom sheet spring effekt", "4 qadamli progress", "Haptic tasdiqlash"],
  clients: ["180ms debounced qidiruv", "Virtual ro'yxat", "Qarz bo'yicha prioritet"],
  order: [
    "8 ta majburiy shart ketma-ket tekshiriladi (foto, GPS, vizit…)",
    "Bonus: 5+1 bloklarda, 10→2 bir martalik, summa bo'yicha",
    "Strategiya: 2 qoidadan 1 tasini tanlash majburiy",
    "Skidka: bonus bilan bog'langan yoki eksklyuziv",
    "Tasdiqlash zanjiri → 5 daqiqalik kutish oynasi",
  ],
  kpi: ["Bar chart o'sishi", "SVG ring progress", "Raqam count-up"],
  notifications: ["O'qilgan holat xotirasi", "Guruhlangan vaqt", "Push sozlamasi"],
  login: [
    "Logotip chiziladi: zigzag → strelka otiladi",
    "Brend logotipi tepaga ko'tariladi, maydonlar ketma-ket ochiladi",
    "Pastdan brend to'lqini ko'tariladi (demo hisoblar unda)",
    "PIN / Face ID → to'lqin ekranni qoplaydi → rol sahnasi",
  ],
  profile: ["Tema almashtirish", "Jonli toggle", "Sinxron holati"],
  sync: ["Alohida oddiy sinxron ekrani", "Rol ma'lumotlari ro'yxati", "Qo'lda sinxronlash tugmasi"],
  bootstrap: [
    "Brend rangi pastga oqib, rol sahnasini ochadi",
    "Har rolga o'z transporti: skuter, mashina, patrul, furgon",
    "Ism bilan salomlashuv + SalesArena · rol belgisi",
    "Ish joyi 6 bosqichda ✓ bo'ladi, transport jo'nab ketadi",
  ],
  menu: ["18 ta to'liq menyu bandi", "Rolga mos ko'rinish", "Qidiruv va «Скоро» teglar"],
  tabel: ["1 / 0.5 / 0 / В / О / Б / К", "Oylik kalendar", "Kunlik detail sheet"],
  "tabel-detail": ["Status yig'indisi", "Filtr chiplari", "Soatlar auditi"],
  "shelf-return": ["3 xil vazvrat (s polki)", "Almashtirish (Obmen)", "Polka fotosi"],
  warehouse: ["3 ombor qoldig'i", "Korobka/dona hisobi", "Kam qoldiq ogohlantirishi"],
  drafts: ["Oflayn qoralamalar", "Bir bosishda davom etish", "Sinxron nazorati"],
  attendance: ["Selfie + GPS tekshiruv", "Oflayn navbat", "Haftalik tabel"],
  tasks: ["Bir bosishda bajarish", "Muddat ogohlantirishi", "Prioritet teglari"],
  "client-detail": ["Balans va kredit qoldig'i", "Foto / buyurtma / ledger tablari", "Sticky CTA: vizit yoki zakaz"],
  "new-client": ["INN 9 raqam validatsiyasi", "GPS bilan bog'lash majburiy", "Saqlangach zakaz taklifi"],
  search: ["Mijoz + mahsulot + buyurtma", "Jonli filtr va bo'sh holat", "So'nggi so'rovlar tarixi"],
  "kpi-calc": ["Ish kunlari va kunlik baza", "Premiya zinapoyasi 3/5/8%", "Kunlar diagnostikasi tabi"],
  "debtors-by-orders": ["Aging: 0–7 / 8–30 / 30+", "Eslatma yuborish", "To'lov qabul qilish"],
  "start-visit": ["GPS aniqligi gate", "Selfie tasdiq", "Vizit rejasi 4 qadam"],
  permissions: ["4 ruxsat, 2 tasi majburiy", "Toggle + holat rangi", "Hammasiga ruxsat berish"],
  "sync-success": ["4 hisoblagich + konfetti", "Keyingi avto sinxron", "Batafsil / bosh sahifa"],
  "exp-invoices": ["Jo'natma / qaytarma tab", "Ombor filtri + qidiruv", "Detal sheet"],
  "exp-visits": ["Bajarilgan / tugallanmagan", "Sabab ko'rsatiladi", "Davom ettirish"],
  "exp-pay-info": ["Rekvizitlar + QR", "Har maydonni nusxalash", "Mijozga SMS"],
  "sup-outlets": ["Qamrov foizi", "Hudud filtri", "Biriktirilmagan nuqtalar"],
  "sup-report": ["Reja/fakt kartalari", "Agentlar kesimi grafik", "Diqqat bloki + eksport"],
  "task-create": ["Ijrochi majburiy", "Muddat / prioritet / tur", "Validatsiya bilan saqlash"],
  "task-detail": ["Bajarildi toggle", "Mijoz va xarita havolasi", "Jonli izohlar"],
  orders: ["Holat bo'yicha filtr", "Summa va pozitsiyalar", "Detalga o'tish"],
  "order-detail": ["Holat timeline", "5 daqiqalik tahrirlash oynasi", "Bekor qilish so'rovi"],
  bonuses: ["Bonus zinapoyasi 3/5/8%", "Aksiya qoidalari tarixi", "To'langan / kutilmoqda"],
  report: ["Hafta / oy almashtirish", "Kunlik savdo grafigi", "Excel eksport"],
  map: ["Marshrut pinlari", "Keyingi to'xtash kartasi", "Vizitni boshlash"],
  "route-plan": ["Vaqt chizig'i (6 nuqta)", "Marshrut KPI 42%", "Kechikish ogohlantirishi"],
  "exp-home": ["Naqd pul hisoblagichi", "Marshrut progressi", "Keyingi to'xtashlar"],
  "exp-deliveries": ["Holat filtrlari", "Nakladnoy guruhlash", "Xarita rejimi"],
  "exp-delivery": ["Qisman yetkazish stepper", "Foto + imzo tasdiq", "Navigator havolasi"],
  "exp-payments": ["Katta numpad", "Naqd/karta/o'tkazma", "Chek chop etish"],
  "exp-returns": ["Sabab tanlash", "Foto dalil", "Ombor tasdiqlash"],
  "exp-debtors": ["Aging 0-7 / 8-30 / 30+", "Ochiluvchi ledger", "To'lovga o'tish"],
  "sup-home": ["Real vaqt jamoa KPI", "Ogohlantirish banneri", "Agentlar progressi"],
  "sup-agents": ["Reyting / alifbo saralash", "Onlayn indikator", "Oxirgi signal"],
  "sup-gps": ["Interaktiv xarita pinlari", "Geofence doirasi", "Marshrut izi"],
  "sup-visits": ["Foto hisobot ko'rish", "Tasdiqlash / rad etish", "Agentga xabar"],
  "sup-kpi": ["Agentlar taqqoslash", "Haftalik trend", "Excel eksport"],
  "sup-clients": ["Yangi mijoz tasdiqlash", "Agentga biriktirish", "Tahrirlash"],
  "cash-home": ["Kunlik kassa breakdown", "Inbox badge", "Oxirgi operatsiyalar"],
  "cash-inbox": ["Buyurtmaga bog'lash", "Holat filtrlari", "Excel eksport"],
  "cash-detail": ["Summa solishtirish", "Tasdiqlash / qaytarish", "PDF yuklash"],
};

export default function Studio({
  activeScreen,
  onChange,
  role,
  onRole,
  embedded = false,
}: {
  activeScreen: ScreenKey;
  onChange: (screen: ScreenKey) => void;
  role: RoleKey;
  onRole: (role: RoleKey) => void;
  embedded?: boolean;
}) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [accentOverride, setAccentOverride] = useState<Accent | null>(null);
  const roleDef = roles.find((r) => r.key === role) ?? roles[0];
  const roleAccent = accents.find((a) => a.id === roleDef.accentId) ?? accents[0];
  const accent = accentOverride ?? roleAccent;
  const setAccent = (a: Accent) => setAccentOverride(a);
  const roleScreens = screens.filter((s) => s.role === role || s.role === "shared");
  const [motion, setMotion] = useState<MotionLevel>("full");
  const [effects, setEffects] = useState(true);
  const [launchSeq, setLaunchSeq] = useState(0);
  const toast = useToast();
  const switchRole = (r: RoleKey) => {
    setAccentOverride(null);
    onRole(r);
    onChange("login");
    setLaunchSeq((n) => n + 1);
  };
  const replayLaunch = () => {
    onChange("login");
    setLaunchSeq((n) => n + 1);
    toast(`${roleDef.name} kirish animatsiyasi qayta boshlandi`);
  };

  const current = screens.find((s) => s.key === activeScreen) ?? screens[0];
  const index = roleScreens.findIndex((s) => s.key === activeScreen);
  const accentMeta = `${accent.hex} · ${accent.name}`;

  const reset = () => {
    setTheme("light");
    setAccentOverride(null);
    setMotion("full");
    setEffects(true);
    switchRole("agent");
    toast("Studio boshlang'ich holatga qaytdi");
  };

  return (
    <section id="studio" className={embedded ? "relative" : "relative py-20 sm:py-28"}>
      <div className={embedded ? "" : "container-x"}>
        <Reveal>
          <SectionHead
            eyebrow="Interaktiv studio"
            title={<>Prototipni sinab ko'ring — <span className="text-brand-600">hozir</span></>}
            description="Ekranlar, aksent, tema va harakat tezligini almashtiring. Har bir o'zgarish darhol prototipda aks etadi — xuddi native ilovada bo'lgani kabi."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <LiveBadge label="Live demo" />
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[11px] font-semibold text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
            }
          />
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r) => {
              const a = accents.find((x) => x.id === r.accentId) ?? accents[0];
              const active = r.key === role;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => switchRole(r.key)}
                  className={cn(
                    "group relative overflow-hidden rounded-[18px] border p-3.5 text-left transition-all duration-300",
                    active ? "border-transparent shadow-[0_20px_40px_-20px_rgba(6,33,30,.5)]" : "border-line bg-white text-ink hover:-translate-y-0.5 hover:border-brand-200",
                  )}
                  style={active ? { background: a.gradient, color: a.onAccent } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-[10px]" style={{ background: active ? (a.onAccent === "#FFFFFF" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)") : a.soft, color: active ? a.onAccent : a.ink }}>
                      {r.key === "agent" ? <UserRound size={15} /> : r.key === "expeditor" ? <Truck size={15} /> : r.key === "supervisor" ? <Users size={15} /> : <Landmark size={15} />}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 font-mono text-[8px] font-semibold", active ? "bg-black/10" : "bg-[#F3F8F6] text-muted")} style={active ? { color: a.onAccent } : undefined}>{r.screensCount} ekran</span>
                  </div>
                  <p className="mt-3 text-[13px] font-bold tracking-[-0.02em]">{r.name}</p>
                  <p className={cn("mt-0.5 line-clamp-2 text-[9.5px] leading-snug", active ? "opacity-80" : "text-ink-2/60")}>{r.description}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {r.modules.slice(0, 4).map((m) => (
                      <span key={m} className={cn("rounded px-1.5 py-0.5 text-[7.5px] font-semibold", active ? "bg-black/10" : "bg-[#F3F8F6] text-ink-2")} style={active ? { color: a.onAccent } : undefined}>{m}</span>
                    ))}
                  </div>
                  {active && <span className="absolute -right-6 -top-6 size-20 rounded-full bg-white/10" />}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-4 overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_2px_3px_rgba(6,33,30,.03),0_40px_80px_-50px_rgba(6,33,30,.35)]">
            {/* window bar */}
            <div className="flex items-center justify-between gap-3 border-b border-line/80 bg-[#FAFCFB] px-4 py-2.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#FF6058]" />
                  <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="size-2.5 rounded-full bg-[#28C840]" />
                </span>
                <span className="ml-1 hidden font-mono text-[10px] text-muted sm:inline">salec-{role} / prototype</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 font-mono text-[9px] text-muted ring-1 ring-line">
                  <Zap size={9} className="text-brand-500" /> 60 FPS
                </span>
                <span className="hidden rounded-md bg-white px-2 py-1 font-mono text-[9px] text-muted ring-1 ring-line sm:inline-flex">
                  390 × 844
                </span>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[252px_minmax(0,1fr)_296px]">
              {/* controls */}
              <aside className="order-2 border-t border-line/80 p-4 lg:order-1 lg:border-r lg:border-t-0">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">Ekranlar</p>
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold text-brand-700">{roleScreens.length}</span>
                </div>
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
                  {roleScreens.map((s, i) => {
                    const Icon = icons[s.key];
                    const active = s.key === activeScreen;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => onChange(s.key)}
                        className={cn(
                          "group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-2.5 py-2 text-left transition-all duration-200 lg:w-full",
                          active ? "bg-ink text-white" : "text-ink-2 hover:bg-[#F3F8F6]",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-md transition-colors",
                            active ? "bg-lime/15 text-lime" : "bg-[#F0F6F3] text-brand-700 group-hover:bg-white",
                          )}
                        >
                          <Icon size={12.5} />
                        </span>
                        <span className="truncate text-[11px] font-semibold">{s.label.replace(/^.*· /, "")}</span>
                        <span className={cn("ml-auto hidden font-mono text-[8px] lg:inline", active ? "text-white/35" : "text-muted/60")}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {active && <ChevronRight size={11} className="hidden text-lime lg:block" />}
                      </button>
                    );
                  })}
                </div>

                <div className="my-4 h-px bg-line" />

                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Tema</p>
                    <div className="flex gap-1 rounded-[9px] bg-[#F2F7F5] p-1">
                      {([
                        { key: "light" as ThemeMode, label: "Kun", icon: Sun },
                        { key: "dark" as ThemeMode, label: "Tun", icon: Moon },
                      ]).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setTheme(m.key)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1 rounded-[6px] py-1.5 text-[10px] font-semibold transition",
                            theme === m.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
                          )}
                        >
                          <m.icon size={11} /> {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Aksent rang</p>
                    <div className="flex items-center gap-2">
                      {accents.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          title={a.name}
                          aria-label={a.name}
                          onClick={() => setAccent(a)}
                          className={cn(
                            "grid size-7 place-items-center rounded-full transition-all duration-200",
                            accent.id === a.id ? "ring-2 ring-offset-2 ring-ink/30" : "hover:scale-110",
                          )}
                          style={{ background: a.gradient }}
                        >
                          {accent.id === a.id && <Check size={12} style={{ color: a.onAccent }} strokeWidth={3} />}
                        </button>
                      ))}
                      <span className="ml-auto font-mono text-[8.5px] text-muted">{accent.hex}</span>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Harakat</p>
                    <div className="grid grid-cols-3 gap-1 rounded-[9px] bg-[#F2F7F5] p-1">
                      {([
                        { key: "full" as MotionLevel, label: "To'liq" },
                        { key: "soft" as MotionLevel, label: "Yumshoq" },
                        { key: "off" as MotionLevel, label: "O'chiq" },
                      ]).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setMotion(m.key)}
                          className={cn(
                            "rounded-[6px] py-1.5 text-[9.5px] font-semibold transition",
                            motion === m.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-[10px] border border-line bg-[#FBFDFC] px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <Wand2 size={12} className="text-brand-600" />
                      <div>
                        <p className="text-[10px] font-semibold text-ink">Effektlar</p>
                        <p className="text-[8px] text-muted">Glow, soya, blur</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={effects}
                      aria-label="Effektlarni yoqish yoki o'chirish"
                      onClick={() => setEffects((v) => !v)}
                      className={cn("relative h-[18px] w-8 rounded-full transition-colors", effects ? "bg-brand-600" : "bg-line-dark")}
                    >
                      <span className={cn("absolute top-[2px] size-[14px] rounded-full bg-white shadow-sm transition-all duration-300", effects ? "left-[16px]" : "left-[2px]")} />
                    </button>
                  </div>

                  <div className="rounded-[10px] border border-line bg-[#FBFDFC] p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Gauge size={12} className="text-brand-600" />
                      <span className="text-[9.5px] font-semibold text-ink">Prototip salomatligi</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { l: "FPS", v: maybeFps(motion, effects), w: maybeFps(motion, effects) },
                        { l: "Xotira", v: 24, w: 38 },
                        { l: "Tap kechikish", v: motion === "off" ? 60 : 96, w: motion === "off" ? 60 : 96 },
                      ].map((m) => (
                        <div key={m.l} className="flex items-center gap-2">
                          <span className="w-14 text-[8px] text-muted">{m.l}</span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.w}%`, background: m.l === "Xotira" ? "#C8F56A" : "#078179" }} />
                          </div>
                          <span className="w-7 text-right font-mono text-[7.5px] font-semibold text-ink-2">{m.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>

              {/* phone stage */}
              <div className="relative order-1 overflow-hidden border-t border-line/80 lg:order-2 lg:border-t-0">
                <div className="dot-grid surface-tint-2 relative flex min-h-[620px] items-start justify-center px-2 pb-8 pt-7 min-[380px]:min-h-[660px] min-[430px]:min-h-[720px] sm:min-h-[840px] sm:px-4 sm:pb-10 sm:pt-9">
                  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="amb amb-1 absolute left-1/2 top-24 size-[420px] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl" />
                    <div className="absolute bottom-8 right-4 size-40 rounded-full bg-lime/25 blur-3xl" />
                  </div>
                  <div className="relative">
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <span className="rounded-full border border-white bg-white/80 px-2.5 py-1 font-mono text-[9px] text-ink-2 shadow-sm backdrop-blur">
                        {current.label} · {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="rounded-full border border-white bg-white/80 px-2 py-1 font-mono text-[9px] text-muted shadow-sm backdrop-blur">
                        {roleDef.short.toLowerCase()} / {theme} / {motion}
                      </span>
                      <button
                        type="button"
                        onClick={replayLaunch}
                        className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[9px] font-semibold text-white shadow-sm transition hover:bg-brand-800"
                      >
                        <Play size={9} fill="currentColor" /> Kirish animatsiyasi
                      </button>
                      <button
                        type="button"
                        onClick={() => { onChange("bootstrap"); toast("Rolga mos kirish animatsiyasi"); }}
                        className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[9px] font-semibold text-ink-2 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
                      >
                        <Sparkles size={9} /> Rol motion
                      </button>
                    </div>
                    {activeScreen === "login" && (
                      <div className="mb-3 rounded-[14px] border border-white/70 bg-white/85 px-3 py-2 shadow-sm backdrop-blur">
                        <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted">Avtorizatsiya oqimi</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {["Splash", "Hisob", "PIN 1234", "Biometrika", "Sessiya"].map((s, i) => (
                            <span key={s} className="flex items-center gap-1">
                              {i > 0 && <ChevronRight size={8} className="text-line-dark" />}
                              <span className="rounded-md bg-[#F1F7F4] px-1.5 py-0.5 text-[8.5px] font-semibold text-ink-2">{s}</span>
                            </span>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[8.5px] leading-snug text-ink-2/60">
                          Telefon ichida rol tanlang — splash, rang va hisob shu rolga moslashadi.
                        </p>
                      </div>
                    )}
                    <div className="origin-top scale-[0.7] min-[380px]:scale-[0.78] min-[430px]:scale-[0.86] sm:scale-100">
                    <PhoneFrame
                      key={`${role}-${launchSeq}`}
                      role={role}
                      onRole={(r) => { switchRole(r); onChange("login"); }}
                      screen={activeScreen}
                      onScreen={onChange}
                      theme={theme}
                      onTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                      accent={accent}
                      motion={motion}
                      effects={effects}
                    />
                    </div>
                    <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[9px] font-medium text-ink-2/50">
                      <Sparkles size={10} /> Navigatsiya, qidiruv va savat ishlaydi
                    </p>
                  </div>
                </div>
              </div>

              {/* details */}
              <aside className="order-3 border-t border-line/80 p-4 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">Tanlangan shablon</span>
                  <span className="rounded bg-lime-soft px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-brand-900">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-[20px] font-semibold leading-tight tracking-[-0.03em] text-ink">{current.label}</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2/70">{current.description}</p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {current.tags.map((tag) => (
                    <span key={tag} className="rounded-md border border-line bg-[#F7FAF9] px-1.5 py-1 font-mono text-[8px] font-medium text-ink-2">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="my-4 h-px bg-line" />

                <p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Nima qo'shildi</p>
                <ul className="space-y-2">
                  {(featureMap[activeScreen] ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[10.5px] leading-snug text-ink-2">
                      <span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                        <Check size={8.5} strokeWidth={3.5} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 rounded-[12px] border border-line bg-[#FBFDFC] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-muted">token.config</span>
                    <span className="flex gap-1">
                      <i className="size-1.5 rounded-full bg-[#FF6058]" />
                      <i className="size-1.5 rounded-full bg-[#FEBC2E]" />
                      <i className="size-1.5 rounded-full bg-[#28C840]" />
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto font-mono text-[8.5px] leading-[1.7] text-ink-2">
{`accent   ${accent.hex}
surface  ${theme === "light" ? "#FFFFFF" : "#0D2521"}
radius   12 / 16 / 20
motion   ${motion === "full" ? "420ms spring" : motion === "soft" ? "240ms ease" : "0ms"}
effects  ${effects ? "on" : "off"}`}
                  </pre>
                </div>

                <div className="mt-3 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(`accent: ${accentMeta}\ntheme: ${theme}\nmotion: ${motion}\neffects: ${effects}`).catch(() => {});
                      toast("Dizayn konfiguratsiyasi nusxalandi");
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-ink py-2.5 text-[10.5px] font-semibold text-white transition hover:bg-brand-800"
                  >
                    <Copy size={12} /> Konfiguratsiyani olish
                  </button>
                  <button
                    type="button"
                    onClick={() => toast(`${current.label} kodi tayyorlab qo'yildi`)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white py-2.5 text-[10.5px] font-semibold text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    <SlidersHorizontal size={12} /> Ekran kodini ko'rish
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-brand-50/70 px-2.5 py-2">
                  <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-white"><Zap size={11} /></span>
                  <p className="text-[9px] leading-snug text-brand-900/70">
                    Barcha o'tishlar <b className="text-brand-900">prefers-reduced-motion</b> ni hurmat qiladi.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </Reveal>

        {/* quick jump */}
        <Reveal delay={160}>
          <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-[18px] border border-line bg-white/70 p-4 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-[12px] font-medium text-ink-2">
              <span className="grid size-7 place-items-center rounded-full bg-lime-soft text-brand-800"><Sparkles size={13} /></span>
              Bu shablonlar <b className="font-semibold text-ink">Flutter, React Native va React</b> uchun tayyorlangan.
            </p>
            <a href="#shablonlar" className="group inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700">
              To'liq katalog <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function maybeFps(motion: MotionLevel, effects: boolean) {
  if (motion === "off" && !effects) return 60;
  if (effects) return 58;
  return 60;
}
