import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileEdit,
  Flame,
  Gift,
  Menu,
  PackageCheck,
  Receipt,
  RefreshCw,
  Send,
  Target,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Truck,
  Wallet,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { anim, fmt, IconBtn, LiveClock, type Props } from "./PhoneScreens";

const WEEK = [
  { d: "Du", v: 62 },
  { d: "Se", v: 48 },
  { d: "Ch", v: 78 },
  { d: "Pa", v: 55 },
  { d: "Ju", v: 92 },
  { d: "Sh", v: 71 },
  { d: "Ya", v: 34 },
];
const MONTH = [
  { d: "1-h", v: 54 },
  { d: "2-h", v: 68 },
  { d: "3-h", v: 47 },
  { d: "4-h", v: 86 },
  { d: "5-h", v: 72 },
  { d: "6-h", v: 95 },
  { d: "7-h", v: 41 },
];

const PIPELINE = [
  { key: "draft", label: "Qoralama", n: 2, icon: FileEdit, tone: "#8B93A7", go: "drafts" as const },
  { key: "sent", label: "Yuborilgan", n: 3, icon: Send, tone: "#E0A023", go: "order" as const },
  { key: "ok", label: "Tasdiq", n: 5, icon: CheckCircle2, tone: "#3E9BFF", go: "order" as const },
  { key: "done", label: "Yetkazildi", n: 12, icon: PackageCheck, tone: "#22B573", go: "warehouse" as const },
];

const TOP = [
  { name: "Coca-Cola 1.5L", qty: 148, sum: 1776000, trend: 12 },
  { name: "Lay's Classic 80g", qty: 96, sum: 912000, trend: 8 },
  { name: "Nescafé Gold 100g", qty: 24, sum: 1008000, trend: -4 },
];

const TASKS = [
  { id: 1, text: "Navruz Shop — foto hisobotni qayta yuklash", due: "Bugun 16:00", urgent: true },
  { id: 2, text: "Lalaku Savdo qarzi bo'yicha qo'ng'iroq", due: "Bugun 18:00", urgent: false },
  { id: 3, text: "Oylik KPI o'zini baholash", due: "10-iyul", urgent: false },
];

