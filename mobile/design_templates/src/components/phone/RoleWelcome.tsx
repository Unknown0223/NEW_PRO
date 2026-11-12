import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";
import { roles, type RoleKey } from "../../data/design";
import { cn } from "../../utils/cn";
import { AUTH_ACCOUNTS } from "./AuthScreen";
import { BrandMark, BrandWave, BrandWordmark } from "./Brand";
import type { Props } from "./PhoneScreens";
import { RoadScene, SPLASH_META } from "./SplashArt";

/** What each role's workspace loads on first entry (offline-first cache). */
const BOOT_ITEMS: Record<RoleKey, { label: string; count: string }[]> = {
  agent: [
    { label: "Savdo nuqtalari", count: "342" },
    { label: "Katalog va narxlar", count: "1 208" },
    { label: "Ombor qoldiqlari", count: "3 ombor" },
    { label: "Bonus va skidka", count: "6 qoida" },
    { label: "Kunlik marshrut", count: "12 vizit" },
    { label: "Tabel va KPI", count: "iyul" },
  ],
  expeditor: [
    { label: "Mashina profili", count: "01 A 777" },
    { label: "Nakladnoylar", count: "12 ta" },
    { label: "Yetkazish marshruti", count: "21 km" },
    { label: "Qarz kitobi", count: "48 mijoz" },
    { label: "Qaytarish turlari", count: "3 tur" },
    { label: "Chek printeri", count: "ulandi" },
  ],
  supervisor: [
    { label: "Hudud va jamoa", count: "Sharq" },
    { label: "Agentlar", count: "12 ta" },
    { label: "GPS va geofence", count: "24 soat" },
    { label: "Tasdiq kutmoqda", count: "8 vizit" },
    { label: "Hudud KPI", count: "142 mln" },
    { label: "Yangi mijozlar", count: "2 ta" },
  ],
  cashier: [
    { label: "Kassa sozlamalari", count: "Markaz" },
    { label: "Bank inbox", count: "24 ta" },
    { label: "Buyurtmaga moslash", count: "22 / 24" },
    { label: "Ekspeditor topshirig'i", count: "6 / 6" },
    { label: "Eksport shablonlari", count: "Excel" },
    { label: "Audit jurnali", count: "OK" },
  ],
};

/**
 * Restored first-entry animation from the deployed build:
 * the brand colour that flooded the login drains away and reveals the
 * role's own moving scene, a personal greeting and the workspace warming
 * up — then the vehicle drives off into the app.
 */
