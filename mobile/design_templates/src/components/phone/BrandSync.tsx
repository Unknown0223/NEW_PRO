import { useEffect, useRef, useState } from "react";
import { Check, Database, FileUp, Link2, RotateCcw, ShieldCheck, UserRound, X } from "lucide-react";
import type { Accent, MotionLevel, RoleKey } from "../../data/design";
import { cn } from "../../utils/cn";
import { BRAND, BrandMark, BrandWordmark } from "./Brand";
import { RoadScene } from "./SplashArt";

export type SyncVariant = "identity" | "quick" | "full";
/** Name used by the chrome + frame for whichever animation is running. */
export type MotionVariant = SyncVariant | "welcome";

export const SYNC_META: Record<SyncVariant, { title: string; hint: string; steps: { label: string; kb: string }[] }> = {
  identity: {
    title: "Rol kartasi yangilanmoqda",
    hint: "Profil, rasm va ruxsatlar tekshiriladi",
    steps: [
      { label: "Profil rasmi", kb: "18 KB" },
      { label: "Telefon raqami", kb: "1 yozuv" },
      { label: "Ruxsatlar va GPS", kb: "4 ta" },
      { label: "Sessiya kaliti", kb: "yangi" },
    ],
  },
  quick: {
    title: "Oddiy sinxronlash",
    hint: "Faqat o'zgargan yozuvlar yuboriladi",
    steps: [
      { label: "Farqni topish", kb: "3 yozuv" },
      { label: "Buyurtmalar", kb: "2 ta" },
      { label: "Foto hisobotlar", kb: "1.4 MB" },
      { label: "Tasdiq qabul qilish", kb: "ok" },
    ],
  },
  full: {
    title: "To'liq sinxronlash",
    hint: "Kesh to'liq yangilanadi",
    steps: [
      { label: "Savdo nuqtalari", kb: "342" },
      { label: "Katalog va narxlar", kb: "1 208" },
      { label: "Ombor qoldiqlari", kb: "3 ombor" },
      { label: "Bonus va skidka", kb: "6 qoida" },
      { label: "Buyurtmalar", kb: "24 ta" },
      { label: "Foto hisobotlar", kb: "8 ta" },
      { label: "Marshrut va tabel", kb: "12 vizit" },
    ],
  },
};

export const MOTION_META: Record<MotionVariant, { title: string; hint: string; steps: { label: string }[] }> = {
  welcome: { title: "Ilovaga xush kelibsiz", hint: "Ish joyingiz tayyorlanmoqda", steps: SYNC_META.full.steps },
  identity: SYNC_META.identity,
  quick: SYNC_META.quick,
  full: SYNC_META.full,
};

const ROLE_WORD: Record<RoleKey, string> = { agent: "Agent", expeditor: "Dastavka", supervisor: "Nazorat", cashier: "Kassa" };

/**
 * Sales Arena branded sync motion, used by all three sync options and by
 * the dedicated sync screen. The mark draws, the brand wave rises with the
 * progress bar, the role's vehicle keeps moving, and success lands with a
 * drawn check + particles.
 */
function LightBackdrop({ accent }: { accent: Accent }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-16 -top-16 size-48 rounded-full blur-[58px]" style={{ background: `${accent.bright}36` }} />
      <div className="absolute -left-16 top-1/3 size-40 rounded-full blur-[54px]" style={{ background: `${accent.bright}26` }} />
      <div className="dot-grid absolute inset-0 opacity-[0.18]" />
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className="sm-mote absolute rounded-full"
          style={{
            left: `${8 + ((i * 41) % 84)}%`,
            top: `${14 + ((i * 47) % 70)}%`,
            width: 2.5 + (i % 3),
            height: 2.5 + (i % 3),
            background: i % 2 ? accent.bright : accent.hex,
            opacity: 0,
            "--dx": `${(i % 2 ? 1 : -1) * (8 + (i % 4) * 6)}px`,
            "--dy": `${-20 - (i % 4) * 9}px`,
            "--o": `${0.25 + (i % 3) * 0.1}`,
            "--dur": `${7 + (i % 4) * 1.6}s`,
            "--d": `${i * 540}ms`,
          } as React.CSSProperties}
        />
      ))}
      <svg className="absolute inset-0 size-full opacity-[0.14]" viewBox="0 0 300 700" preserveAspectRatio="none">
        <circle cx="150" cy="260" r="120" fill="none" stroke={accent.hex} strokeWidth="0.6" strokeDasharray="3 10" />
        <circle cx="150" cy="260" r="84" fill="none" stroke={accent.hex} strokeWidth="0.4" strokeDasharray="2 14" />
        <circle cx="150" cy="260" r="48" fill="none" stroke="#fff" strokeWidth="0.5" strokeDasharray="4 12" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white/70 to-transparent" />
    </div>
  );
}

