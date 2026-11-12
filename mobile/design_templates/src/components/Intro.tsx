import { useEffect, useState } from "react";
import type { RoleKey } from "../data/design";
import { cn } from "../utils/cn";
import { ArrowRight, Check, Landmark, Sparkles, Truck, UserRound, Users, Wifi } from "lucide-react";

const letters = "SALEC".split("");

export default function Intro({ onDone, onSkip, onPickRole }: { onDone: () => void; onSkip: () => void; onPickRole?: (r: RoleKey) => void }) {
  const [picked, setPicked] = useState<RoleKey>("agent");
  const [progress, setProgress] = useState(7);
  const [step, setStep] = useState(0);

  const steps = ["Dizayn tokenlari yuklanmoqda", "25 ekran prototipi tayyorlanmoqda", "Rollar sinxronlanmoqda", "Tayyor"];

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => Math.min(100, p + Math.random() * 16 + 6));
    }, 190);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setStep(progress >= 100 ? 3 : progress > 66 ? 2 : progress > 30 ? 1 : 0);
  }, [progress]);

  useEffect(() => {
    const done = setTimeout(onDone, 2250);
    return () => clearTimeout(done);
  }, [onDone]);

  useEffect(() => {
    onPickRole?.("agent");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="intro-overlay canvas-dark fixed inset-0 z-[200] flex flex-col overflow-hidden text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="amb-mesh absolute inset-0 opacity-60" />
        <div className="aurora-a amb amb-1 absolute -left-20 top-10 size-[380px] rounded-full opacity-45 blur-[90px]" />
        <div className="aurora-b amb amb-2 absolute -right-10 bottom-0 size-[420px] rounded-full opacity-40 blur-[100px]" />
        <div className="dot-grid-dark absolute inset-0 opacity-40" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-lime/20 to-transparent" />
      </div>

      <div className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">salec · design studio</span>
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-white/70 backdrop-blur transition hover:border-white/30 hover:text-white"
        >
          O'tkazib yuborish <ArrowRight size={11} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative grid size-20 place-items-center">
          <span className="intro-ring absolute inset-0 rounded-[26px] border border-lime/40" />
          <span className="intro-ring absolute inset-0 rounded-[26px] border border-lime/20" style={{ animationDelay: "0.6s" }} />
          <div className="intro-mark grid size-[70px] place-items-center rounded-[22px] bg-gradient-to-br from-brand-400 to-brand-800 shadow-[0_24px_60px_-20px_rgba(56,184,172,0.8)]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z" stroke="#C8F56A" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 7.5 16.5 12 12 16.5 7.5 12 12 7.5Z" fill="#EAF8F5" />
            </svg>
          </div>
        </div>

        <div className="mt-7 flex overflow-hidden font-display text-[40px] font-bold tracking-[-0.05em] sm:text-[52px]">
          {letters.map((l, i) => (
            <span key={i} className="intro-letter" style={{ animationDelay: `${120 + i * 60}ms` }}>
              {l}
            </span>
          ))}
          <span className="intro-letter text-brand-300" style={{ animationDelay: `${120 + letters.length * 60}ms` }}>.</span>
        </div>
        <p className="mt-1 text-center text-[11px] font-medium tracking-[0.02em] text-white/45">
          Rolni tanlang — ilova kirish animatsiyasi shu rolga moslashadi
        </p>

        <div className="mt-8 w-full max-w-[320px]">
          <div className="flex items-end justify-between font-mono text-[9px] text-white/45">
            <span>{steps[step]}</span>
            <span className="text-lime">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
            <div className="intro-progress h-full rounded-full bg-gradient-to-r from-brand-300 via-lime to-lime" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {[
              { key: "agent" as RoleKey, icon: UserRound, label: "Agent" },
              { key: "expeditor" as RoleKey, icon: Truck, label: "Ekspeditor" },
              { key: "supervisor" as RoleKey, icon: Users, label: "Supervayzer" },
              { key: "cashier" as RoleKey, icon: Landmark, label: "Kassir" },
            ].map((r, i) => (
              <button
                type="button"
                key={r.label}
                onClick={() => { setPicked(r.key); onPickRole?.(r.key); }}
                className={cn(
                  "intro-chip flex flex-col items-center gap-1 rounded-xl border px-1 py-2 backdrop-blur transition",
                  picked === r.key ? "border-lime/50 bg-lime/15" : "border-white/10 bg-white/[0.04] hover:border-white/25",
                )}
                style={{ animationDelay: `${i * 160}ms` }}
              >
                <r.icon size={13} className={picked === r.key ? "text-lime" : "text-lime/70"} />
                <span className={cn("text-[8.5px] font-medium", picked === r.key ? "text-white" : "text-white/55")}>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-5 pb-6 text-[9px] text-white/30 sm:px-8">
        <span className="flex items-center gap-1.5"><Wifi size={10} className="text-lime/60" /> Oflayn kesh tayyor</span>
        <span className="flex items-center gap-1.5"><Check size={10} className="text-lime/60" /> 128 token</span>
        <span className="flex items-center gap-1.5"><Sparkles size={10} className="text-lime/60" /> 60 FPS byudjeti</span>
      </div>
    </div>
  );
}
