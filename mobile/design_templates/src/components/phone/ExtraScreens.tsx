import { useEffect, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, Check, Clock3, Download, Flag, Gift,
  MapPin, Navigation, Pencil, Target, Trophy,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { anim, fmt, IconBtn, ScreenHead, type Props } from "./PhoneScreens";

/* ------------------------------------------------------------------ */
/*  MY ORDERS (agent_orders_page.dart)                                 */
/* ------------------------------------------------------------------ */

type OrderStatus = "Yangi" | "Tasdiqlangan" | "Yo'lda" | "Yetkazildi" | "Bekor";

const MY_ORDERS: { no: string; client: string; date: string; sum: number; items: number; st: OrderStatus }[] = [
  { no: "№1848", client: "MCHJ O'zbekiston Gullari", date: "Bugun 10:24", sum: 64800, items: 6, st: "Yo'lda" },
  { no: "№1847", client: "OOO Navruz Shop", date: "Bugun 09:41", sum: 1240000, items: 14, st: "Tasdiqlangan" },
  { no: "№1846", client: "IP Karimov Store", date: "Kecha 16:12", sum: 480000, items: 8, st: "Yetkazildi" },
  { no: "№1845", client: "MCHJ Lalaku Savdo", date: "Kecha 14:05", sum: 215000, items: 5, st: "Yetkazildi" },
  { no: "№1844", client: "IP Baraka Market", date: "5 iyul 11:48", sum: 96000, items: 3, st: "Yangi" },
  { no: "№1843", client: "OOO Fayz Market", date: "5 iyul 09:20", sum: 310000, items: 7, st: "Bekor" },
];
const ST_TONE: Record<OrderStatus, string> = { Yangi: "#E0A023", Tasdiqlangan: "#3E9BFF", "Yo'lda": "#8B5CF6", Yetkazildi: "#22B573", Bekor: "#94A3B8" };

export function OrdersScreen({ t, accent, ctx }: Props) {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const list = MY_ORDERS.filter((o) => filter === "all" || o.st === filter);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Mening buyurtmalarim" sub="Bu hafta · 22 ta · 18.4 mln so'm" right={<IconBtn t={t} onClick={() => ctx.go("order")}><Pencil size={13} /></IconBtn>} />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {(["all", "Yangi", "Tasdiqlangan", "Yo'lda", "Yetkazildi"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className="whitespace-nowrap rounded-full px-3 py-1.5 text-[9px] font-semibold" style={{ background: filter === f ? accent.hex : t.card, color: filter === f ? accent.onAccent : t.sub, border: `1px solid ${filter === f ? accent.hex : t.line}` }}>
              {f === "all" ? "Barchasi" : f}
            </button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-2">
        {list.map((o, i) => (
          <button key={o.no} type="button" onClick={() => ctx.go("order-detail")} className={cn("w-full rounded-[13px] p-2.5 text-left transition active:scale-[0.99]", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold" style={{ color: t.ink }}>{o.no}</span>
              <span className="rounded-full px-1.5 py-[2px] text-[7px] font-bold uppercase" style={{ background: `${ST_TONE[o.st]}1E`, color: ST_TONE[o.st] }}>{o.st}</span>
            </div>
            <p className="mt-1 truncate text-[10px] font-semibold" style={{ color: t.ink }}>{o.client}</p>
            <div className="mt-1 flex items-center gap-2 text-[8px]" style={{ color: t.sub }}>
              <span>{o.date}</span>
              <span>{o.items} pozitsiya</span>
              <span className="ml-auto font-mono font-bold" style={{ color: t.ink }}>{fmt(o.sum)} so'm</span>
            </div>
          </button>
        ))}
        {!list.length && <p className="py-10 text-center text-[9.5px]" style={{ color: t.sub }}>Bu holatda buyurtma yo'q</p>}
      </div>
      <div className="px-4 pb-3">
        <button type="button" onClick={() => ctx.go("order")} className="w-full rounded-[11px] py-2.5 text-[10.5px] font-bold on-acc" style={{ background: accent.gradient }}>+ Yangi buyurtma</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ORDER DETAIL + 5-MIN EDIT WINDOW (order detail · edit window)      */
/* ------------------------------------------------------------------ */

const EDIT_TOTAL = 300;

export function OrderDetailScreen({ t, accent, ctx }: Props) {
  const fast = ctx.motion === "off";
  const [left, setLeft] = useState(EDIT_TOTAL);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), fast ? 60 : 1000);
    return () => clearTimeout(id);
  }, [left, fast]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const steps = [
    { l: "Yaratildi", v: "10:24 · Aziz Q." },
    { l: "Tasdiqlandi", v: "10:31 · Supervayzer" },
    { l: "Yuklandi", v: "11:05 · Ombor" },
    { l: "Yo'lda", v: "hozir · 01 A 777" },
    { l: "Yetkazildi", v: "kutilmoqda" },
  ];
  const doneIdx = 3;

  return (
    <div className="flex h-full flex-col" data-edit-left={left}>
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Buyurtma №1848" sub="MCHJ O'zbekiston Gullari · TT-0847" onBack={() => ctx.go("orders")} right={<IconBtn t={t} onClick={() => ctx.toast("PDF chek yuklab olindi")}><Download size={13} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3">
        {/* edit window */}
        <div className="rounded-[14px] p-3" style={{ background: left > 0 ? t.accSoft : t.card2, border: `1px solid ${left > 0 ? accent.hex : t.line}` }}>
          <div className="flex items-center gap-2">
            <Clock3 size={14} style={{ color: left > 0 ? t.accText : t.sub }} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold" style={{ color: t.ink }}>{left > 0 ? "Tahrirlash oynasi ochiq" : "Tahrirlash oynasi yopildi"}</p>
              <p className="text-[8px]" style={{ color: t.sub }}>{left > 0 ? "5 daqiqa ichida miqdorni o'zgartirish mumkin" : "Endi faqat bekor qilish so'rovi yuboriladi"}</p>
            </div>
            <span className="font-mono text-[15px] font-bold tabular-nums" style={{ color: left > 0 ? t.accText : "#94A3B8" }}>{mm}:{ss}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: t.card }}>
            <div className="h-full rounded-full" style={{ width: `${(left / EDIT_TOTAL) * 100}%`, background: left > 60 ? accent.hex : "#E0574B", transition: "width 1s linear" }} />
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" disabled={left <= 0} onClick={() => ctx.go("order")} className="flex flex-1 items-center justify-center gap-1 rounded-[9px] py-2 text-[9px] font-bold on-acc disabled:opacity-40" style={{ background: accent.hex }}>
              <Pencil size={10} /> Tahrirlash
            </button>
            <button type="button" onClick={() => ctx.toast("Bekor qilish so'rovi yuborildi")} className="flex-1 rounded-[9px] py-2 text-[9px] font-semibold" style={{ background: t.card, border: `1px solid ${t.line}`, color: "#E0574B" }}>
              Bekor qilish
            </button>
          </div>
        </div>

        {/* status timeline */}
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[10px] font-bold" style={{ color: t.ink }}>Holat tarixi</p>
          <div className="relative mt-2 space-y-2">
            <span className="absolute bottom-1.5 left-[8px] top-1.5 w-px" style={{ background: t.line }} />
            {steps.map((s, i) => {
              const done = i <= doneIdx;
              return (
                <div key={s.l} className="relative flex items-center gap-2">
                  <span className="relative z-10 grid size-[17px] shrink-0 place-items-center rounded-full" style={{ background: done ? accent.hex : t.card2, color: accent.onAccent, boxShadow: i === doneIdx ? `0 0 0 3px ${accent.hex}2E` : "none" }}>
                    {done ? <Check size={10} strokeWidth={3.5} /> : <span className="size-1 rounded-full bg-current" />}
                  </span>
                  <span className="flex-1 text-[9.5px] font-semibold" style={{ color: done ? t.ink : t.sub }}>{s.l}</span>
                  <span className="font-mono text-[7.5px]" style={{ color: t.sub }}>{s.v}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* items */}
        <div className="rounded-[14px]" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="border-b px-3 py-2 text-[10px] font-bold" style={{ borderColor: t.line, color: t.ink }}>Tovarlar · 6 dona</p>
          {[
            { n: "Coca-Cola 1.5L", q: 6, p: 12000 },
            { n: "Lay's Classic 80g", q: 12, p: 9500 },
            { n: "Snickers 50g", q: 24, p: 6000 },
          ].map((it, i) => (
            <div key={it.n} className="flex items-center gap-2 px-3 py-2 text-[9px]" style={{ borderBottom: i < 2 ? `1px solid ${t.line}` : "none" }}>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold" style={{ color: t.ink }}>{it.n}</span><span style={{ color: t.sub }}>× {it.q} · {fmt(it.p)}</span></span>
              <span className="font-mono font-bold" style={{ color: t.ink }}>{fmt(it.q * it.p)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-[9px]" style={{ background: t.card2 }}>
            <span style={{ color: t.sub }}>Skidka −2% · Bonus 1 dona</span>
            <span className="font-mono font-bold" style={{ color: t.ink }}>64 800 so'm</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MY BONUSES (agent bonuses)                                         */
/* ------------------------------------------------------------------ */

export function BonusesScreen({ t, ctx }: Props) {
  const tiers = [
    { l: "20 mln so'm", b: "3%", fill: 100, done: true },
    { l: "30 mln so'm", b: "5%", fill: 74, done: false },
    { l: "40 mln so'm", b: "8%", fill: 46, done: false },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Mening bonuslarim" sub="Iyul 2026 · avtomatik hisoblanadi" onBack={() => ctx.go("home")} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className="relative overflow-hidden rounded-[18px] p-3.5 text-white" style={{ background: "linear-gradient(140deg,#B45309,#7C2D12)" }}>
          <div className="absolute -right-8 -top-10 size-28 rounded-full bg-white/10" />
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/60">Jami hisoblangan bonus</p>
          <p className="mt-1 font-display text-[26px] font-bold leading-none tabular-nums">842 500 <span className="text-[10px] font-medium text-white/60">so'm</span></p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            {[["486k", "To'langan"], ["356k", "Kutilmoqda"], ["12", "Aksiya"]].map(([v, l]) => (
              <div key={l} className="rounded-lg bg-white/12 p-1.5"><p className="font-mono text-[10px] font-bold">{v}</p><p className="text-[7px] text-white/65">{l}</p></div>
            ))}
          </div>
        </div>

        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: t.ink }}><Gift size={12} style={{ color: "#CA8A04" }} /> Bonus zinapoyasi</p>
          <div className="mt-2 space-y-2">
            {tiers.map((x) => (
              <div key={x.l}>
                <div className="flex justify-between text-[8.5px]"><span className="font-semibold" style={{ color: t.ink }}>{x.l}</span><span className="font-mono font-bold" style={{ color: x.done ? "#22B573" : t.sub }}>{x.b}</span></div>
                <div className="mt-1 h-[4px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${x.fill}%`, background: x.done ? "#22B573" : "#E9B949" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {[
          { r: "Coca-Cola 5+1", d: "12 ta buyurtma", v: "+86 dona sovg'a" },
          { r: "Sneklar 10→2", d: "7 ta buyurtma", v: "+14 dona sovg'a" },
          { r: "300k+ Nescafé", d: "4 ta buyurtma", v: "+4 dona sovg'a" },
        ].map((r, i) => (
          <div key={r.r} className={cn("flex items-center gap-2.5 rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" style={{ background: "#FEF3C7", color: "#B45309" }}><Trophy size={13} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9.5px] font-bold" style={{ color: t.ink }}>{r.r}</span>
              <span className="block text-[8px]" style={{ color: t.sub }}>{r.d}</span>
            </span>
            <span className="font-mono text-[8.5px] font-bold" style={{ color: "#B45309" }}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  REPORTS                                                            */
/* ------------------------------------------------------------------ */

export function ReportScreen({ t, accent, ctx }: Props) {
  const [range, setRange] = useState(0);
  const rows = range === 0
    ? [["Savdo", "18.4 mln", "+18%", true], ["Buyurtmalar", "22", "+4", true], ["Qaytarishlar", "3", "−1", false], ["Yangi mijozlar", "2", "+2", true]]
    : [["Savdo", "4.9 mln", "+9%", true], ["Buyurtmalar", "7", "+2", true], ["Qaytarishlar", "1", "0", false], ["Yangi mijozlar", "1", "+1", true]];
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Hisobotlar" sub="Savdo va faoliyat yakuni" onBack={() => ctx.go("home")} right={<IconBtn t={t} onClick={() => ctx.toast("Excel hisobot yuborildi")}><Download size={13} /></IconBtn>} />
        <div className="flex gap-1 rounded-[10px] p-1" style={{ background: t.card2 }}>
          {["Hafta", "Oy"].map((r, i) => (
            <button key={r} type="button" onClick={() => setRange(i)} className="flex-1 rounded-[7px] py-1.5 text-[9px] font-semibold" style={{ background: range === i ? t.card : "transparent", color: range === i ? t.ink : t.sub, boxShadow: range === i ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>{r}</button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2.5">
        <div className="grid grid-cols-2 gap-2">
          {rows.map(([l, v, d, up], i) => (
            <div key={l as string} className={cn("rounded-[13px] p-2.5", anim(ctx, i).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
              <p className="text-[8px]" style={{ color: t.sub }}>{l}</p>
              <p className="mt-0.5 font-display text-[15px] font-bold" style={{ color: t.ink }}>{v}</p>
              <p className="mt-0.5 flex items-center gap-0.5 font-mono text-[7.5px] font-bold" style={{ color: up ? "#22B573" : "#94A3B8" }}>
                {up ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}{d}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <p className="text-[10px] font-bold" style={{ color: t.ink }}>Kunlik savdo</p>
          <div className="mt-2 flex h-[64px] items-end gap-1.5">
            {[42, 58, 47, 72, 63, 88, 69].map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="bar-grow w-full rounded-t-[3px]" style={{ height: `${v}%`, background: i === 5 ? accent.hex : `${accent.hex}55`, animationDelay: `${i * 45}ms` }} />
                <span className="text-[6.5px]" style={{ color: t.sub }}>{["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"][i]}</span>
              </div>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => ctx.toast("Hisobot supervayzerga yuborildi")} className="flex w-full items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
          <Download size={11} /> Hisobotni yuborish
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAP (agent map page)                                               */
/* ------------------------------------------------------------------ */

export function MapScreen({ t, accent, ctx }: Props) {
  const [sel, setSel] = useState(1);
  const pins = [
    { x: 24, y: 66, name: "Gullari", st: "Yetkazildi", done: true },
    { x: 52, y: 38, name: "Karimov", st: "Faol vizit", done: false },
    { x: 76, y: 58, name: "Navruz", st: "14:00", done: false },
    { x: 66, y: 20, name: "Lalaku", st: "16:30", done: false },
  ];
  return (
    <div className="relative flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden" style={{ background: t.isDark ? "#0D1524" : "#E4EDF6" }}>
        <svg className="absolute inset-0 size-full" viewBox="0 0 300 460" preserveAspectRatio="none" aria-hidden>
          <g stroke={t.isDark ? "#1C2A44" : "#FFFFFF"} strokeWidth="7" fill="none">
            <path d="M0 90 H300" /><path d="M0 200 H300" /><path d="M0 320 H300" /><path d="M0 400 H300" />
            <path d="M70 0 V460" /><path d="M150 0 V460" /><path d="M235 0 V460" />
          </g>
          <path d="M40 330 C 90 240, 140 260, 156 176 S 240 90, 228 92" fill="none" stroke={accent.hex} strokeWidth="3.5" strokeDasharray="6 5" strokeLinecap="round" />
          <rect x="240" y="360" width="48" height="60" rx="6" fill={t.isDark ? "#17365A" : "#BFDBFE"} />
        </svg>
        {pins.map((p, i) => (
          <button key={p.name} type="button" onClick={() => setSel(i)} aria-label={p.name} className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform active:scale-90" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <span className="grid size-7 place-items-center rounded-full border-2 font-mono text-[8px] font-bold shadow-md" style={{ background: p.done ? "#22B573" : i === sel ? accent.hex : "#fff", borderColor: "#fff", color: p.done || i === sel ? "#fff" : t.ink, transform: sel === i ? "scale(1.25)" : "scale(1)" }}>
              {p.done ? <Check size={11} strokeWidth={3.5} /> : i + 1}
            </span>
          </button>
        ))}
        <div className="absolute inset-x-3 top-3">
          <ScreenHead t={t} title="Xarita" sub="Bugungi marshrut · 21 km" right={<IconBtn t={t} onClick={() => ctx.go("route-plan")}><Navigation size={13} /></IconBtn>} />
        </div>
        <div className="absolute inset-x-3 bottom-3">
          <div className="rounded-[14px] p-3 shadow-lg" style={{ background: t.card, border: `1px solid ${t.line}` }}>
            <div className="flex items-start gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" style={{ background: t.accSoft, color: t.accText }}><MapPin size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] font-bold" style={{ color: t.ink }}>{["MCHJ O'zbekiston Gullari", "IP Karimov Store", "OOO Navruz Shop", "MCHJ Lalaku Savdo"][sel]}</p>
                <p className="text-[8px]" style={{ color: t.sub }}>{pins[sel].st} · 1.2 km · 4 daqiqa</p>
              </div>
              <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase" style={{ background: pins[sel].done ? "#22B5731E" : t.accSoft, color: pins[sel].done ? "#1E9E63" : t.accText }}>{pins[sel].st}</span>
            </div>
            <button type="button" onClick={() => ctx.go("visits")} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[9px] py-2 text-[9.5px] font-bold on-acc" style={{ background: accent.gradient }}>
              <Navigation size={11} /> Vizitni boshlash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ROUTE PLAN (daily route plan / route KPI)                          */
/* ------------------------------------------------------------------ */

export function RoutePlanScreen({ t, accent, ctx }: Props) {
  const stops = [
    { time: "09:40", name: "MCHJ O'zbekiston Gullari", st: "done" as const, info: "Buyurtma №1847 · 1.24 mln" },
    { time: "11:20", name: "IP Karimov Store", st: "done" as const, info: "Foto hisobot · to'lov 480k" },
    { time: "13:00", name: "OOO Navruz Shop", st: "now" as const, info: "Faol vizit · 04:12" },
    { time: "14:30", name: "MCHJ Lalaku Savdo", st: "next" as const, info: "Qarz 120k · eslatma" },
    { time: "16:00", name: "IP Baraka Market", st: "next" as const, info: "Yangi nuqta · foto kerak" },
    { time: "17:30", name: "OOO Fayz Market", st: "next" as const, info: "Takroriy tashrif" },
  ];
  const pct = 42;
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Kunlik reja" sub="7 iyul · Toshkent Sharq" onBack={() => ctx.go("home")} right={<IconBtn t={t} onClick={() => ctx.go("map")}><MapPin size={13} /></IconBtn>} />
        <div className="rounded-[14px] p-3" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between text-[8.5px]">
            <span className="flex items-center gap-1 font-semibold" style={{ color: t.ink }}><Target size={10} style={{ color: t.accText }} /> Marshrut bajarilishi</span>
            <span className="font-mono font-bold" style={{ color: t.accText }}>{pct}%</span>
          </div>
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: accent.hex }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[7px]" style={{ color: t.sub }}>
            <span>2/6 vizit</span><span>21 km</span><span>qoldi 3.5 soat</span>
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-3 pt-2.5">
        <div className="relative space-y-2">
          <span className="absolute bottom-3 left-[52px] top-3 w-px" style={{ background: t.line }} />
          {stops.map((s, i) => (
            <button key={s.name} type="button" onClick={() => ctx.go(s.st === "now" ? "visits" : "map")} className={cn("relative flex w-full items-start gap-2.5 text-left", anim(ctx, i).className)}>
              <span className="w-9 shrink-0 pt-1 text-right font-mono text-[8.5px] font-bold" style={{ color: s.st === "now" ? t.accText : t.sub }}>{s.time}</span>
              <span className="relative z-10 mt-0.5 grid size-[17px] shrink-0 place-items-center rounded-full" style={{ background: s.st === "done" ? "#22B573" : s.st === "now" ? accent.hex : t.card2, color: accent.onAccent, border: `1.5px solid ${s.st === "next" ? t.line : "transparent"}`, boxShadow: s.st === "now" ? `0 0 0 3px ${accent.hex}2E` : "none" }}>
                {s.st === "done" ? <Check size={10} strokeWidth={3.5} /> : s.st === "now" ? <span className="size-1.5 rounded-full" style={{ background: accent.onAccent }} /> : <Flag size={8} style={{ color: t.sub }} />}
              </span>
              <span className="min-w-0 flex-1 rounded-[12px] p-2" style={{ background: t.card, border: `1px solid ${s.st === "now" ? accent.hex : t.line}` }}>
                <span className="block truncate text-[9.5px] font-bold" style={{ color: t.ink }}>{s.name}</span>
                <span className="mt-0.5 block text-[8px]" style={{ color: s.st === "now" ? t.accText : t.sub }}>{s.info}</span>
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => ctx.go("map")} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[10px] font-bold on-acc" style={{ background: accent.gradient }}>
          <CalendarDays size={12} /> Xaritada ochish
        </button>
        <div className="mt-2 rounded-[11px] px-3 py-2 text-[8px]" style={{ background: t.card, border: `1px solid ${t.line}`, color: t.sub }}>
          Marshrut KPI: reja 6 vizit · fakt 2 · samaradorlik 42%. Kechikish 18 daqiqa — keyingi nuqta 14:30 ga ko'chirildi.
        </div>
      </div>
    </div>
  );
}