export function BrandSync({
  role,
  accent,
  variant,
  motion = "full",
  inline = false,
  onDone,
  onClose,
}: {
  role: RoleKey;
  accent: Accent;
  variant: SyncVariant;
  motion?: MotionLevel;
  /** render inside the current screen instead of as a full overlay */
  inline?: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const fast = motion === "off";
  const meta = SYNC_META[variant];
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const done = step >= meta.steps.length;
  const pct = Math.round((Math.min(step, meta.steps.length) / meta.steps.length) * 100);

  useEffect(() => {
    setStep(0);
    setFinished(false);
    if (fast) {
      setStep(meta.steps.length);
      return;
    }
    let i = 0;
    const per = variant === "quick" ? 420 : variant === "identity" ? 460 : 380;
    const id = setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= meta.steps.length) clearInterval(id);
    }, per);
    return () => clearInterval(id);
  }, [run, variant, fast, meta.steps.length]);

  useEffect(() => {
    if (!done || finished) return;
    const id = setTimeout(() => {
      setFinished(true);
      onDoneRef.current();
    }, fast ? 40 : 1500);
    return () => clearTimeout(id);
  }, [done, finished, fast]);

  return (
    <div
      className={cn("pointer-events-auto absolute inset-0 z-[70] flex flex-col overflow-hidden text-white", inline && "rounded-none")}
      style={{ background: `linear-gradient(168deg, color-mix(in srgb, ${accent.bright} 12%, #ffffff) 0%, #FBFCFE 42%, color-mix(in srgb, ${accent.hex} 7%, #ffffff) 100%)`, color: "#0E1420" }}
      data-brand-sync={variant}
      data-sync-step={step}
      data-sync-done={done ? "1" : "0"}
    >
      {/* light, brand-matched backdrop */}
      <LightBackdrop accent={accent} />

      {/* header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-2">
          <BrandMark size={26} draw={!fast} />
          <span className="leading-none">
            <BrandWordmark size={13} tone="light" />
            <span className="mt-1 block font-mono text-[6.5px] uppercase tracking-[0.18em] text-[#7A8697]">sinxronlash · {ROLE_WORD[role]}</span>
          </span>
        </span>
        {onClose && (
          <button type="button" onClick={() => { if (done) onDoneRef.current(); else onClose?.(); }} aria-label="Yopish" className="grid size-7 place-items-center rounded-full border border-[#E2E7EE] bg-white/85 text-[#465060] shadow-sm transition active:scale-90">
            <X size={12} />
          </button>
        )}
      </div>

      {/* role vehicle strip */}
      <div className="relative z-[5] mx-4 mt-3 h-[132px] shrink-0 overflow-hidden rounded-[16px] border border-[#E3E8EF] bg-white shadow-[0_16px_36px_-24px_rgba(14,20,32,.35)]">
        <RoadScene key={`${role}-${run}`} role={role} accent={accent} motion={motion} leaving={done} />
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 font-mono text-[7px] font-bold text-[#0E1420] shadow-sm backdrop-blur">
          <span className={cn("size-1.5 rounded-full", done ? "bg-lime" : "bg-amber-300", !fast && !done && "sm-pulse")} />
          {done ? "TAYYOR" : `${pct}%`}
        </span>
      </div>

      {/* title + progress */}
      <div className="relative z-10 px-5 pt-3 text-center">
        <p className="font-display text-[15px] font-bold tracking-[-0.02em]">{done ? "Sinxronlash yakunlandi" : meta.title}</p>
        <p className="mt-0.5 text-[9px] text-[#66717E]">{done ? `${meta.steps.length} bosqich · ${variant === "full" ? "18.4 MB" : variant === "quick" ? "1.6 MB" : "0.2 MB"} · 0 xato` : meta.hint}</p>
      </div>

      <div className="relative z-10 mx-4 mt-3">
        <div className="flex items-end justify-between font-mono text-[8px] text-[#7A8697]">
          <span className="flex items-center gap-1"><Database size={9} /> {variant === "identity" ? "profil" : "lokal kesh"}</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: accent.ink }}>{pct}%</span>
        </div>
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-[#E8EDF3]">
          {!fast && !done && <div className="sm-sweep h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND.blue}, ${accent.bright})`, transition: "width .45s cubic-bezier(.16,1,.3,1)" }} />}
          {(fast || done) && <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent.hex}, ${accent.bright})` }} />}
        </div>
      </div>

      {/* steps */}
      <div className="relative z-10 mx-4 mt-3 space-y-1.5">
        {meta.steps.map((s, i) => {
          const ok = i < step;
          const now = i === step && !done;
          return (
            <div
              key={s.label}
              className={cn("flex items-center gap-2 rounded-[10px] border px-2.5 py-[7px]", fast ? "" : "sm-fly")}
              style={{ borderColor: ok ? `${accent.hex}33` : "#E4E9F0", background: ok ? `${accent.hex}10` : "rgba(255,255,255,.75)", animationDelay: `${i * 120}ms`, opacity: ok || now ? 1 : 0.5, boxShadow: ok ? "0 2px 8px -4px rgba(14,20,32,.12)" : "none" }}
            >
              <span className="grid size-[15px] shrink-0 place-items-center rounded-full transition-colors" style={{ background: ok ? accent.hex : now ? accent.bright : "#E2E7EE", color: accent.onAccent }}>
                {ok ? <Check size={9} strokeWidth={4} className={fast ? undefined : "sm-check"} /> : <span className="size-1 rounded-full bg-current" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[9px] font-medium">{s.label}</span>
              <span className="shrink-0 font-mono text-[7.5px]" style={{ color: ok ? accent.ink : "#8A96A4" }}>{ok ? s.kb : "···"}</span>
            </div>
          );
        })}
      </div>

      {/* success badge */}
      {done && (
        <div className="relative z-10 mt-3 flex justify-center">
          {!fast && (
            <span className="pointer-events-none absolute left-1/2 top-6">
              {Array.from({ length: 12 }).map((_, i) => {
                const ang = (i / 12) * Math.PI * 2;
                return <span key={i} className="sm-particle absolute block size-1 rounded-full" style={{ background: [accent.bright, "#C8F56A", BRAND.bright, "#F5D08A"][i % 4], "--cx": `${Math.cos(ang) * (46 + (i % 3) * 18)}px`, "--cy": `${Math.sin(ang) * (46 + (i % 3) * 18)}px`, "--cr": `${i * 40}deg`, "--d": `${i * 25}ms` } as React.CSSProperties} />;
              })}
            </span>
          )}
          <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold", !fast && "sm-ring")} style={{ borderColor: `${accent.hex}44`, background: `${accent.hex}18`, color: accent.ink, boxShadow: "0 12px 28px -16px rgba(14,20,32,.35)" }}>
            <span className="grid size-5 place-items-center rounded-full" style={{ background: accent.hex, color: accent.onAccent }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.6 10 17.4 19.4 7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="au-check" /></svg>
            </span>
            Muvaffaqiyatli sinxronlandi
          </span>
        </div>
      )}

      {/* brand wave rising with progress */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1]" style={{ height: `${14 + pct * 0.86}%`, transition: "height .5s cubic-bezier(.16,1,.3,1)", opacity: 0.16 }}>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="block h-full w-full" aria-hidden>
          <path d="M0 12 C 25 4, 55 22, 100 8 L100 30 L0 30 Z" fill={BRAND.blue} />
          <path d="M0 18 C 30 10, 60 26, 100 14 L100 30 L0 30 Z" fill={accent.hex} opacity="0.7" />
        </svg>
      </div>

      {/* footer meta + actions */}
      <div className="relative z-10 mt-auto px-4 pb-4 pt-2">
        <div className="mb-2.5 flex items-center justify-center gap-3 text-[7.5px] text-[#8A93A1]">
          <span className="flex items-center gap-1"><ShieldCheck size={9} /> xavfsiz kanal</span>
          <span className="flex items-center gap-1"><FileUp size={9} /> {variant === "full" ? "to'liq kesh" : "diff rejimi"}</span>
          <span className="flex items-center gap-1"><Link2 size={9} /> api.salesarena.uz</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRun((n) => n + 1)} aria-label="Qayta sinxronlash" className="grid size-10 shrink-0 place-items-center rounded-full border border-[#E2E7EE] bg-white text-[#465060] shadow-sm transition active:scale-90">
            <RotateCcw size={13} />
          </button>
          <button type="button" onClick={onDone} className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[10.5px] font-bold transition active:scale-[0.98]" style={{ background: done ? accent.hex : "#EEF1F6", color: done ? accent.onAccent : "#8A93A1", boxShadow: done ? `0 12px 22px -14px ${accent.hex}` : "none" }}>
            {done ? <><Check size={12} strokeWidth={3} /> Davom etish</> : <>O'tkazib yuborish</>}
          </button>
        </div>
        {variant === "identity" && (
          <p className="mt-2 flex items-center justify-center gap-1 text-[7.5px] text-[#8A93A1]"><UserRound size={8} /> Rol kartasi: rasm va raqam server bilan mos</p>
        )}
      </div>
    </div>
  );
}
