import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Delete,
  Fingerprint,
  Flame,
  Gift,
  Globe,
  Home,
  Image as ImageIcon,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Minus,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Trophy,
  Target,
  User,
  Users,
  Wifi,
  X,
} from "lucide-react";
import type { Accent, MotionLevel, RoleKey, ScreenKey, ThemeMode } from "../../data/design";
import { RoleScreenRenderer } from "./RoleScreens";
import { DraftsScreen, MenuScreen, ShelfReturnScreen, TabelDetailScreen, TabelScreen, WarehouseScreen } from "./DetailedScreens";
import { AuthScreen } from "./AuthScreen";
import { SyncScreen } from "./SyncScreen";
import { BonusesScreen, MapScreen, OrderDetailScreen, OrdersScreen, ReportScreen, RoutePlanScreen } from "./ExtraScreens";
import { ClientDetailScreen, KpiCalcScreen, NewClientScreen, SearchScreen } from "./AuditScreens";
import {
  DebtorsByOrdersScreen, ExpInvoicesScreen, ExpPayInfoScreen, ExpVisitsScreen, PermissionsScreen,
  StartVisitScreen, SupOutletsScreen, SupReportScreen, SyncSuccessScreen, TaskCreateScreen, TaskDetailScreen,
} from "./AuditScreens2";
import { RoleWelcome } from "./RoleWelcome";
import { FullOrderScreen } from "./OrderFlow";
import HomeDashboard from "./HomeDashboard";
import { cn } from "../../utils/cn";

export type Tokens = {
  bg: string;
  card: string;
  card2: string;
  ink: string;
  sub: string;
  line: string;
  acc: string;
  accSoft: string;
  accInk: string;
  accOn: string;
  accText: string;
  head: string;
  isDark: boolean;
};

export function buildTokens(theme: ThemeMode, accent: Accent): Tokens {
  const isDark = theme === "dark";
  return {
    bg: isDark ? "#0A0D14" : "#F3F5F9",
    card: isDark ? "#131824" : "#FFFFFF",
    card2: isDark ? "#1B2231" : "#F4F6FA",
    ink: isDark ? "#EEF2F8" : "#0E1420",
    sub: isDark ? "#98A4B8" : "#677386",
    line: isDark ? "rgba(255,255,255,0.09)" : "#E4E8EF",
    acc: accent.hex,
    accSoft: isDark ? `${accent.hex}2E` : accent.soft,
    accInk: isDark ? accent.soft : accent.ink,
    accOn: accent.onAccent,
    accText: isDark ? accent.bright : accent.ink,
    head: isDark ? "#0A0D14" : "#FFFFFF",
    isDark,
  };
}

export type PhoneCtx = {
  motion: MotionLevel;
  effects: boolean;
  role: RoleKey;
  setRole?: (role: RoleKey) => void;
  go: (screen: ScreenKey) => void;
  toast: (msg: string) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  cart: Record<string, number>;
  setQty: (id: string, delta: number) => void;
  clearCart: () => void;
};

export type Props = { t: Tokens; accent: Accent; ctx: PhoneCtx };

export const anim = (ctx: PhoneCtx, i: number): { className: string; style: CSSProperties } =>
  ctx.motion === "off"
    ? { className: "", style: {} }
    : { className: "stagger-item", style: { "--stagger": `${i * 55}ms` } as CSSProperties };

export const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n).replace(/,/g, " ");

/* ------------------------------------------------------------------ */
/*  Shared primitives                                                  */
/* ------------------------------------------------------------------ */

