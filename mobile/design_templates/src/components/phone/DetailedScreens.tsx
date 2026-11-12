import { useState } from "react";
import {
  ArrowLeftRight,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Inbox,
  Landmark,
  ListTodo,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Table2,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  X,
} from "lucide-react";
import type { ScreenKey } from "../../data/design";
import { cn } from "../../utils/cn";
import { anim, Chip, fmt, IconBtn, ScreenHead, type Props } from "./PhoneScreens";

/* ================================================================== */
/*  3. FULL MENU (agent_menu_config.dart — 18 items, search, soon)    */
/* ================================================================== */

type MenuItem = {
  label: string;
  sub: string;
  route: string;
  go?: ScreenKey;
  soon?: boolean;
  badge?: string;
  icon: typeof Home;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Bosh sahifa (Главная)", sub: "Kunlik reja va faol vizit", route: "/home", go: "home", icon: Home },
  { label: "Yangi nuqta qo'shish", sub: "GPS + INN bilan ro'yxatga olish", route: "/clients/new", go: "clients", icon: UserPlus },
  { label: "Almashtirish so'rovi (Обмен)", sub: "Tovarni boshqasiga almashtirish", route: "/orders/exchange", go: "shelf-return", icon: ArrowLeftRight },
  { label: "Polkadan qaytarish (S polki)", sub: "Возврат с полки · muddati/brak", route: "/orders/shelf-return", go: "shelf-return", badge: "S polki", icon: RotateCcw },
  { label: "KPI ko'rsatkichlar", sub: "Bugungi va oylik bonus zinapoyasi", route: "/kpi", go: "kpi", icon: Sparkles },
  { label: "Kunlik marshrut rejasi", sub: "Дневной план · 12 nuqta", route: "/kpi/route", go: "visits", icon: MapPin },
  { label: "Hisobotlar (Отчёты)", sub: "Savdo, qaytarish, balans", route: "/report", go: "kpi", icon: FileText },
  { label: "Savdo nuqtalari", sub: "342 ta mijoz · qarz nazorati", route: "/clients", go: "clients", icon: Store },
  { label: "Maosh (Зарплата)", sub: "Hisoblangan oylik va avans", route: "/salary", soon: true, icon: Wallet },
  { label: "Qarzdorlar (Должники)", sub: "Mijozlar qarzi va to'lovlar", route: "/debtors", go: "exp-debtors", icon: Users },
  { label: "Buyurtma bo'yicha qarzlar", sub: "Nakladnoy kesimida", route: "/debtors-by-orders", go: "exp-debtors", icon: Landmark },
  { label: "Ombor qoldiqlari", sub: "Остатки на складе · 3 ombor", route: "/warehouse-stock", go: "warehouse", badge: "1 208", icon: Warehouse },
  { label: "Qoralama (Черновик)", sub: "Tugallanmagan buyurtmalar", route: "/draft", go: "drafts", badge: "2", icon: Inbox },
  { label: "Vazifalar (Задачи)", sub: "Supervayzer topshiriqlari", route: "/tasks", go: "tasks", badge: "3", icon: ListTodo },
  { label: "Mening lokatsiyam", sub: "GPS xarita va geofence", route: "/map", go: "sup-gps", icon: MapPin },
  { label: "Tabel (Табель)", sub: "1 / 0.5 / 0 / В / О / Б / К", route: "/tabel", go: "tabel", badge: "Yangi", icon: Calendar },
  { label: "Davomat (Face ID / Selfie)", sub: "Kelish va ketishni belgilash", route: "/attendance", go: "attendance", icon: Camera },
  { label: "Sozlamalar (Настройки)", sub: "Tema, sinxron, til, PIN", route: "/settings", go: "profile", icon: Settings },
];