export default function HomeDashboard({ t, accent, ctx }: Props) {
  const [range, setRange] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [syncing, setSyncing] = useState(false);
  const series = range === 0 ? WEEK : MONTH;
  const peak = Math.max(...series.map((s) => s.v));

  const plan = 12400000;
  const fact = 8120000;
  const pct = Math.round((fact / plan) * 100);
  const daysLeft = 18;
  const perDay = Math.round((plan - fact) / daysLeft);
  const overdue = 1240000 + 480000 + 120000;

  const runSync = () => {
    if (syncing) return;
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      ctx.toast("Sinxronlandi · 12 buyurtma · 8 foto");
    }, 1100);
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── header ─────────────────────────────────────── */}
      <div className="px-4 pt-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative grid size-9 place-items-center rounded-full text-[11px] font-bold on-acc" style={{ background: accent.gradient }}>
              AQ
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 bg-[#22B573]" style={{ borderColor: t.bg }} />
            </div>
            <div>
              <p className="text-[9px] font-medium" style={{ color: t.sub }}>Dushanba, 7-iyul · Toshkent</p>
              <p className="text-[13px] font-bold leading-tight tracking-[-0.02em]" style={{ color: t.ink }}>Aziz Qodirov</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <IconBtn t={t} onClick={() => ctx.go("menu")} active><Menu size={14} /></IconBtn>
            <IconBtn t={t} onClick={() => ctx.go("notifications")} dot><Bell size={14} /></IconBtn>
            <IconBtn t={t} onClick={runSync}>
              <RefreshCw size={13} className={syncing ? "animate-spin" : undefined} />
            </IconBtn>
          </div>
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-4 pt-3">
        {/* ── A. monthly plan hero ─────────────────────── */}
        <div
          className={cn("relative overflow-hidden rounded-[20px] p-3.5 on-acc", anim(ctx, 0).className)}
          style={{ background: accent.gradient, boxShadow: `0 16px 32px -18px ${accent.hex}` }}
        >
          <div className="absolute -right-8 -top-10 size-28 rounded-full bg-current opacity-[0.12]" />
          <div className="absolute -bottom-12 right-10 size-24 rounded-full bg-current opacity-[0.08]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-current/15 px-2 py-[3px] text-[7.5px] font-bold uppercase tracking-[0.14em]">
                <Target size={9} /> Iyul rejasi
              </span>
              <p className="mt-2 font-display text-[26px] font-bold leading-none tracking-[-0.04em]">
                {pct}<span className="text-[13px] on-acc-70">%</span>
              </p>
              <p className="mt-1.5 font-mono text-[9px] on-acc-70">
                {fmt(fact)} / {fmt(plan)} so'm
              </p>
            </div>
            <div className="relative size-[62px] shrink-0">
              <svg viewBox="0 0 44 44" className="-rotate-90">
                <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="4.5" />
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 113} 113`}
                  style={{ transition: "stroke-dasharray 1s cubic-bezier(.16,1,.3,1)" }}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center font-mono text-[9px] font-bold">{daysLeft} kun</span>
            </div>
          </div>
          <div className="relative mt-3 flex items-center gap-2 rounded-[10px] px-2.5 py-2 backdrop-blur-sm" style={{ background: accent.onAccent === "#FFFFFF" ? "rgba(0,0,0,.22)" : "rgba(255,255,255,.42)" }}>
            <Flame size={12} className="shrink-0" style={{ color: accent.onAccent === "#FFFFFF" ? "#FFD27A" : "#B4530A" }} />
            <p className="text-[8.5px] leading-tight" style={{ color: accent.onAccent === "#FFFFFF" ? "rgba(255,255,255,.88)" : "rgba(11,42,6,.85)" }}>
              Kunlik maqsad <b className="font-mono">{fmt(perDay)}</b> so'm · reja uchun
            </p>
          </div>
        </div>

        {/* quick entry points */}
        <div className="grid grid-cols-4 gap-2">
          {([
            { l: "Buyurtmalar", go: "orders" as const, d: "22 ta" },
            { l: "Xarita", go: "map" as const, d: "21 km" },
            { l: "Reja", go: "route-plan" as const, d: "42%" },
            { l: "Bonuslar", go: "bonuses" as const, d: "842k" },
          ]).map((q, i) => (
            <button
              key={q.l}
              type="button"
              onClick={() => ctx.go(q.go)}
              className={cn("rounded-[13px] p-2 text-left transition active:scale-95", anim(ctx, i + 1).className)}
              style={{ background: t.card, border: `1px solid ${t.line}` }}
            >
              <span className="block text-[8.5px] font-bold truncate" style={{ color: t.ink }}>{q.l}</span>
              <span className="mt-0.5 block font-mono text-[8px] font-semibold" style={{ color: t.accText }}>{q.d}</span>
            </button>
          ))}
        </div>

        {/* ── B. today tiles ───────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "Bugungi savdo", v: "1.24", u: "mln", d: "+18%", up: true, icon: CircleDollarSign },
            { l: "Buyurtma", v: "7", u: "dona", d: "2 draft", up: true, icon: Receipt },
            { l: "Bonus", v: "84", u: "ming", d: "5%", up: true, icon: Gift },
          ].map((s, i) => (
            <div
              key={s.l}
              className={cn("rounded-[14px] p-2.5", anim(ctx, i + 1).className)}
              style={{ background: t.card, border: `1px solid ${t.line}` }}
            >
              <s.icon size={12} style={{ color: t.accText }} />
              <p className="mt-1.5 font-display text-[15px] font-bold leading-none tracking-[-0.02em]" style={{ color: t.ink }}>
                {s.v}<span className="ml-0.5 text-[7.5px] font-medium" style={{ color: t.sub }}>{s.u}</span>
              </p>
              <p className="mt-1 truncate text-[7.5px]" style={{ color: t.sub }}>{s.l}</p>
              <p className="mt-1 inline-flex items-center gap-0.5 rounded px-1 py-[1px] font-mono text-[7px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>
                {s.up ? <ArrowUpRight size={7} /> : <ArrowDownRight size={7} />}{s.d}
              </p>
            </div>
          ))}
        </div>

        {/* ── C. sales chart ───────────────────────────── */}
        <div className={cn("rounded-[16px] p-3", anim(ctx, 4).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} style={{ color: t.accText }} />
              <p className="text-[10px] font-bold" style={{ color: t.ink }}>Savdo dinamikasi</p>
            </div>
            <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: t.card2 }}>
              {["Hafta", "Oy"].map((r, i) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(i)}
                  className="rounded-md px-2 py-1 text-[7.5px] font-semibold transition"
                  style={{ background: range === i ? t.card : "transparent", color: range === i ? t.ink : t.sub, boxShadow: range === i ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex h-[68px] items-end gap-1.5">
            {series.map((s, i) => {
              const top = s.v === peak;
              return (
                <button
                  key={s.d}
                  type="button"
                  onClick={() => ctx.toast(`${s.d}: ${(s.v * 18400).toLocaleString("ru-RU")} so'm`)}
                  className="group flex flex-1 flex-col items-center gap-1"
                >
                  <span className="font-mono text-[6.5px] font-bold tabular-nums" style={{ color: top ? t.accText : t.sub }}>{s.v}</span>
                  <span className="flex w-full flex-1 items-end">
                    <span
                      className="bar-grow w-full rounded-t-[3px] transition-all duration-300 group-hover:opacity-80"
                      style={{
                        height: `${s.v}%`,
                        background: top ? accent.hex : `${accent.hex}59`,
                        boxShadow: t.isDark ? "none" : `inset 0 0 0 1px ${accent.ink}33`,
                        animationDelay: `${i * 45}ms`,
                      }}
                    />
                  </span>
                  <span className="text-[6.5px] font-medium" style={{ color: top ? t.accText : t.sub }}>{s.d}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── D. order pipeline ────────────────────────── */}
        <div className={cn("rounded-[16px] p-3", anim(ctx, 5).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Buyurtmalar oqimi</p>
            <span className="font-mono text-[8px]" style={{ color: t.sub }}>22 ta · bu hafta</span>
          </div>
          <div className="mt-2.5 flex items-stretch gap-1">
            {PIPELINE.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => ctx.go(p.go)}
                className="group relative flex flex-1 flex-col items-center gap-1 rounded-[10px] py-2 transition active:scale-95"
                style={{ background: t.card2 }}
              >
                <p.icon size={12} style={{ color: p.tone }} />
                <span className="font-display text-[13px] font-bold leading-none" style={{ color: t.ink }}>{p.n}</span>
                <span className="text-[6.5px] font-medium" style={{ color: t.sub }}>{p.label}</span>
                {i < PIPELINE.length - 1 && (
                  <ChevronRight size={9} className="absolute -right-[6px] top-1/2 -translate-y-1/2" style={{ color: t.sub }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── E. receivables ───────────────────────────── */}
        <button
          type="button"
          onClick={() => ctx.go("exp-debtors")}
          className={cn("block w-full rounded-[16px] p-3 text-left transition active:scale-[0.99]", anim(ctx, 6).className)}
          style={{ background: t.card, border: `1px solid ${t.line}` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: t.ink }}>
                <Wallet size={12} style={{ color: "#E0574B" }} /> Qarzdorlik
              </p>
              <p className="mt-1.5 font-display text-[17px] font-bold leading-none tracking-[-0.03em]" style={{ color: "#E0574B" }}>
                {fmt(overdue)} <span className="text-[8px] font-medium" style={{ color: t.sub }}>so'm</span>
              </p>
            </div>
            <span className="rounded-full px-2 py-1 text-[7.5px] font-bold" style={{ background: "#E0574B18", color: "#E0574B" }}>3 mijoz</span>
          </div>
          <div className="mt-2.5 flex h-[6px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
            <span style={{ width: "26%", background: "#22B573" }} />
            <span style={{ width: "67%", background: "#E0A023" }} />
            <span style={{ width: "7%", background: "#E0574B" }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[7px]" style={{ color: t.sub }}>
            <span>0–7 kun · 480k</span>
            <span>8–30 · 1.24m</span>
            <span style={{ color: "#E0574B" }}>30+ · 120k</span>
          </div>
        </button>

        {/* ── F. tasks ─────────────────────────────────── */}
        <div className={cn("rounded-[16px] p-3", anim(ctx, 7).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Bugungi vazifalar</p>
            <button type="button" onClick={() => ctx.go("tasks")} className="flex items-center gap-0.5 text-[8px] font-semibold" style={{ color: t.accText }}>
              {TASKS.length - done.length} ochiq <ChevronRight size={9} />
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {TASKS.map((task) => {
              const ok = done.includes(task.id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setDone((d) => (d.includes(task.id) ? d.filter((x) => x !== task.id) : [...d, task.id]));
                    ctx.toast(ok ? "Vazifa qayta ochildi" : "Vazifa bajarildi");
                  }}
                  className="flex w-full items-start gap-2 rounded-[10px] p-1.5 text-left transition active:scale-[0.99]"
                  style={{ background: ok ? t.card2 : "transparent", opacity: ok ? 0.6 : 1 }}
                >
                  <span
                    className="mt-[1px] grid size-4 shrink-0 place-items-center rounded-full border-2 transition"
                    style={{ borderColor: ok ? accent.hex : t.line, background: ok ? accent.hex : "transparent" }}
                  >
                    {ok && <CheckCircle2 size={9} className="text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold leading-snug" style={{ color: t.ink, textDecoration: ok ? "line-through" : "none" }}>
                      {task.text}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[7.5px]" style={{ color: task.urgent && !ok ? "#E0574B" : t.sub }}>
                      <Clock3 size={7} /> {task.due}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── G. top products ──────────────────────────── */}
        <div className={cn("rounded-[16px] p-3", anim(ctx, 8).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: t.ink }}>
              <Trophy size={11} style={{ color: "#E0A023" }} /> Top mahsulotlar
            </p>
            <span className="font-mono text-[7.5px]" style={{ color: t.sub }}>iyul</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {TOP.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-md font-mono text-[8px] font-bold" style={{ background: i === 0 ? `${accent.hex}22` : t.card2, color: i === 0 ? t.accText : t.sub }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[9px] font-semibold" style={{ color: t.ink }}>{p.name}</span>
                  <span className="mt-[3px] block h-[3px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                    <span className="block h-full rounded-full" style={{ width: `${(p.sum / 1776000) * 100}%`, background: accent.hex, boxShadow: t.isDark ? "none" : `inset 0 0 0 1px ${accent.ink}2E` }} />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[8.5px] font-bold" style={{ color: t.ink }}>{(p.sum / 1000000).toFixed(2)}m</span>
                  <span className="flex items-center justify-end gap-0.5 font-mono text-[7px]" style={{ color: p.trend > 0 ? "#22B573" : "#E0574B" }}>
                    {p.trend > 0 ? <ArrowUpRight size={7} /> : <ArrowDownRight size={7} />}{Math.abs(p.trend)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── H. attendance + stock alert ──────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => ctx.go("tabel")}
            className={cn("rounded-[14px] p-2.5 text-left transition active:scale-[0.98]", anim(ctx, 9).className)}
            style={{ background: t.card, border: `1px solid ${t.line}` }}
          >
            <CalendarCheck size={12} style={{ color: "#22B573" }} />
            <p className="mt-1.5 text-[8px]" style={{ color: t.sub }}>Davomat · bugun</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold" style={{ color: t.ink }}>08:52</p>
            <p className="mt-1 text-[7.5px]" style={{ color: t.sub }}>
              ishda <LiveClock start={14280} accent={accent} color={t.accText} />
            </p>
          </button>
          <button
            type="button"
            onClick={() => ctx.go("warehouse")}
            className={cn("rounded-[14px] p-2.5 text-left transition active:scale-[0.98]", anim(ctx, 10).className)}
            style={{ background: t.isDark ? "#2A2210" : "#FFF8E8", border: "1px solid #EFD9A4" }}
          >
            <TriangleAlert size={12} className="text-[#C98A0B]" />
            <p className="mt-1.5 text-[8px]" style={{ color: t.isDark ? "#D8BE7C" : "#8A6300" }}>Ombor ogohlantirishi</p>
            <p className="mt-0.5 font-mono text-[11px] font-bold" style={{ color: t.isDark ? "#F3D98B" : "#7A5600" }}>2 SKU</p>
            <p className="mt-1 flex items-center gap-0.5 text-[7.5px]" style={{ color: t.isDark ? "#C9AE6A" : "#A6822A" }}>
              <Boxes size={8} /> kam qoldi
            </p>
          </button>
        </div>

        {/* ── I. sync footer ───────────────────────────── */}
        <button
          type="button"
          onClick={runSync}
          className="flex w-full items-center gap-2 rounded-[13px] px-3 py-2.5 transition active:scale-[0.99]"
          style={{ background: t.card, border: `1px solid ${t.line}` }}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: syncing ? t.accSoft : "#22B57318", color: syncing ? accent.hex : "#22B573" }}>
            {syncing ? <RefreshCw size={11} className="animate-spin" /> : <Truck size={11} />}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[9px] font-semibold" style={{ color: t.ink }}>
              {syncing ? "Sinxronlanmoqda…" : "Barcha ma'lumot sinxron"}
            </span>
            <span className="block font-mono text-[7.5px]" style={{ color: t.sub }}>oxirgi: 12:48 · 8 foto · 0 xato</span>
          </span>
          <ChevronRight size={12} style={{ color: t.sub }} />
        </button>
      </div>
    </div>
  );
}