export function IconBtn({
  t,
  children,
  onClick,
  dot,
  active,
}: {
  t: Tokens;
  children: ReactNode;
  onClick?: () => void;
  dot?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid size-8 place-items-center rounded-xl transition active:scale-90"
      style={{
        background: active ? t.accSoft : t.isDark ? "rgba(255,255,255,0.06)" : "#F3F7F6",
        color: active ? t.accInk : t.ink,
        border: `1px solid ${t.line}`,
      }}
    >
      {children}
      {dot && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-coral ring-2" style={{ boxShadow: `0 0 0 2px ${t.card}` }} />}
    </button>
  );
}

export function ScreenHead({
  t,
  title,
  sub,
  onBack,
  right,
}: {
  t: Tokens;
  title: string;
  sub?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="grid size-7 place-items-center rounded-lg transition active:scale-90"
            style={{ background: t.card2, color: t.ink }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div>
          <h3 className="text-[17px] font-bold leading-tight tracking-[-0.03em]" style={{ color: t.ink }}>
            {title}
          </h3>
          {sub && <p className="mt-0.5 text-[9.5px] font-medium" style={{ color: t.sub }}>{sub}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">{right}</div>
    </div>
  );
}

export function Chip({ t, accent, active, children, onClick }: { t: Tokens; accent: Accent; active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-semibold transition active:scale-95"
      style={{
        background: active ? accent.hex : t.card,
        color: active ? "#fff" : t.sub,
        border: `1px solid ${active ? accent.hex : t.line}`,
      }}
    >
      {children}
    </button>
  );
}

export function LiveClock({ start = 297, pill = false, accent, color }: { start?: number; pill?: boolean; accent: Accent; color?: string }) {
  const [sec, setSec] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setSec((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-mono font-semibold tabular-nums", pill && "rounded-full px-2 py-1")}
      style={pill ? { background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 11 } : { color: color ?? accent.bright }}
    >
      <Clock3 size={pill ? 11 : 12} /> {m}:{s}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  HOME                                                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  VISITS                                                             */
/* ------------------------------------------------------------------ */

export function VisitsScreen({ t, accent, ctx }: Props) {
  const [filter, setFilter] = useState(0);
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="Vizitlar"
          sub="Bugun · 12 ta reja"
          right={
            <>
              <IconBtn t={t} active onClick={() => ctx.toast("Saralash: vaqt bo'yicha")}>
                <MoreHorizontal size={14} />
              </IconBtn>
              <IconBtn t={t} onClick={() => ctx.go("notifications")} dot>
                <Bell size={14} />
              </IconBtn>
            </>
          }
        />
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["Bugun · 12", "Hafta · 54", "Qarzdor · 6", "Barchasi"].map((f, i) => (
            <Chip key={f} t={t} accent={accent} active={filter === i} onClick={() => setFilter(i)}>
              {f}
            </Chip>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-3">
        <div
          className={cn("rounded-[18px] p-3", anim(ctx, 1).className)}
          style={{ background: t.card, border: `1px solid ${t.line}`, boxShadow: t.isDark ? "none" : "0 10px 24px -20px rgba(8,32,28,.4)" }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em]" style={{ background: t.accSoft, color: t.accInk }}>
              <span className="live-dot size-1.5 rounded-full" style={{ background: accent.hex, color: t.accText }} /> Faol vizit
            </span>
            <LiveClock start={297} accent={accent} color={t.accText} />
          </div>
          <p className="mt-2 text-[13px] font-bold tracking-[-0.02em]" style={{ color: t.ink }}>MCHJ O'zbekiston Gullari</p>
          <p className="mt-0.5 flex items-center gap-1 text-[9px]" style={{ color: t.sub }}>
            <MapPin size={9} /> TT-0847 · Yunusobod 4-kv, 21-uy
          </p>

          <div className="mt-3 flex items-center gap-1">
            {["Kirish", "Foto", "Zakaz", "Yakun"].map((s, i) => (
              <div key={s} className="flex flex-1 flex-col gap-1">
                <div className="h-[3px] rounded-full" style={{ background: i < 3 ? accent.hex : t.isDark ? "rgba(255,255,255,.1)" : "#E8EFEC" }} />
                <span className="text-[7.5px] font-semibold" style={{ color: i < 3 ? accent.hex : t.sub }}>{s}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              { icon: <ImageIcon size={12} />, label: "Foto", action: () => ctx.toast("Foto hisobot ochildi") },
              { icon: <ShoppingBag size={12} />, label: "Buyurtma", action: () => ctx.go("order") },
              { icon: <X size={12} />, label: "Rad etish", action: () => setEnding(true) },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.action}
                className="flex items-center justify-center gap-1 rounded-[9px] py-2 text-[9px] font-semibold active:scale-95"
                style={{ background: t.card2, color: t.ink }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setEnding(true); ctx.toast("Yakunlash oynasi tayyor"); }}
            className="mt-1.5 w-full rounded-[10px] py-2.5 text-[10.5px] font-bold on-acc transition active:scale-[0.99]"
            style={{ background: accent.hex }}
          >
            Vizitni yakunlash
          </button>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Keyingi vizitlar</p>
            <span className="font-mono text-[8px]" style={{ color: t.sub }}>8 ta qoldi</span>
          </div>
          <div className="space-y-1.5">
            {[
              { name: "IP Karmorov Store", time: "11:20", tag: "Bajarildi", tone: "#22b573", debt: "0 so'm" },
              { name: "OOO Navruz Shop", time: "14:00", tag: "Kutilmoqda", tone: "#e0a023", debt: "-480 000" },
              { name: "MCHJ Lalaku Savdo", time: "16:30", tag: "Kutilmoqda", tone: "#e0a023", debt: "-120 000" },
            ].map((c, i) => (
              <button
                key={c.name}
                type="button"
                onClick={() => ctx.go("start-visit")}
                {...anim(ctx, i + 2)}
                className={cn("flex w-full items-center gap-2.5 rounded-[13px] p-2.5 text-left active:scale-[0.99]", anim(ctx, i + 2).className)}
                style={{ background: t.card, border: `1px solid ${t.line}` }}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[10px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>
                  {c.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] font-semibold" style={{ color: t.ink }}>{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[8.5px]" style={{ color: t.sub }}>
                    <Clock3 size={8} /> {c.time}
                    <span style={{ color: c.debt === "0 so'm" ? "#22b573" : "#e0574b" }}>{c.debt}</span>
                  </span>
                </span>
                <span className="rounded-full px-1.5 py-[3px] text-[7px] font-bold" style={{ background: `${c.tone}18`, color: c.tone }}>{c.tag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {ending && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={() => setEnding(false)}>
          <div className={cn("w-full rounded-t-[24px] p-4", ctx.motion !== "off" && "pop-in")} style={{ background: t.card }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: t.line }} />
            <p className="text-[14px] font-bold" style={{ color: t.ink }}>{reason ? "Rad etish sababi" : "Vizitni yakunlaysizmi?"}</p>
            <p className="mt-1 text-[9.5px]" style={{ color: t.sub }}>
              {reason ? "Sabab mijoz kartasiga saqlanadi." : "Yakunlashdan oldin barcha qadamlar tekshiriladi."}
            </p>
            <div className="mt-3 space-y-1">
              {reason
                ? ["Nest deneg", "Zakryt", "Uje zakupilsya", "Boshqa sabab"].map((r) => (
                    <button key={r} type="button" onClick={() => { ctx.toast(`Sabab: ${r}`); setReason(r); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[10px] font-medium" style={{ background: t.card2, color: t.ink }}>
                      {r} <ChevronRight size={12} />
                    </button>
                  ))
                : (
                  <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: t.accSoft }}>
                    <span className="grid size-7 place-items-center rounded-full" style={{ background: accent.hex, color: accent.onAccent }}><Check size={13} /></span>
                    <span className="text-[9.5px] font-medium" style={{ color: t.accInk }}>3 qadam bajarildi · foto 3 ta</span>
                  </div>
                )}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setEnding(false)} className="flex-1 rounded-xl py-2.5 text-[10.5px] font-semibold" style={{ background: t.card2, color: t.ink }}>
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => { setEnding(false); ctx.go("home"); ctx.toast("Vizit muvaffaqiyatli yakunlandi"); }}
                className="flex-[1.3] rounded-xl py-2.5 text-[10.5px] font-bold on-acc active:scale-[0.99]"
                style={{ background: accent.hex }}
              >
                {reason ? "Saqlash" : "Ha, yakunlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CLIENTS                                                            */
/* ------------------------------------------------------------------ */

export function ClientsScreen({ t, accent, ctx }: Props) {
  const [filter, setFilter] = useState(0);
  const [q, setQ] = useState("");
  const base = [
    { name: "MCHJ O'zbekiston Gullari", code: "TT-0847", debt: -1240000, tier: "A", addr: "Yunusobod 4-kv, 21" },
    { name: "IP Karmorov Store", code: "TT-0921", debt: 0, tier: "B", addr: "Chilonzor 9-kv, 4" },
    { name: "OOO Navruz Shop", code: "TT-1033", debt: -480000, tier: "A", addr: "Mirzo Ulug'bek, 7" },
    { name: "MCHJ Lalaku Savdo", code: "TT-1102", debt: -120000, tier: "B", addr: "Uchtepa, 12" },
    { name: "IP Baraka Market", code: "TT-1188", debt: 0, tier: "C", addr: "Olmazor, 5" },
  ];
  const list = base
    .filter((c) => (filter === 1 ? c.debt < 0 : filter === 2 ? c.tier === "A" : filter === 3 ? c.code >= "TT-1102" : true))
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="Mijozlar"
          sub="342 ta mijoz · 6 ta qarzdor"
          right={<><IconBtn t={t} onClick={() => ctx.go("search")}><Search size={13} /></IconBtn><IconBtn t={t} onClick={() => ctx.go("new-client")}><Plus size={15} /></IconBtn></>}
        />
        <div className="flex items-center gap-1.5 rounded-[11px] px-2.5 py-2" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <Search size={13} style={{ color: t.sub }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mijoz yoki kod bo'yicha qidirish…"
            className="w-full bg-transparent text-[10px] font-medium outline-none placeholder:font-normal"
            style={{ color: t.ink }}
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} style={{ color: t.sub }}><X size={12} /></button>
          ) : (
            <span className="rounded bg-black/5 px-1 font-mono text-[7.5px]" style={{ background: t.card2, color: t.sub }}>⌘K</span>
          )}
        </div>
        <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[`Barchasi · ${base.length}`, `Qarzdor · ${base.filter((c) => c.debt < 0).length}`, "A toifa", "Yangi"].map((f, i) => (
            <Chip key={f} t={t} accent={accent} active={filter === i} onClick={() => setFilter(i)}>
              {f}
            </Chip>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-16 pt-2.5">
        {list.map((c, i) => (
          <button
            key={c.code}
            type="button"
            onClick={() => ctx.go("client-detail")}
            {...anim(ctx, i)}
            className={cn("flex w-full items-center gap-2.5 rounded-[14px] p-2.5 text-left transition active:scale-[0.99]", anim(ctx, i).className)}
            style={{ background: t.card, border: `1px solid ${t.line}` }}
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-[11px] text-[11px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>
              {c.name.replace("MCHJ ", "").replace("IP ", "").replace("OOO ", "").slice(0, 1)}
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-[7px] font-bold on-acc" style={{ background: accent.hex }}>{c.tier}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[10.5px] font-semibold" style={{ color: t.ink }}>{c.name}</span>
                {c.debt < 0 && <span className="shrink-0 rounded px-1 py-[1px] text-[6.5px] font-bold uppercase" style={{ background: "#FDE8E6", color: "#d1453a" }}>Qarz</span>}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[8.5px]" style={{ color: t.sub }}>
                {c.code} · {c.addr}
              </span>
              <span className="mt-0.5 block text-[9px] font-bold" style={{ color: c.debt < 0 ? "#e0574b" : "#22a06b" }}>
                {c.debt < 0 ? `−${fmt(Math.abs(c.debt))} so'm` : "Qarz yo'q"}
              </span>
            </span>
            <ChevronRight size={13} style={{ color: t.sub }} />
          </button>
        ))}
        {!list.length && (
          <div className="grid place-items-center py-10 text-center">
            <Search size={22} style={{ color: t.sub }} />
            <p className="mt-2 text-[10px] font-semibold" style={{ color: t.ink }}>Topilmadi</p>
            <p className="text-[9px]" style={{ color: t.sub }}>Boshqa kalit so'z bilan urinib ko'ring</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => ctx.go("new-client")}
        className="absolute bottom-20 right-4 grid size-11 place-items-center rounded-full on-acc shadow-lg transition active:scale-90"
        style={{ background: accent.gradient, boxShadow: `0 12px 24px -8px ${accent.hex}` }}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ORDER                                                              */
/* ------------------------------------------------------------------ */

const PRODUCTS = [
  { id: "p1", name: "Coca-Cola 1.5L", emoji: "🥤", price: 12000, stock: 48, cat: "Ichimlik" },
  { id: "p2", name: "Lay's Classic 80g", emoji: "🍟", price: 9500, stock: 32, cat: "Snek" },
  { id: "p3", name: "Snickers 50g", emoji: "🍫", price: 6000, stock: 120, cat: "Shirinlik" },
  { id: "p4", name: "Nescafé Gold 100g", emoji: "☕", price: 42000, stock: 14, cat: "Kofe" },
  { id: "p5", name: "Fanta 1.5L", emoji: "🍊", price: 12000, stock: 36, cat: "Ichimlik" },
];

export function OrderScreen({ t, accent, ctx }: Props) {
  const [step, setStep] = useState(0);
  const total = PRODUCTS.reduce((sum, p) => sum + (ctx.cart[p.id] || 0) * p.price, 0);
  const count = Object.values(ctx.cart).reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="Yangi buyurtma"
          sub="Qadam 2 / 3 · Katalog"
          onBack={() => { if (step > 0) setStep(step - 1); else ctx.go("home"); }}
          right={
            <span className="flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[8.5px] font-semibold" style={{ background: t.accSoft, color: t.accInk }}>
              <ShoppingBag size={10} /> {count}
            </span>
          }
        />

        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((s) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <span className="grid size-4 place-items-center rounded-full text-[7.5px] font-bold" style={{ background: s <= step ? accent.hex : t.card2, color: s <= step ? "#fff" : t.sub }}>
                {s < step ? <Check size={8} strokeWidth={4} /> : s + 1}
              </span>
              <span className="h-[3px] flex-1 rounded-full" style={{ background: s < step ? accent.hex : t.card2 }} />
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-[11px] p-2" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <span className="grid size-7 place-items-center rounded-lg text-[9px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>OG</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>MCHJ O'zbekiston Gullari</p>
            <p className="text-[8px]" style={{ color: t.sub }}>TT-0847 · Qarz −1 240 000 so'm</p>
          </div>
          <button type="button" onClick={() => setStep(0)} className="text-[8px] font-semibold" style={{ color: t.accText }}>O'zgartirish</button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-3 pt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold" style={{ color: t.ink }}>Katalog</p>
          <span className="text-[8px] font-medium" style={{ color: t.sub }}>5 ta mahsulot</span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {PRODUCTS.map((p, i) => {
            const qty = ctx.cart[p.id] || 0;
            return (
              <div
                key={p.id}
                {...anim(ctx, i)}
                className={cn("overflow-hidden rounded-[13px] p-2 transition", anim(ctx, i).className)}
                style={{ background: t.card, border: `1px solid ${qty ? accent.hex : t.line}` }}
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-8 place-items-center rounded-lg text-[16px]" style={{ background: t.card2 }}>{p.emoji}</span>
                  <span className="rounded px-1 py-0.5 font-mono text-[6.5px] font-semibold" style={{ background: t.card2, color: t.sub }}>{p.stock} dona</span>
                </div>
                <p className="mt-1.5 truncate text-[9.5px] font-semibold" style={{ color: t.ink }}>{p.name}</p>
                <p className="text-[7.5px]" style={{ color: t.sub }}>{p.cat}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold" style={{ color: t.ink }}>{fmt(p.price)}</span>
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => ctx.setQty(p.id, 1)}
                      aria-label={`${p.name} qo'shish`}
                      className="grid size-6 place-items-center rounded-full on-acc active:scale-90"
                      style={{ background: accent.hex }}
                    >
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full p-0.5" style={{ background: t.accSoft }}>
                      <button type="button" onClick={() => ctx.setQty(p.id, -1)} aria-label="kamaytirish" className="grid size-5 place-items-center rounded-full" style={{ background: t.card, color: t.accInk }}>
                        <Minus size={10} strokeWidth={3} />
                      </button>
                      <span className="font-mono text-[9px] font-bold" style={{ color: t.accInk }}>{qty}</span>
                      <button type="button" onClick={() => ctx.setQty(p.id, 1)} aria-label="ko'paytirish" className="grid size-5 place-items-center rounded-full" style={{ background: accent.hex, color: accent.onAccent }}>
                        <Plus size={10} strokeWidth={3} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-[11px] p-2.5" style={{ background: t.isDark ? "#2a2412" : "#FEF9E7", border: "1px solid #EFD9A0" }}>
          <span className="grid size-6 place-items-center rounded-full bg-[#E9B949]/20 text-[#b07d0a]"><Gift size={12} /></span>
          <div className="flex-1">
            <p className="text-[8.5px] font-bold" style={{ color: t.isDark ? "#F3D98B" : "#8a6300" }}>Bonus zinapoyasi</p>
            <p className="text-[7.5px]" style={{ color: t.isDark ? "#d6bd77" : "#a6822a" }}>
              {total >= 200000 ? "5% bonus faollashdi 🎉" : `${fmt(200000 - total)} so'm qoldi → 5% bonus`}
            </p>
          </div>
          <div className="h-1 w-10 overflow-hidden rounded-full" style={{ background: "rgba(176,125,10,0.2)" }}>
            <div className="h-full rounded-full bg-[#c99a19] transition-all duration-500" style={{ width: `${Math.min(100, (total / 200000) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="border-t px-4 pb-2 pt-2.5" style={{ borderColor: t.line, background: t.card }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[8px] font-medium" style={{ color: t.sub }}>Jami · {count} dona</p>
            <p className="font-display text-[16px] font-bold leading-tight tracking-[-0.02em]" style={{ color: t.ink }}>
              {fmt(total)} <span className="text-[9px] font-medium" style={{ color: t.sub }}>so'm</span>
            </p>
          </div>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => { ctx.toast(`Buyurtma yuborildi · ${fmt(total)} so'm`); ctx.clearCart(); ctx.go("home"); }}
            className="rounded-[10px] px-3.5 py-2.5 text-[10px] font-bold on-acc transition active:scale-95 disabled:opacity-40"
            style={{ background: accent.hex, boxShadow: count ? `0 8px 20px -8px ${accent.hex}` : "none" }}
          >
            Buyurtma berish
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI                                                                */
/* ------------------------------------------------------------------ */

export function KpiScreen({ t, accent, ctx }: Props) {
  const [range, setRange] = useState(0);
  const series = range === 0 ? [40, 62, 48, 78, 68, 92, 74] : [52, 68, 61, 84, 73, 96, 88];
  const labels = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
  const plan = 34200000;
  const fact = 21800000;
  const pct = 64;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="KPI paneli"
          sub="Iyul 2026 · Yangilandi 12:48"
          right={<><IconBtn t={t} onClick={() => ctx.go("kpi-calc")}><Target size={13} /></IconBtn><IconBtn t={t} onClick={() => ctx.go("report")}><ArrowUpRight size={14} /></IconBtn></>}
        />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-1">
        <div className={cn("relative overflow-hidden rounded-[18px] p-3.5 text-white", anim(ctx, 1).className)} style={{ background: `linear-gradient(140deg, ${accent.ink} 0%, #070A12 72%)` }}>
          <div className="absolute -right-8 -top-10 size-28 rounded-full" style={{ background: `${accent.hex}55`, filter: "blur(18px)" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/50">Oylik reja bajarilishi</p>
              <p className="mt-1 font-display text-[24px] font-bold leading-none tracking-[-0.04em]">64<span className="text-[12px] text-lime">%</span></p>
              <p className="mt-1 font-mono text-[8px] text-white/55">{fmt(fact)} / {fmt(plan)} so'm</p>
            </div>
            <div className="relative size-[64px]">
              <svg viewBox="0 0 44 44" className="-rotate-90">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="4" />
                <circle
                  cx="22" cy="22" r="18" fill="none" stroke="#C8F56A" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 113} 113`}
                  style={{ transition: "stroke-dasharray 1s cubic-bezier(.16,1,.3,1)" }}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center font-mono text-[9px] font-bold">64%</span>
            </div>
          </div>
          <div className="relative mt-3 flex items-center gap-1.5 rounded-lg bg-white/8 px-2 py-1.5">
            <Flame size={11} className="text-[#FFB84D]" />
            <span className="text-[8px] font-medium text-white/70">Kunlik seriya: <b className="text-white">12 kun</b></span>
            <span className="ml-auto rounded bg-lime/20 px-1.5 py-0.5 text-[7px] font-bold uppercase text-lime">Top 3</span>
          </div>
        </div>

        <div className={cn("rounded-[16px] p-3", anim(ctx, 2).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Savdo dinamikasi</p>
            <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: t.card2 }}>
              {["Hafta", "Oy"].map((r, i) => (
                <button key={r} type="button" onClick={() => setRange(i)} className="rounded-md px-2 py-1 text-[7.5px] font-semibold transition" style={{ background: range === i ? t.card : "transparent", color: range === i ? t.ink : t.sub, boxShadow: range === i ? "0 1px 4px rgba(0,0,0,.08)" : "none" }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex h-[78px] items-end gap-2">
            {series.map((v, i) => (
              <div key={labels[i]} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-full w-full items-end">
                  <div
                    className="bar-grow w-full rounded-t-[4px] transition-all duration-500"
                    style={{
                      height: `${v}%`,
                      background: i === 5 ? "#C8F56A" : i === 4 ? accent.hex : `${accent.hex}40`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
                <span className="text-[7px] font-medium" style={{ color: i === 5 ? accent.hex : t.sub }}>{labels[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cn("rounded-[16px] p-3", anim(ctx, 3).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold" style={{ color: t.ink }}>Bonus zinapoyasi</p>
            <Gift size={12} style={{ color: t.accText }} />
          </div>
          <div className="mt-2 space-y-2">
            {[
              { label: "20 mln so'm", bonus: "3%", done: true, fill: 100 },
              { label: "30 mln so'm", bonus: "5%", done: false, fill: 64 },
              { label: "40 mln so'm", bonus: "8%", done: false, fill: 32 },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full" style={{ background: b.done ? `${accent.hex}1F` : t.card2, color: b.done ? accent.hex : t.sub }}>
                  {b.done ? <Check size={10} strokeWidth={3} /> : <Lock size={9} />}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-[8.5px] font-semibold" style={{ color: t.ink }}>{b.label}</span>
                    <span className="font-mono text-[8px] font-bold" style={{ color: b.done ? accent.hex : t.sub }}>{b.bonus}</span>
                  </div>
                  <div className="mt-1 h-[3px] overflow-hidden rounded-full" style={{ background: t.card2 }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.fill}%`, background: b.done ? accent.hex : `${accent.hex}88` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cn("flex items-center gap-2.5 rounded-[16px] p-3", anim(ctx, 4).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="grid size-9 place-items-center rounded-xl bg-[#FEF3D7] text-[#b07d0a]"><Trophy size={16} /></div>
          <div className="flex-1">
            <p className="text-[9.5px] font-bold" style={{ color: t.ink }}>Hudud reytingi</p>
            <p className="text-[8px]" style={{ color: t.sub }}>Toshkent · 18 agent ichida</p>
          </div>
          <span className="font-display text-[16px] font-bold" style={{ color: t.accText }}>#3</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NOTIFICATIONS                                                      */
/* ------------------------------------------------------------------ */

export function NotificationsScreen({ t, accent, ctx }: Props) {
  const [read, setRead] = useState<number[]>([]);
  const items = [
    { icon: <Gift size={14} />, title: "Yangi bonus zinapoyasi", text: "30 mln so'mga 5% bonus. 8.2 mln qoldi!", time: "2 daq", tone: accent.hex },
    { icon: <Wifi size={14} />, title: "Sinxronlash yakunlandi", text: "12 buyurtma, 8 foto hisobot yuborildi.", time: "14 daq", tone: "#22a06b" },
    { icon: <MessageSquare size={14} />, title: "Supervayzer izohi", text: "Navruz Shop vizitida foto qo'shing.", time: "1 soat", tone: "#e0a023" },
    { icon: <Bell size={14} />, title: "Yangi marshrut tayyor", text: "Ertangi kun uchun 11 vizit rejalashtirildi.", time: "3 soat", tone: "#2f7df6" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead
          t={t}
          title="Bildirishnomalar"
          onBack={() => ctx.go("home")}
          sub={`${items.length - read.length} ta o'qilmagan`}
          right={<button type="button" onClick={() => { setRead(items.map((_, i) => i)); ctx.toast("Barchasi o'qilgan deb belgilandi"); }} className="flex items-center gap-1 text-[8.5px] font-semibold" style={{ color: t.accText }}><CheckCheck size={12} /> O'qildi</button>}
        />
      </div>
      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-4 pb-3 pt-1">
        {items.map((n, i) => {
          const isRead = read.includes(i);
          return (
            <button
              key={n.title}
              type="button"
              onClick={() => { setRead((r) => (r.includes(i) ? r : [...r, i])); ctx.toast(`${n.title} o'qildi`); }}
              {...anim(ctx, i)}
              className={cn("relative flex w-full items-start gap-2.5 rounded-[14px] p-2.5 text-left transition active:scale-[0.99]", anim(ctx, i).className)}
              style={{ background: isRead ? t.card : t.isDark ? `${accent.hex}1A` : "#FFFFFF", border: `1px solid ${isRead ? t.line : `${accent.hex}40`}` }}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" style={{ background: `${n.tone}1A`, color: n.tone }}>{n.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[10px] font-bold" style={{ color: t.ink }}>{n.title}</span>
                  {!isRead && <span className="size-1.5 shrink-0 rounded-full" style={{ background: accent.hex }} />}
                </span>
                <span className="mt-0.5 block text-[8.5px] leading-snug" style={{ color: t.sub }}>{n.text}</span>
                <span className="mt-1 block font-mono text-[7.5px]" style={{ color: t.sub }}>{n.time} oldin</span>
              </span>
            </button>
          );
        })}
        <div className="rounded-[14px] p-2.5" style={{ background: t.card2, border: `1px solid ${t.line}` }}>
          <p className="text-[9px] font-bold" style={{ color: t.ink }}>Sozlamalar</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[8.5px]" style={{ color: t.sub }}><Bell size={11} /> Push bildirishnomalar</span>
            <span className="relative h-4 w-7 rounded-full" style={{ background: accent.hex }}>
              <span className="absolute right-0.5 top-0.5 size-3 rounded-full bg-white" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LOGIN                                                              */
/* ------------------------------------------------------------------ */

export function LoginScreen({ accent, ctx }: Props) {
  const [pin, setPin] = useState("");
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        ctx.toast("Xush kelibsiz, Aziz!");
        ctx.go("home");
        setPin("");
      }, 420);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden text-white" style={{ background: "linear-gradient(165deg,#1B1F3A 0%,#0C0F1E 55%,#06070D 100%)" }}>
      <div className="absolute -right-16 -top-16 size-56 rounded-full" style={{ background: `${accent.hex}66`, filter: "blur(45px)" }} />
      <div className="absolute -bottom-24 -left-16 size-56 rounded-full" style={{ background: "#C8F56A33", filter: "blur(50px)" }} />
      <div className="dot-grid-dark absolute inset-0 opacity-40" />
      <div className="relative flex flex-1 flex-col px-5 pt-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-white/70">
            <span className="live-dot size-1.5 rounded-full bg-lime text-lime" /> offline-first
          </span>
          <span className="flex items-center gap-1 font-mono text-[8px] text-white/40"><Wifi size={10} /> Sync 12:48</span>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <div className="relative grid size-16 place-items-center rounded-[22px] bg-gradient-to-br from-[#12b3a4] to-[#075c56] shadow-[0_20px_40px_-16px_rgba(12,179,164,.7)]">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z" stroke="#C8F56A" strokeWidth="1.5" /><path d="M12 7.5 16.5 12 12 16.5 7.5 12 12 7.5Z" fill="#EAF8F5" /></svg>
            <span className="absolute -right-1 -top-1 size-4 rounded-full border border-white/20 bg-lime" />
          </div>
          <h2 className="mt-4 font-display text-[20px] font-bold tracking-[-0.03em]">Xush kelibsiz</h2>
          <p className="mt-1 text-[9.5px] text-white/50">PIN kodni kiriting yoki biometrikadan foydalaning</p>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="grid size-10 place-items-center rounded-xl border transition-all duration-300" style={{ borderColor: pin.length === i ? "rgba(200,245,106,.6)" : "rgba(255,255,255,.16)", background: "rgba(255,255,255,.05)" }}>
              {pin.length > i && <span className="size-2.5 rounded-full bg-lime" />}
            </span>
          ))}
        </div>

        <div className="mx-auto mt-5 grid w-full max-w-[205px] grid-cols-3 gap-x-3 gap-y-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} className="rounded-xl py-2 font-display text-[16px] font-semibold text-white/90 transition active:scale-90" style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.06)" }}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => ctx.toast("Biometrika tayyorlanmoqda")} className="grid place-items-center rounded-xl py-2 text-lime/80 transition active:scale-90" style={{ background: "rgba(200,245,106,.08)" }}>
            <Fingerprint size={17} />
          </button>
          <button type="button" onClick={() => press("0")} className="rounded-xl py-2 font-display text-[16px] font-semibold text-white/90 transition active:scale-90" style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.06)" }}>0</button>
          <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} className="grid place-items-center rounded-xl py-2 text-white/60 transition active:scale-90">
            <Delete size={16} />
          </button>
        </div>

        <div className="mt-auto pb-3">
          <div className="flex items-center gap-2 rounded-[12px] border border-white/10 bg-white/5 p-2.5">
            <span className="grid size-6 place-items-center rounded-full bg-lime/15 text-lime"><Check size={12} strokeWidth={3} /></span>
            <div className="flex-1">
              <p className="text-[8.5px] font-semibold text-white/85">Oflayn rejim tayyor</p>
              <p className="text-[7.5px] text-white/40">342 mijoz · 1 208 mahsulot keshlangan</p>
            </div>
            <Wifi size={12} className="text-lime/70" />
          </div>
          <p className="mt-2 text-center font-mono text-[7px] text-white/25">SALES ARENA · v3.2.8 · xavfsiz ulanish</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PROFILE                                                            */
/* ------------------------------------------------------------------ */

export function ProfileScreen({ t, accent, ctx }: Props) {
  const [sync, setSync] = useState(true);
  const [push, setPush] = useState(true);
  const rows = [
    { icon: <Wifi size={13} />, label: "Avtomatik sinxronlash", toggle: true },
    { icon: <Bell size={13} />, label: "Push bildirishnomalar", toggle: true },
    { icon: <Globe size={13} />, label: "Til", value: "O'zbekcha" },
    { icon: <ShieldCheck size={13} />, label: "Ruxsatlar va PIN", value: "Boshqarish", go: "permissions" as ScreenKey },
    { icon: <ShoppingBag size={13} />, label: "Buyurtma shabloni", value: "Standart" },
    { icon: <MessageSquare size={13} />, label: "Yordam markazi", value: "24/7" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenHead t={t} title="Profil" sub="Agent · Toshkent sh." right={<IconBtn t={t} onClick={() => ctx.toast("Sozlamalar saqlandi")}><MoreHorizontal size={14} /></IconBtn>} />
      </div>
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
        <div className={cn("relative overflow-hidden rounded-[18px] p-3.5", anim(ctx, 1).className)} style={{ background: accent.gradient }}>
          <div className="absolute -right-4 -top-6 size-20 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2.5">
            <div className="grid size-11 place-items-center rounded-full border-2 border-white/40 bg-white/20 font-display text-[13px] font-bold on-acc">AQ</div>
            <div className="flex-1 on-acc">
              <p className="text-[12px] font-bold tracking-[-0.02em]">Aziz Qodirov</p>
              <p className="text-[8.5px] on-acc-70">Agent · TT-0847 · Toshkent</p>
              <div className="mt-1 flex items-center gap-1">
                <span className="rounded bg-white/20 px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wider">⭐ Top 3</span>
                <span className="rounded bg-white/20 px-1.5 py-[1px] text-[7px] font-bold uppercase tracking-wider">A toifa</span>
              </div>
            </div>
            <button type="button" onClick={() => ctx.toast("Profil tahrirlash")} className="grid size-7 place-items-center rounded-full bg-white/20 on-acc"><ChevronRight size={14} /></button>
          </div>
          <div className="relative mt-3 grid grid-cols-3 gap-1.5">
            {[["342", "Mijoz"], ["18.4", "mln fakt"], ["64%", "KPI"]].map(([v, l]) => (
              <div key={l} className="rounded-lg bg-white/12 p-1.5 text-center">
                <p className="font-mono text-[10px] font-bold on-acc">{v}</p>
                <p className="text-[7px] on-acc-60">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={cn("rounded-[16px] overflow-hidden", anim(ctx, 2).className)} style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center justify-between p-3" style={{ borderBottom: `1px solid ${t.line}` }}>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg" style={{ background: t.accSoft, color: t.accInk }}>
                {t.isDark ? <Moon size={13} /> : <Sun size={13} />}
              </span>
              <div>
                <p className="text-[9.5px] font-semibold" style={{ color: t.ink }}>Tungi rejim</p>
                <p className="text-[7.5px]" style={{ color: t.sub }}>Ko'zni charchatmaydigan palitra</p>
              </div>
            </div>
            <button type="button" onClick={ctx.toggleTheme} aria-label="Tema almashtirish" className="relative h-[18px] w-8 rounded-full transition-colors" style={{ background: t.isDark ? accent.hex : t.card2, border: `1px solid ${t.line}` }}>
              <span className="absolute top-[2px] size-[12px] rounded-full bg-white transition-all duration-300" style={{ left: t.isDark ? 16 : 3, boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </div>
          {rows.map((r, i) => (
            <div key={r.label} onClick={"go" in r && r.go ? () => ctx.go(r.go as ScreenKey) : undefined} className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: i === rows.length - 1 ? "none" : `1px solid ${t.line}`, cursor: "go" in r && r.go ? "pointer" : undefined }}>
              <span className="grid size-6 place-items-center rounded-md" style={{ background: t.card2, color: t.sub }}>{r.icon}</span>
              <span className="flex-1 text-[9.5px] font-medium" style={{ color: t.ink }}>{r.label}</span>
              {r.toggle ? (
                <button
                  type="button"
                  onClick={() => {
                    if (r.label.includes("sinxron")) { setSync(!sync); ctx.toast(`Sinxronlash ${!sync ? "yoqildi" : "o'chirildi"}`); }
                    else { setPush(!push); ctx.toast(`Bildirishnoma ${!push ? "yoqildi" : "o'chirildi"}`); }
                  }}
                  className="relative h-[18px] w-8 rounded-full transition-colors"
                  style={{ background: (r.label.includes("sinxron") ? sync : push) ? accent.hex : t.card2, border: `1px solid ${t.line}` }}
                >
                  <span className="absolute top-[2px] size-[12px] rounded-full bg-white transition-all duration-300" style={{ left: (r.label.includes("sinxron") ? sync : push) ? 16 : 3 }} />
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[8px] font-medium" style={{ color: t.sub }}>{r.value} <ChevronRight size={11} /></span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-[13px] p-2.5" style={{ background: t.card, border: `1px solid ${t.line}` }}>
          <div className="flex items-center gap-1.5">
            <span className="grid size-6 place-items-center rounded-full" style={{ background: t.isDark ? `${accent.hex}30` : "#EAF8F5", color: t.accText }}><Check size={12} strokeWidth={3} /></span>
            <div>
              <p className="text-[8.5px] font-semibold" style={{ color: t.ink }}>Barcha ma'lumot sinxron</p>
              <p className="font-mono text-[7px]" style={{ color: t.sub }}>oxirgi sync 12:48 · 8 foto</p>
            </div>
          </div>
          <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold" style={{ background: `${accent.hex}18`, color: t.accText }}>ONLINE</span>
        </div>

        <button type="button" onClick={() => { ctx.toast("Tizimdan chiqildi"); ctx.go("login"); }} className="flex w-full items-center justify-center gap-1.5 rounded-[12px] border py-2.5 text-[9.5px] font-semibold" style={{ borderColor: "#F3C8C2", background: t.isDark ? "#2A1512" : "#FFF5F3", color: "#e0574b" }}>
          <LogOut size={12} /> Chiqish
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resolver                                                           */
/* ------------------------------------------------------------------ */

export function ScreenRenderer({ screen, ...rest }: Props & { screen: ScreenKey }) {
  switch (screen) {
    case "visits":
      return <VisitsScreen {...rest} />;
    case "clients":
      return <ClientsScreen {...rest} />;
    case "order":
      return <FullOrderScreen {...rest} />;
    case "kpi":
      return <KpiScreen {...rest} />;
    case "notifications":
      return <NotificationsScreen {...rest} />;
    case "login":
      return <AuthScreen {...rest} />;
    case "bootstrap":
      return <RoleWelcome {...rest} />;
    case "sync":
      return <SyncScreen {...rest} />;
    case "orders":
      return <OrdersScreen {...rest} />;
    case "order-detail":
      return <OrderDetailScreen {...rest} />;
    case "bonuses":
      return <BonusesScreen {...rest} />;
    case "report":
      return <ReportScreen {...rest} />;
    case "map":
      return <MapScreen {...rest} />;
    case "route-plan":
      return <RoutePlanScreen {...rest} />;
    case "client-detail":
      return <ClientDetailScreen {...rest} />;
    case "new-client":
      return <NewClientScreen {...rest} />;
    case "search":
      return <SearchScreen {...rest} />;
    case "kpi-calc":
      return <KpiCalcScreen {...rest} />;
    case "debtors-by-orders":
      return <DebtorsByOrdersScreen {...rest} />;
    case "start-visit":
      return <StartVisitScreen {...rest} />;
    case "permissions":
      return <PermissionsScreen {...rest} />;
    case "sync-success":
      return <SyncSuccessScreen {...rest} />;
    case "exp-invoices":
      return <ExpInvoicesScreen {...rest} />;
    case "exp-visits":
      return <ExpVisitsScreen {...rest} />;
    case "exp-pay-info":
      return <ExpPayInfoScreen {...rest} />;
    case "sup-outlets":
      return <SupOutletsScreen {...rest} />;
    case "sup-report":
      return <SupReportScreen {...rest} />;
    case "task-create":
      return <TaskCreateScreen {...rest} />;
    case "task-detail":
      return <TaskDetailScreen {...rest} />;
    case "menu":
      return <MenuScreen {...rest} />;
    case "tabel":
      return <TabelScreen {...rest} />;
    case "tabel-detail":
      return <TabelDetailScreen {...rest} />;
    case "shelf-return":
      return <ShelfReturnScreen {...rest} />;
    case "warehouse":
      return <WarehouseScreen {...rest} />;
    case "drafts":
      return <DraftsScreen {...rest} />;
    case "profile":
      return <ProfileScreen {...rest} />;
    case "home":
      return <HomeDashboard {...rest} />;
    default:
      return <RoleScreenRenderer screen={screen} {...rest} />;
  }
}

export const ScreenGlyphs = { Home, User, MapPin, ShoppingBag, Users };