export function RoleWelcome({ t, accent, ctx }: Props) {
  const fast = ctx.motion === "off";
  const role = ctx.role;
  const roleDef = roles.find((r) => r.key === role) ?? roles[0];
  const acct = AUTH_ACCOUNTS[role];
  const meta = SPLASH_META[role];
  const items = BOOT_ITEMS[role];

  const [run, setRun] = useState(0);
  const [revealed, setRevealed] = useState(fast);
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const homeRef = useRef(roleDef.homeScreen);
  homeRef.current = roleDef.homeScreen;

  useEffect(() => {
    setStep(0);
    setLeaving(false);
    setRevealed(fast);
    if (fast) return;
    const id = setTimeout(() => setRevealed(true), 1150);
    return () => clearTimeout(id);
  }, [run, fast, role]);

  useEffect(() => {
    if (!revealed || leaving) return;
    if (step >= items.length) {
      const id = setTimeout(() => setLeaving(true), fast ? 60 : 800);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStep((s) => s + 1), fast ? 15 : step === 0 ? 1300 : 430);
    return () => clearTimeout(id);
  }, [revealed, step, leaving, fast, items.length]);

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => ctxRef.current.go(homeRef.current), fast ? 120 : 900);
    return () => clearTimeout(id);
  }, [leaving, fast]);

  const paper = t.isDark ? t.bg : "#FFFFFF";
  const wordColor = t.isDark ? accent.bright : `color-mix(in srgb, ${accent.hex} 55%, ${accent.ink})`;
  const tint = t.isDark ? `linear-gradient(180deg, ${accent.ink}99 0%, ${t.bg} 100%)` : `linear-gradient(180deg, color-mix(in srgb, ${accent.hex} 30%, #fff) 0%, #FFFFFF 100%)`;
  const done = step >= items.length;
  const pct = Math.round((Math.min(step, items.length) / items.length) * 100);
  const first = acct.name.split(" ")[0];

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: paper }} data-welcome-role={role} data-welcome-step={step} data-welcome-leaving={leaving ? "1" : "0"}>
      <div className="relative z-[5] flex items-center justify-between px-4 pt-2.5">
        <span className="flex items-center gap-1.5">
          <BrandMark size={22} radius={130} />
          <BrandWordmark size={13} tone={t.isDark ? "dark" : "light"} />
        </span>
        <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[7.5px] font-bold" style={{ background: t.accSoft, color: t.accInk }}>
          <span className="size-1.5 rounded-full" style={{ background: accent.hex }} /> {roleDef.name}
        </span>
      </div>

      <div className="relative -mt-9 h-[40%] shrink-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: tint }} />
        <div className="relative size-full">
          <RoadScene key={`${role}-${run}`} role={role} accent={accent} dark={t.isDark} motion={ctx.motion} leaving={leaving} />
        </div>
      </div>

      <div className="au-fade px-5 text-center" style={{ opacity: leaving ? 0 : 1, transform: leaving ? "translateY(-8px)" : "none" }}>
        <p className={cn("text-[9.5px]", !fast && "au-in")} style={{ color: t.sub, animationDelay: "1250ms" }}>Xush kelibsiz,</p>
        <p key={`${role}-${run}`} className="mt-0.5 font-display text-[23px] font-bold leading-none tracking-[-0.04em]" style={{ color: t.ink }} aria-label={first}>
          {first.split("").map((ch, i) => (
            <span key={i} aria-hidden className={fast ? undefined : "intro-letter"} style={{ animationDelay: `${1320 + i * 45}ms` }}>{ch}</span>
          ))}
        </p>
        <p className={cn("mt-2", !fast && "au-in")} style={{ animationDelay: "1650ms" }}>
          <BrandWordmark size={12} tone={t.isDark ? "dark" : "light"} suffix={meta.word} suffixColor={wordColor} />
        </p>
        <p className={cn("mx-auto mt-1.5 max-w-[220px] text-[9px] leading-relaxed", !fast && "au-in")} style={{ color: t.sub, animationDelay: "1780ms" }}>{meta.tagline}</p>
      </div>

      <div className="au-fade mx-4 mt-3 rounded-[16px] p-3" style={{ background: t.card, border: `1px solid ${t.line}`, opacity: leaving ? 0 : 1 }}>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[9.5px] font-bold" style={{ color: t.ink }}>
            {done ? <Check size={11} strokeWidth={3.5} style={{ color: t.accText }} /> : <Loader2 size={11} className="animate-spin" style={{ color: t.accText }} />}
            {done ? "Ish joyingiz tayyor" : "Ish joyingiz tayyorlanmoqda"}
          </p>
          <span className="font-mono text-[9px] font-bold tabular-nums" style={{ color: t.accText }}>{pct}%</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: t.card2 }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: accent.hex }} />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {items.map((it, i) => {
            const ok = i < step;
            const now = i === step && revealed && !done;
            return (
              <div key={it.label} className="flex items-center gap-1.5">
                <span className="grid size-[13px] shrink-0 place-items-center rounded-full transition-colors duration-300" style={{ background: ok ? accent.hex : t.card2, color: accent.onAccent, boxShadow: now ? `0 0 0 2.5px ${accent.hex}33` : "none" }}>
                  {ok && <Check size={8} strokeWidth={4} className={fast ? undefined : "sa-tick"} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[8px] font-medium" style={{ color: ok || now ? t.ink : t.sub }}>{it.label}</span>
                <span className="shrink-0 font-mono text-[7px]" style={{ color: ok ? t.accText : t.sub }}>{ok ? it.count : "···"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="au-fade mt-auto flex gap-2 px-4 pb-3 pt-2" style={{ opacity: leaving ? 0 : 1 }}>
        <button type="button" onClick={() => setRun((n) => n + 1)} aria-label="Animatsiyani qayta ko'rish" className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: t.card2, color: t.ink }}><RotateCcw size={14} /></button>
        <button type="button" onClick={() => setLeaving(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] font-bold transition active:scale-[0.985]" style={{ background: accent.gradient, color: accent.onAccent, boxShadow: `0 14px 24px -16px ${accent.hex}` }}>
          {done ? "Boshlash" : "O'tkazib yuborish"} <ArrowRight size={13} />
        </button>
      </div>

      <BrandWave top={revealed ? "100%" : "-160px"} />
      <div className="au-fade pointer-events-none absolute inset-0 z-20 grid place-items-center" style={{ opacity: revealed ? 0 : 1 }}>
        <div className="flex flex-col items-center">
          <BrandMark key={run} size={84} bare draw={!fast} />
          <span className="block"><BrandWordmark size={24} tone="onBrand" /></span>
          <span className="mt-2 text-[9px] text-white/80">{roleDef.name} ish joyi ochilmoqda…</span>
        </div>
      </div>
    </div>
  );
}