export function MenuScreen({ t, accent, ctx }: Props) {
  const [q, setQ] = useState("");
  const list = MENU_ITEMS.filter((m) => `${m.label} ${m.sub}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <div className="rounded-[16px] p-3 on-acc" style={{ background: accent.gradient }}>
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-full border border-white/30 bg-white/15 font-display text-[12px] font-bold">AQ</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold">Aziz Qodirov</p>
              <p className="text-[8.5px] on-acc-75">Agent · Toshkent · Sync 12:48</p>
            </div>
            <button type="button" onClick={() => ctx.go("profile")} className="rounded-lg bg-white/15 px-2 py-1 text-[8px] font-semibold">
              Profil
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Search size={12} style={{ color: t.sub }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Menyudan izlash…"
            className="w-full bg-transparent text-[10px] outline-none"
            style={{ color: t.ink }}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} style={{ color: t.sub }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-4 pb-3 pt-2">
        {list.map((m, i) => {
          const Icon = m.icon;
          return (
            <button
              key={m.label}
              type="button"
              onClick={() => {
                if (m.soon) ctx.toast("«Maosh» moduli keyingi yangilanishda chiqadi");
                else if (m.go) ctx.go(m.go);
              }}
              className={cn("flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition active:scale-[0.99]", anim(ctx, i % 8).className)}
              style={{ background: t.card, border: `1px solid ${t.line}`, opacity: m.soon ? 0.65 : 1 }}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: m.soon ? t.card2 : t.accSoft, color: m.soon ? t.sub : t.accInk }}>
                <Icon size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-semibold" style={{ color: t.ink }}>
                  {m.label}
                </span>
                <span className="block truncate text-[8px]" style={{ color: t.sub }}>
                  {m.sub}
                </span>
              </span>
              {m.soon ? (
                <span className="rounded-full bg-[#FEF08A] px-1.5 py-0.5 text-[7px] font-bold text-[#854D0E]">Скоро</span>
              ) : m.badge ? (
                <span className="rounded-full px-1.5 py-0.5 font-mono text-[7.5px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>
                  {m.badge}
                </span>
              ) : (
                <ChevronRight size={12} style={{ color: t.sub }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  4. TABEL (0 / 0.5 / 1 / В / О / Б / К + Day Sheet + Detail)       */
/* ================================================================== */

type TabelStatus = "worked" | "half_day" | "absent" | "holiday" | "vacation" | "sick" | "trip";

const STATUS_META: Record<TabelStatus, { short: string; label: string; color: string; bg: string }> = {
  worked: { short: "1", label: "Ishladi", color: "#0E8C7A", bg: "#E6F5F2" },
  half_day: { short: "0.5", label: "Yarim kun", color: "#0F766E", bg: "#CCFBF1" },
  absent: { short: "0", label: "Yo'q", color: "#64748B", bg: "#E2E8F0" },
  holiday: { short: "В", label: "Dam olish", color: "#3B82F6", bg: "#DBEAFE" },
  vacation: { short: "О", label: "Ta'til", color: "#A16207", bg: "#FEF08A" },
  sick: { short: "Б", label: "Kasallik", color: "#EA580C", bg: "#FFEDD5" },
  trip: { short: "К", label: "Xizmat safari", color: "#9333EA", bg: "#F3E8FF" },
};

const JULY_DAYS: { day: number; status: TabelStatus | null; checkIn?: string; checkOut?: string; hours?: string; note?: string }[] = [
  { day: 1, status: "worked", checkIn: "08:52", checkOut: "18:05", hours: "9s 13d" },
  { day: 2, status: "worked", checkIn: "08:58", checkOut: "18:10", hours: "9s 12d" },
  { day: 3, status: "worked", checkIn: "09:01", checkOut: "18:00", hours: "8s 59d" },
  { day: 4, status: "trip", checkIn: "08:30", checkOut: "19:20", hours: "10s 50d", note: "Sirdaryo filiali safar" },
  { day: 5, status: "worked", checkIn: "08:55", checkOut: "17:45", hours: "8s 50d" },
  { day: 6, status: "holiday", note: "Yakshanba" },
  { day: 7, status: "worked", checkIn: "08:49", checkOut: "18:02", hours: "9s 13d" },
  { day: 8, status: "half_day", checkIn: "09:00", checkOut: "13:30", hours: "4s 30d", note: "Tushdan keyin ruxsat" },
  { day: 9, status: "worked", checkIn: "08:54", checkOut: "18:15", hours: "9s 21d" },
  { day: 10, status: "sick", note: "Shifokor ma'lumotnomasi" },
  { day: 11, status: "worked", checkIn: "09:02", checkOut: "18:00", hours: "8s 58d" },
  { day: 12, status: "worked", checkIn: "08:51", checkOut: "18:08", hours: "9s 17d" },
  { day: 13, status: "holiday", note: "Yakshanba" },
  { day: 14, status: "worked", checkIn: "08:48", checkOut: "18:11", hours: "9s 23d" },
  { day: 15, status: "worked", checkIn: "08:56", checkOut: "18:00", hours: "9s 04d" },
  { day: 16, status: "vacation", note: "1 kunlik ta'til" },
  { day: 17, status: "absent", note: "Belgilanmagan" },
  { day: 18, status: "worked", checkIn: "08:50", checkOut: "—", hours: "Faol" },
  ...Array.from({ length: 13 }, (_, idx) => ({ day: 19 + idx, status: null })),
];

export function TabelScreen({ t, accent, ctx }: Props) {
  const [monthIdx, setMonthIdx] = useState(1);
  const months = ["Iyun 2026", "Iyul 2026", "Avgust 2026"];
  const [picked, setPicked] = useState<(typeof JULY_DAYS)[number] | null>(null);

  const workedCount = JULY_DAYS.filter((d) => d.status === "worked").length;
  const halfCount = JULY_DAYS.filter((d) => d.status === "half_day").length;

  return (
    <div className="relative flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="Tabel"
          sub="Aziz Qodirov · AG-047"
          onBack={() => ctx.go("menu")}
          right={
            <IconBtn t={t} onClick={() => ctx.go("tabel-detail")} active>
              <Table2 size={14} />
            </IconBtn>
          }
        />

        {/* Month switcher */}
        <div className="flex items-center justify-between rounded-[12px] p-1.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <button
            type="button"
            onClick={() => setMonthIdx((m) => Math.max(0, m - 1))}
            className="grid size-7 place-items-center rounded-lg"
            style={{ background: t.card2, color: t.ink }}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[11px] font-bold" style={{ color: t.ink }}>{months[monthIdx]}</span>
          <button
            type="button"
            onClick={() => setMonthIdx((m) => Math.min(2, m + 1))}
            className="grid size-7 place-items-center rounded-lg"
            style={{ background: t.card2, color: t.ink }}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { l: "Ish kun", v: `${workedCount + halfCount * 0.5}`, c: "#0E8C7A" },
            { l: "Jami soat", v: "118.5", c: accent.hex },
            { l: "Qoidabuzarlik", v: "1", c: "#EA580C" },
          ].map((s) => (
            <div key={s.l} className="rounded-[12px] p-2 text-center" style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="font-mono text-[13px] font-bold" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[8px]" style={{ color: t.sub }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="rounded-[16px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="mb-1.5 grid grid-cols-7 text-center text-[7.5px] font-bold uppercase" style={{ color: t.sub }}>
            {["Ch", "Pa", "Ju", "Sh", "Ya", "Du", "Se"].map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {JULY_DAYS.map((d) => {
              const meta = d.status ? STATUS_META[d.status] : null;
              return (
                <button
                  key={d.day}
                  type="button"
                  disabled={!meta}
                  onClick={() => meta && setPicked(d)}
                  className="flex flex-col items-center justify-center rounded-[8px] py-1.5 transition active:scale-90 disabled:opacity-35"
                  style={{
                    background: meta ? (t.isDark ? `${meta.color}30` : meta.bg) : t.card2,
                    border: d.day === 18 ? `1.5px solid ${accent.hex}` : "1px solid transparent",
                  }}
                >
                  <span className="text-[7px] font-medium" style={{ color: t.sub }}>{d.day}</span>
                  <span className="font-mono text-[9.5px] font-extrabold leading-tight" style={{ color: meta ? meta.color : t.sub }}>
                    {meta ? meta.short : "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-[14px] p-2.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[9px] font-bold" style={{ color: t.ink }}>Status kodlari</p>
            <button type="button" onClick={() => ctx.go("tabel-detail")} className="text-[8.5px] font-semibold" style={{ color: t.accText }}>
              Detal jadval →
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(STATUS_META) as TabelStatus[]).map((k) => {
              const m = STATUS_META[k];
              return (
                <span key={k} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[7.5px] font-semibold" style={{ background: t.isDark ? `${m.color}28` : m.bg, color: m.color }}>
                  <b>{m.short}</b> {m.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day detail sheet */}
      {picked && picked.status && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={() => setPicked(null)}>
          <div className="pop-in w-full rounded-t-[24px] p-4" style={{ background: t.card }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: t.line }} />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-bold" style={{ color: t.ink }}>{picked.day}-iyul 2026</p>
                <p className="text-[9px]" style={{ color: t.sub }}>{STATUS_META[picked.status].label}</p>
              </div>
              <span className="rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold" style={{ background: STATUS_META[picked.status].bg, color: STATUS_META[picked.status].color }}>
                {STATUS_META[picked.status].short}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                { l: "Keldi", v: picked.checkIn ?? "—" },
                { l: "Ketdi", v: picked.checkOut ?? "—" },
                { l: "Ish vaqti", v: picked.hours ?? "—" },
              ].map((x) => (
                <div key={x.l} className="rounded-xl p-2 text-center" style={{ background: t.card2 }}>
                  <p className="text-[7.5px]" style={{ color: t.sub }}>{x.l}</p>
                  <p className="mt-0.5 font-mono text-[10px] font-bold" style={{ color: t.ink }}>{x.v}</p>
                </div>
              ))}
            </div>
            {picked.note && (
              <p className="mt-2.5 rounded-xl p-2.5 text-[9px]" style={{ background: t.card2, color: t.ink }}>
                Izoh: {picked.note}
              </p>
            )}
            <button type="button" onClick={() => setPicked(null)} className="mt-3 w-full rounded-xl py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.hex }}>
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TabelDetailScreen({ t, accent, ctx }: Props) {
  const [filter, setFilter] = useState<TabelStatus | "all">("all");
  const rows = JULY_DAYS.filter((d) => d.status !== null && (filter === "all" ? true : d.status === filter)).reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Tabel · Detallar" sub="Iyul 2026 · 18 kun yozuvi" onBack={() => ctx.go("tabel")} />
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          <Chip t={t} accent={accent} active={filter === "all"} onClick={() => setFilter("all")}>Barchasi</Chip>
          {(Object.keys(STATUS_META) as TabelStatus[]).map((k) => (
            <Chip key={k} t={t} accent={accent} active={filter === k} onClick={() => setFilter(k)}>
              {STATUS_META[k].short} · {STATUS_META[k].label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2">
        {rows.map((r, i) => {
          const m = STATUS_META[r.status!];
          return (
            <div key={r.day} className={cn("flex items-center gap-2.5 rounded-[13px] p-2.5", anim(ctx, i % 8).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] font-mono text-[11px] font-extrabold" style={{ background: t.isDark ? `${m.color}28` : m.bg, color: m.color }}>
                {m.short}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold" style={{ color: t.ink }}>{r.day}-iyul · {m.label}</p>
                <p className="truncate text-[8px]" style={{ color: t.sub }}>
                  {r.checkIn ? `${r.checkIn} → ${r.checkOut} · ${r.hours}` : r.note ?? "Izoh yo'q"}
                </p>
              </div>
              <span className="font-mono text-[8.5px] font-semibold" style={{ color: t.accText }}>{r.hours ?? "0s"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  6. SHELF RETURN (S polki) + EXCHANGE (Obmen)                      */
/* ================================================================== */

export function ShelfReturnScreen({ t, accent, ctx }: Props) {
  const [mode, setMode] = useState<"return" | "exchange">("return");
  const [kind, setKind] = useState<"full" | "partial" | "shelf">("shelf");
  const [reason, setReason] = useState("Muddati tugagan (s polki)");
  const [qty, setQty] = useState(4);
  const [photo, setPhoto] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title={mode === "return" ? "Vazvrat · S polki" : "Almashtirish (Obmen)"} sub="MCHJ O'zbekiston Gullari" onBack={() => ctx.go("menu")} />
        <div className="grid grid-cols-2 gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          <button type="button" onClick={() => setMode("return")} className="rounded-[7px] py-1.5 text-[9px] font-bold" style={{ background: mode === "return" ? t.card : "transparent", color: mode === "return" ? t.ink : t.sub }}>
            Qaytarish (Vazvrat)
          </button>
          <button type="button" onClick={() => setMode("exchange")} className="rounded-[7px] py-1.5 text-[9px] font-bold" style={{ background: mode === "exchange" ? t.card : "transparent", color: mode === "exchange" ? t.ink : t.sub }}>
            Almashtirish (Obmen)
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {mode === "return" && (
          <div>
            <p className="mb-1.5 text-[9px] font-bold" style={{ color: t.ink }}>Qaytarish turi (3 xil)</p>
            <div className="space-y-1">
              {[
                { k: "full" as const, l: "To'liq qaytarish", s: "Butun buyurtma #1847" },
                { k: "partial" as const, l: "Qisman qaytarish", s: "Faqat tanlangan tovarlar" },
                { k: "shelf" as const, l: "Polkadan qaytarish (S polki)", s: "Do'kon polkasidan yaroqsiz / muddatli" },
              ].map((it) => (
                <button
                  key={it.k}
                  type="button"
                  onClick={() => setKind(it.k)}
                  className="flex w-full items-center gap-2 rounded-[12px] p-2.5 text-left transition"
                  style={{
                    background: kind === it.k ? accent.hex : t.card,
                    color: kind === it.k ? "#fff" : t.ink,
                    border: `1px solid ${kind === it.k ? accent.hex : t.line}`,
                  }}
                >
                  <RotateCcw size={13} />
                  <div className="flex-1">
                    <p className="text-[9.5px] font-bold">{it.l}</p>
                    <p className="text-[7.5px]" style={{ opacity: 0.75 }}>{it.s}</p>
                  </div>
                  {kind === it.k && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[9px] font-bold" style={{ color: t.ink }}>Sabab</p>
          <div className="grid grid-cols-2 gap-1">
            {["Brak tovar", "Muddati tugagan (s polki)", "Noto'g'ri tovar", "Ortiqcha"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="rounded-[10px] p-2 text-left text-[8.5px] font-semibold"
                style={{
                  background: reason === r ? t.accSoft : t.card,
                  color: reason === r ? t.accInk : t.ink,
                  border: `1px solid ${reason === r ? accent.hex : t.line}`,
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[14px] p-2.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9.5px] font-bold" style={{ color: t.ink }}>Sut Musaffo 1L · Partiya #04-A</p>
              <p className="text-[8px]" style={{ color: "#e0574b" }}>Muddati: 05.07.2026 · 14 500 so'm</p>
            </div>
            <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: t.card2 }}>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-5 place-items-center rounded-full bg-white text-[10px] text-ink">−</button>
              <span className="w-4 text-center font-mono text-[9px] font-bold" style={{ color: t.ink }}>{qty}</span>
              <button type="button" onClick={() => setQty((q) => q + 1)} className="grid size-5 place-items-center rounded-full text-[10px] on-acc" style={{ background: accent.hex }}>+</button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setPhoto(true); ctx.toast("Polka fotosi biriktirildi"); }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[8.5px] font-semibold"
            style={{ background: photo ? t.accSoft : t.card2, color: photo ? t.accInk : t.ink }}
          >
            <Camera size={11} /> {photo ? "Foto biriktirildi (2 ta) ✓" : "Polkadan foto olish"}
          </button>
        </div>
      </div>

      <div className="border-t px-4 pb-2 pt-2.5" style={{ borderColor: t.line, background: t.card }}>
        <button
          type="button"
          onClick={() => {
            ctx.toast(`${mode === "return" ? "S polki vazvrat" : "Almashtirish"} yuborildi · ${fmt(qty * 14500)} so'm`);
            ctx.go("home");
          }}
          className="w-full rounded-[10px] py-2.5 text-[10.5px] font-bold on-acc"
          style={{ background: accent.hex }}
        >
          {mode === "return" ? `Qaytarishni yuborish (${fmt(qty * 14500)} so'm)` : "Almashtirish so'rovini yuborish"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  7. WAREHOUSE STOCK & DRAFTS                                       */
/* ================================================================== */

export function WarehouseScreen({ t, accent, ctx }: Props) {
  const [wh, setWh] = useState(0);
  const stocks = [
    { name: "Coca-Cola 1.5L", cat: "Ichimlik", qty: [48, 24, 16], box: 6, price: 12000 },
    { name: "Lay's Classic 80g", cat: "Snek", qty: [32, 18, 40], box: 16, price: 9500 },
    { name: "Nescafé Gold 100g", cat: "Kofe", qty: [14, 6, 9], box: 6, price: 42000 },
    { name: "Fairy Limon 450ml", cat: "Maishiy", qty: [19, 12, 8], box: 12, price: 18000 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Ombor qoldiqlari" sub="1 208 SKU · Yangilandi 12:48" onBack={() => ctx.go("menu")} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["Markaziy", "Chilonzor", "Sergeli"].map((w, i) => (
            <Chip key={w} t={t} accent={accent} active={wh === i} onClick={() => setWh(i)}>{w}</Chip>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2.5">
        {stocks.map((s, i) => {
          const q = s.qty[wh];
          return (
            <div key={s.name} className={cn("flex items-center gap-2.5 rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <span className="grid size-8 place-items-center rounded-lg" style={{ background: t.accSoft, color: t.accInk }}><Package size={14} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold" style={{ color: t.ink }}>{s.name}</p>
                <p className="text-[8px]" style={{ color: t.sub }}>{s.cat} · {fmt(s.price)} so'm</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10.5px] font-bold" style={{ color: q < 15 ? "#e0a023" : accent.hex }}>{q} dona</p>
                <p className="font-mono text-[7.5px]" style={{ color: t.sub }}>{(q / s.box).toFixed(1)} kor</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DraftsScreen({ t, accent, ctx }: Props) {
  const drafts = [
    { id: "DR-09", client: "MCHJ O'zbekiston Gullari", items: 4, sum: 184000, age: "18 daq oldin" },
    { id: "DR-08", client: "OOO Navruz Shop", items: 7, sum: 420000, age: "Kecha 16:40" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Qoralamalar (Draft)" sub="Oflayn saqlangan buyurtmalar" onBack={() => ctx.go("menu")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        {drafts.map((d, i) => (
          <div key={d.id} className={cn("rounded-[14px] p-3", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8.5px] font-bold" style={{ color: t.accText }}>{d.id}</span>
              <span className="text-[8px]" style={{ color: t.sub }}>{d.age}</span>
            </div>
            <p className="mt-1 text-[10.5px] font-bold" style={{ color: t.ink }}>{d.client}</p>
            <p className="text-[8.5px]" style={{ color: t.sub }}>{d.items} pozitsiya · {fmt(d.sum)} so'm</p>
            <button type="button" onClick={() => ctx.go("order")} className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[9.5px] font-bold on-acc" style={{ background: accent.hex }}>
              <CheckCircle2 size={11} /> Davom ettirish
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export unused icons safely so tree remains clean
export const _DetailedIcons = { ShieldCheck, PackageCheck, Truck };
