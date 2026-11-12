import { useEffect, useRef, useState } from "react";
import { Check, Gauge, MousePointerClick, Play, RotateCcw, Sparkles, Timer, Wand2, Wifi, ShieldCheck } from "lucide-react";
import { motionPresets, motionRules } from "../data/design";
import { Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

type DemoType = (typeof motionPresets)[number]["demo"];

function Demo({ type, on, replay }: { type: DemoType; on: boolean; replay: number }) {
  const key = `${type}-${replay}`;
  const anim = on ? "shimmer" : "";

  if (type === "pop") {
    return (
      <div className="grid h-full place-items-center">
        <div key={key} className={cn("relative", on && "pop-in")}>
          <span className="absolute inset-0 rounded-2xl bg-brand-500/20 blur-md" />
          <span className="relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-lime shadow-lg">
            <Check size={20} strokeWidth={3} />
          </span>
          <span className="absolute -right-2 -top-2 size-3 rounded-full bg-lime ring-4 ring-[#F4F8F6]" />
        </div>
      </div>
    );
  }

  if (type === "rise") {
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 px-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`${key}-${i}`}
            className={cn("flex items-center gap-2 rounded-lg border border-line bg-white px-2 py-1.5", on && "stagger-item")}
            style={{ "--stagger": `${i * 80}ms` } as React.CSSProperties}
          >
            <span className="grid size-4 place-items-center rounded-md bg-brand-50 text-[6px] font-bold text-brand-700">{(i + 1).toString()}</span>
            <span className="h-1 flex-1 rounded-full bg-line" />
            <span className="h-1 w-4 rounded-full bg-brand-300" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "slide") {
    return (
      <div className="relative grid h-full place-items-center overflow-hidden">
        <div key={key} className={cn("flex h-[74px] w-[120px] items-center", on && "screen-enter")}>
          <div className="h-full flex-1 rounded-xl border border-line bg-white p-2 shadow-sm">
            <div className="h-1 w-8 rounded bg-line" />
            <div className="mt-1.5 h-5 rounded-md bg-gradient-to-br from-brand-600 to-brand-800" />
            <div className="mt-1 h-1 w-full rounded bg-line" />
            <div className="mt-0.5 h-1 w-2/3 rounded bg-line" />
          </div>
          <div className="-ml-3 h-[86%] flex-1 rounded-xl border border-brand-200 bg-brand-50 p-2 shadow-md">
            <div className="h-1 w-6 rounded bg-brand-200" />
            <div className="mt-1.5 space-y-1">
              <div className="h-1.5 rounded bg-white" />
              <div className="h-1.5 rounded bg-white" />
              <div className="h-1.5 w-2/3 rounded bg-white" />
            </div>
            <div className="mt-1 h-2 w-8 rounded-full bg-brand-600" />
          </div>
        </div>
        <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-1.5 py-0.5 font-mono text-[6.5px] text-muted shadow-sm">
          <MousePointerClick size={7} /> tap → screen
        </span>
      </div>
    );
  }

  if (type === "grow") {
    return (
      <div className="flex h-full items-end justify-center gap-2 px-6 pb-5 pt-4">
        {[38, 62, 46, 88, 70].map((h, i) => (
          <div key={`${key}-${i}`} className="flex w-full flex-col items-center gap-1">
            <div
              className={cn("w-full rounded-t-[4px]", on && "bar-grow")}
              style={{ height: `${h}px`, background: i === 3 ? "#C8F56A" : i === 4 ? "#078179" : "#A4E4DA", animationDelay: `${i * 70}ms` }}
            />
            <span className="h-[2px] w-full rounded-full bg-line" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "pulse") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <span className="live-dot size-2.5 rounded-full bg-brand-600 text-brand-600" />
        <div className="mt-1 flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-2.5 py-1 shadow-sm">
          <span className="size-1.5 rounded-full bg-[#22a06b]" />
          <span className="font-mono text-[8px] font-semibold text-ink">LIVE · 04:57</span>
        </div>
        <div className="flex items-end gap-0.5">
          {[5, 9, 14, 8, 12, 6, 10, 15, 7].map((h, i) => (
            <span key={i} className="w-[3px] rounded-full bg-brand-400/60" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  if (type === "ripple") {
    return (
      <div className="grid h-full place-items-center">
        <div className="relative">
          {on && (
            <>
              <span className="ripple-ring absolute inset-0 rounded-full border border-brand-500/50" />
              <span className="ripple-ring absolute inset-0 rounded-full border border-brand-500/30" style={{ animationDelay: "0.45s" }} />
            </>
          )}
          <button type="button" className="relative grid size-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-lg">
            <Check size={19} strokeWidth={3} />
          </button>
        </div>
        <span className="absolute bottom-2 font-mono text-[7px] uppercase tracking-wider text-muted">tap · 180ms</span>
      </div>
    );
  }

  if (type === "count") {
    return <CountDemo on={on} replay={replay} />;
  }

  if (type === "tilt") {
    return <TiltDemo on={on} />;
  }

  if (type === "launch") {
    return (
      <div className="flex h-full items-center justify-center gap-2 px-3">
        {[
          { icon: <Sparkles size={11} />, label: "Splash", bg: "linear-gradient(160deg,#0B3C37,#06211E)", fg: "#C8F56A" },
          { icon: <ShieldCheck size={11} />, label: "PIN", bg: "#0D2521", fg: "#A4E4DA" },
          { icon: <Wifi size={11} />, label: "Home", bg: "#F0F5F6", fg: "#078179" },
        ].map((f, i) => (
          <div key={f.label} className={cn("relative flex flex-col", on && "launch-frame")} style={{ animationDelay: `${i * 0.35}s` }}>
            <div className="grid h-[86px] w-[58px] flex-col justify-between rounded-[10px] border border-white/20 p-1.5 shadow-md" style={{ background: f.bg }}>
              <span style={{ color: f.fg }}>{f.icon}</span>
              <div className="space-y-1">
                <span className="block h-1 rounded-full" style={{ background: f.fg, opacity: 0.8 }} />
                <span className="block h-1 w-2/3 rounded-full" style={{ background: f.fg, opacity: 0.35 }} />
                <span className="block h-1 w-1/2 rounded-full" style={{ background: f.fg, opacity: 0.25 }} />
              </div>
              <span className="text-[5px] font-bold uppercase tracking-wider" style={{ color: f.fg }}>{f.label}</span>
            </div>
            <span className="mt-1 text-center font-mono text-[6px] text-muted">0.{i + 2}s</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full px-4 py-4">
      <div className="rounded-xl border border-line bg-white p-2.5">
        <div className="flex items-center gap-2">
          <span className="size-7 rounded-full bg-line" />
          <div className="flex-1 space-y-1.5">
            <span className="relative block h-1.5 w-3/4 overflow-hidden rounded-full bg-line">
              <span className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent", anim)} />
            </span>
            <span className="relative block h-1.5 w-1/2 overflow-hidden rounded-full bg-line">
              <span className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent shimmer", anim)} />
            </span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded-md bg-[#F0F5F3]">
              <span className={cn("block h-full rounded-md bg-gradient-to-r from-transparent via-white/80 to-transparent shimmer", anim)} />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center font-mono text-[7px] text-muted">loading · skeleton</p>
    </div>
  );
}

export default function MotionLab({ embedded = false }: { embedded?: boolean }) {
  const [enabled, setEnabled] = useState(true);
  const [replay, setReplay] = useState(0);
  const toast = useToast();

  return (
    <section id="harakat" className={(embedded ? "surface-tint relative overflow-hidden rounded-[26px] p-4 sm:p-6" : "surface-tint relative overflow-hidden border-y border-line/70 py-20 sm:py-28")}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="amb amb-1 absolute -right-24 top-10 size-80 rounded-full opacity-[0.16] blur-3xl" />
        <div className="amb amb-3 absolute -left-16 bottom-0 size-72 rounded-full opacity-[0.18] blur-3xl" />
      </div>

      <div className={embedded ? "relative" : "container-x relative"}>
        <Reveal>
          <SectionHead
            eyebrow="Motion lab"
            title={<>Harakat — <span className="text-brand-600">bezatish emas</span>, javob</>}
            description="Har bir animatsiya foydalanuvchiga nima bo'lganini aytadi. Tezlik, masofa va egri chiziq — tokenlashgan va qayta ishlatiladigan."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2">
                  <Wand2 size={12} className="text-brand-600" />
                  <span className="text-[10.5px] font-semibold text-ink">Animatsiya</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label="Animatsiyalarni yoqish"
                    onClick={() => setEnabled((v) => !v)}
                    className={cn("relative h-[17px] w-8 rounded-full transition-colors", enabled ? "bg-brand-600" : "bg-line-dark")}
                  >
                    <span className={cn("absolute top-[2px] size-[13px] rounded-full bg-white shadow-sm transition-all", enabled ? "left-[16px]" : "left-[2px]")} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setReplay((r) => r + 1); toast(`${motionPresets.length} ta effekt qayta o'ynatildi`); }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <Play size={11} fill="currentColor" /> Hammasini takrorlash
                </button>
              </div>
            }
          />
        </Reveal>

        <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_318px]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {motionPresets.map((p, i) => (
              <Reveal key={p.id} delay={i * 60}>
                <div className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-line bg-white transition hover:border-brand-200 hover:shadow-soft">
                  <div className="dot-grid relative h-[152px] overflow-hidden border-b border-line/80 bg-[#F4F8F6]">
                    <span className="absolute left-2.5 top-2.5 z-10 rounded bg-white/80 px-1.5 py-0.5 font-mono text-[7.5px] text-muted backdrop-blur">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Demo type={p.demo} on={enabled} replay={replay} />
                    <button
                      type="button"
                      onClick={() => setReplay((r) => r + 1)}
                      aria-label={`${p.name} animatsiyasini qayta o'ynatish`}
                      className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-md border border-line bg-white/90 text-ink-2 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-brand-700"
                    >
                      <RotateCcw size={10} />
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11.5px] font-semibold text-ink">{p.name}</h3>
                      <span className="rounded bg-[#F3F8F6] px-1.5 py-0.5 font-mono text-[7px] text-muted">{p.use}</span>
                    </div>
                    <p className="mt-1 font-mono text-[8.5px] text-brand-700">{p.spec}</p>
                    <div className="mt-auto pt-2">
                      <div className="h-1 overflow-hidden rounded-full bg-[#EDF3F1]">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-700" style={{ width: `${[68, 82, 58, 92, 100, 76, 64, 88, 72, 84][i] ?? 70}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="sticky top-24 space-y-3">
              <div className="rounded-[18px] border border-line bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Standard easing</p>
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-brand-700">ease-out-quint</span>
                </div>
                <div className="mt-2 overflow-hidden rounded-[10px] border border-line bg-[#FBFDFC] p-2">
                  <svg viewBox="0 0 170 112" className="h-[110px] w-full" role="img" aria-label="cubic-bezier(.16, 1, .3, 1) egri chizig'i">
                    <defs>
                      <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#078179" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#078179" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[20, 44, 68, 92].map((y) => (
                      <line key={y} x1="10" y1={y} x2="158" y2={y} stroke="#E6EEEB" strokeWidth="1" />
                    ))}
                    {[44, 84, 124].map((x) => (
                      <line key={x} x1={x} y1="10" x2={x} y2="100" stroke="#E6EEEB" strokeWidth="1" />
                    ))}
                    <path d="M10 100 C 33 10, 54 10, 158 10 L 158 100 Z" fill="url(#curve-fill)" />
                    <path d="M10 100 C 33 10, 54 10, 158 10" fill="none" stroke="#078179" strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="10" y1="10" x2="33" y2="10" stroke="#C8F56A" strokeWidth="1.4" strokeDasharray="3 3" />
                    <line x1="10" y1="100" x2="33" y2="10" stroke="#0B9A90" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
                    <line x1="158" y1="100" x2="158" y2="10" stroke="#0B9A90" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="10" cy="100" r="3" fill="#06211E" />
                    <circle cx="158" cy="10" r="3.4" fill="#078179" />
                  </svg>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[8px] text-muted">
                  <span>cubic-bezier</span>
                  <CopyValue />
                </div>
              </div>

              <div className="rounded-[18px] border border-line bg-white p-4">
                <p className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted"><Timer size={10} /> Davomiylik qoidalari</p>
                <div className="mt-2.5 space-y-2">
                  {motionRules.map((r) => (
                    <div key={r.rule} className="flex items-start gap-2">
                      <span className="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"><Check size={8} strokeWidth={3.5} /></span>
                      <div className="flex-1">
                        <p className="font-mono text-[9px] font-semibold text-ink">{r.rule}</p>
                        <p className="text-[9px] text-ink-2/60">{r.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[18px] border border-[#DDEBC9] bg-lime-soft/70 p-4">
                <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-brand-900"><Sparkles size={12} /> Reduced motion</p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-brand-900/65">
                  Tizim sozlamasida harakat o'chirilgan bo'lsa, barcha o'tishlar 0ms bo'ladi. Ma'lumot baribir ko'rinadi.
                </p>
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/60 px-2 py-1.5 font-mono text-[8px] text-brand-900/60">
                  <Gauge size={10} /> prefers-reduced-motion: reduce
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function CopyValue() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText("cubic-bezier(0.16, 1, 0.3, 1)").catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="rounded border border-line bg-white px-1.5 py-0.5 text-brand-700 transition hover:border-brand-300"
    >
      {copied ? "nusxalandi ✓" : "(.16, 1, .3, 1)"}
    </button>
  );
}


function CountDemo({ on, replay }: { on: boolean; replay: number }) {
  const [value, setValue] = useState(on ? 0 : 12800000);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!on) {
      setValue(12800000);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(12800000 * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    setValue(0);
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [on, replay]);
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <p className="font-mono text-[8px] uppercase tracking-wider text-muted">oylik fakt</p>
      <p className="mt-1 font-display text-[24px] font-bold tabular-nums tracking-[-0.04em] text-ink">
        {(value / 1000000).toFixed(1)}<span className="text-[10px] font-medium text-muted"> mln</span>
      </p>
      <div className="mt-2 h-1 w-[70%] overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-100" style={{ width: `${(value / 12800000) * 100}%` }} />
      </div>
      <div className="mt-2 flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[7px] font-semibold text-brand-700">
        <Sparkles size={8} /> tabular-nums
      </div>
    </div>
  );
}

function TiltDemo({ on }: { on: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!on || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.setProperty("--ry", `${x * 22}deg`);
    ref.current.style.setProperty("--rx", `${-y * 22}deg`);
  };
  const leave = () => {
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
  };
  return (
    <div className="grid h-full place-items-center px-5">
      <div className="tilt-card w-full max-w-[150px] rounded-xl border border-line bg-gradient-to-br from-white to-[#F1F8F5] p-2.5 shadow-md" ref={ref} onMouseMove={move} onMouseLeave={leave}>
        <div className="flex items-center justify-between">
          <span className="grid size-6 place-items-center rounded-md bg-brand-50 text-[10px]">🪪</span>
          <span className="rounded bg-lime/30 px-1 py-0.5 font-mono text-[6px] font-bold text-brand-900">VIP</span>
        </div>
        <p className="mt-2 text-[8.5px] font-bold text-ink">O'zbekiston Gullari</p>
        <p className="text-[6.5px] text-muted">TT-0847 · A toifa</p>
        <div className="mt-1.5 h-[2px] rounded-full bg-brand-100"><div className="h-full w-2/3 rounded-full bg-brand-500" /></div>
      </div>
      <span className="mt-2 font-mono text-[6.5px] text-muted">{on ? "pointer bilan eging" : "statik"}</span>
    </div>
  );
}
