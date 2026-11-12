import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Clock3, Gauge, Layers, MapPin, Play, Wifi } from "lucide-react";
import PhoneFrame from "./phone/PhoneFrame";
import { accents, roles, type RoleKey, type ScreenKey, type ViewKey } from "../data/design";
import type { ScreenKey as SK } from "../data/design";
import { cn } from "../utils/cn";
import { Reveal } from "./ui";

const CHAIN = [
  { role: "Agent", act: "Buyurtma yaratdi", meta: "NK-2104 · 1 240 000", color: "#0FB5A6" },
  { role: "Ekspeditor", act: "Yetkazib berdi", meta: "7/12 · 21 km", color: "#1FBE6C" },
  { role: "Supervayzer", act: "Vizitni tasdiqladi", meta: "foto 3 · GPS ok", color: "#31D177" },
  { role: "Kassir", act: "To'lovni yopdi", meta: "TR-8841 · bank", color: "#16A99B" },
];

function ChainCard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((v) => (v + 1) % CHAIN.length), 2100);
    return () => clearInterval(id);
  }, []);
  const cur = CHAIN[step];
  return (
    <div className="pointer-events-none absolute -left-28 top-[286px] z-20 hidden w-[186px] xl:block">
      <div className="float-slower rounded-2xl border border-white/12 bg-white/[0.055] p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/40">Jonli zanjir</span>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-lime" />
          </span>
        </div>

        <div className="relative mt-2.5 pl-4">
          <span className="absolute left-[5px] top-1 h-[calc(100%-10px)] w-px bg-white/12" />
          <span
            className="absolute left-[3px] size-[5px] rounded-full bg-lime shadow-[0_0_8px_#C8F56A] transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
            style={{ top: `calc(${(step / (CHAIN.length - 1)) * 100}% - ${(step / (CHAIN.length - 1)) * 8}px)` }}
          />
          {CHAIN.map((c, i) => {
            const on = i === step;
            const past = i < step;
            return (
              <div key={c.role} className="relative flex h-[26px] items-center gap-2">
                <span
                  className="absolute -left-4 size-[7px] rounded-full border transition-all duration-500"
                  style={{
                    background: on ? c.color : past ? "rgba(200,245,106,.55)" : "rgba(255,255,255,.12)",
                    borderColor: on ? "#C8F56A" : "transparent",
                    transform: on ? "scale(1.35)" : "scale(1)",
                  }}
                />
                <span
                  className="text-[9px] font-semibold transition-colors duration-500"
                  style={{ color: on ? "#fff" : past ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.28)" }}
                >
                  {c.role}
                </span>
                {past && <Check size={9} className="ml-auto text-lime/60" />}
              </div>
            );
          })}
        </div>

        <div key={step} className="pop-in mt-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
          <p className="text-[8.5px] font-semibold leading-none text-white">{cur.act}</p>
          <p className="mt-1 font-mono text-[7px] leading-none text-white/40">{cur.meta}</p>
        </div>
      </div>
    </div>
  );
}

function HeroClock() {
  const [s, setS] = useState(297);
  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return (
    <span className="font-mono text-[15px] font-semibold tabular-nums tracking-tight text-white">
      {m}:{sec}
    </span>
  );
}

export default function Hero({
  onOpenRole,
  onOpenView,
  initialRole = "agent",
}: {
  onOpenScreen?: (s: ScreenKey) => void;
  onOpenRole: (r: RoleKey) => void;
  onOpenView: (v: ViewKey) => void;
  initialRole?: RoleKey;
}) {
  const [role, setRole] = useState<RoleKey>(initialRole);
  const [heroScreen, setHeroScreen] = useState<SK>("login");
  const [bootSeq, setBootSeq] = useState(0);
  useEffect(() => {
    setRole(initialRole);
    setHeroScreen("login");
    setBootSeq((n) => n + 1);
  }, [initialRole]);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = spotlightRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  const roleDef = roles.find((r) => r.key === role) ?? roles[0];
  const accent = accents.find((a) => a.id === roleDef.accentId) ?? accents[0];
  return (
    <section id="top" onMouseMove={onMove} className="noise canvas-dark relative overflow-hidden pb-0 pt-[68px]">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="amb-mesh absolute inset-0 opacity-[0.55]" />
        <div className="aurora-a amb amb-1 absolute -left-28 top-4 size-[440px] rounded-full opacity-45 blur-[95px]" />
        <div className="aurora-b amb amb-2 absolute -right-10 top-24 size-[540px] rounded-full opacity-40 blur-[105px]" />
        <div className="aurora-c amb amb-3 absolute bottom-0 left-1/3 size-[380px] rounded-full opacity-30 blur-[110px]" />
        <div className="dot-grid-dark absolute inset-0 opacity-60" />
        <div className="amb-hairline absolute inset-x-0 top-[68px] h-px opacity-40" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-midnight" />
        <div ref={spotlightRef} className="spotlight absolute inset-0" />
      </div>

      <div className="container-x relative">
        <div className="grid items-center gap-10 pb-8 pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-6 lg:pb-16 lg:pt-16">
          {/* copy */}
          <div className="relative z-10">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] py-1.5 pl-1.5 pr-3 backdrop-blur">
                <span className="flex items-center gap-1.5 rounded-full bg-lime/15 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-lime">
                  <span className="live-dot size-1.5 rounded-full bg-lime text-lime" /> yangi
                </span>
                <span className="text-[11px] font-medium text-white/65">SALEC Agent · Redesign 2.0</span>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 font-display text-[42px] font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-[58px] lg:text-[66px]">
                <span className="kinetic-line"><span style={{ "--k-delay": "60ms" } as React.CSSProperties}>Yangi dizayn.</span></span>
                <span className="kinetic-line"><span className="text-amb-gradient" style={{ "--k-delay": "180ms" } as React.CSSProperties}>Jonli harakat.</span></span>
                <span className="kinetic-line"><span style={{ "--k-delay": "300ms" } as React.CSSProperties}>Tez ish.</span></span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-[480px] text-[14px] leading-relaxed text-white/55 sm:text-[15px]">
                SALEC mobil ilovasi uchun qayta ishlangan dizayn tizimi: Agent, Ekspeditor, Supervayzer va Kassir. 54 interaktiv ekran, silliq
                animatsiyalar, interaktiv prototip va unumdorlik uchun aniq qoidalar — hammasi bitta joyda.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-7 flex flex-wrap gap-1.5">
                {[
                  { s: "login" as SK, l: "1. Login" },
                  { s: "bootstrap" as SK, l: "2. Kirish motion" },
                  { s: "home" as SK, l: "3. Bosh sahifa" },
                  { s: "menu" as SK, l: "Menyu (18)" },
                  { s: "tabel" as SK, l: "Tabel" },
                  { s: "order" as SK, l: "Zakaz + Bonus" },
                  { s: "shelf-return" as SK, l: "S polki" },
                ].map((q) => (
                  <button
                    key={q.s}
                    type="button"
                    onClick={() => {
                      setHeroScreen(q.s);
                      if (q.s === "login") setBootSeq((n) => n + 1);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition",
                      heroScreen === q.s
                        ? "border-lime bg-lime text-midnight"
                        : "border-white/14 bg-white/[0.06] text-white/75 hover:border-white/30 hover:text-white",
                    )}
                  >
                    {q.l}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onOpenView("prototip")}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-lime px-6 py-3.5 text-[13px] font-bold text-midnight transition-all duration-300 hover:bg-[#d7fa8c] hover:shadow-[0_16px_40px_-12px_rgba(200,245,106,0.55)]"
                >
                  To'liq Mobil Ilova Studio
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenView("katalog")}
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3.5 text-[13px] font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-white/10">
                    <Play size={11} fill="currentColor" />
                  </span>
                  Shablonlar va Tokenlar
                </button>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div className="mt-10 grid max-w-[470px] grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-4">
                {[
                  { v: "4", l: "Rol · bitta ilova" },
                  { v: "54", l: "Interaktiv ekran" },
                  { v: "60", l: "FPS maqsad" },
                ].map((s) => (
                  <div key={s.l} className="px-4 first:pl-0">
                    <p className="font-display text-[26px] font-bold leading-none tracking-tight text-white">
                      {s.v}
                      <span className="ml-0.5 text-lime">+</span>
                    </p>
                    <p className="mt-1.5 text-[10.5px] font-medium text-white/45">{s.l}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={380}>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-white/35">
                <span className="flex items-center gap-1.5"><Check size={11} className="text-lime" /> Flutter uchun</span>
                <span className="flex items-center gap-1.5"><Check size={11} className="text-lime" /> React / RN</span>
                <span className="flex items-center gap-1.5"><Check size={11} className="text-lime" /> Oflayn-first</span>
                <span className="flex items-center gap-1.5"><Check size={11} className="text-lime" /> WCAG AA</span>
              </div>
            </Reveal>
          </div>

          {/* device composition */}
          <div className="relative z-10 flex justify-center lg:justify-end">
            <div className="relative">
              {/* orbit ring */}
              <div aria-hidden className="absolute left-1/2 top-1/2 hidden size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/10 md:block">
                <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-[0_0_18px_4px_rgba(200,245,106,0.5)]" />
                <span className="absolute bottom-10 left-4 size-1.5 rounded-full bg-brand-300" />
              </div>
              <div aria-hidden className="absolute left-1/2 top-1/2 hidden size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06] md:block" />

              <div className="relative flex h-[610px] w-[280px] justify-center min-[380px]:h-[650px] min-[380px]:w-[310px] sm:h-[760px] sm:w-[380px]">
                <div className="origin-top scale-[0.78] transition-transform duration-700 min-[380px]:scale-[0.84] sm:scale-100">
                  <PhoneFrame
                    key={`${role}-${bootSeq}`}
                    role={role}
                    onRole={(r) => { setRole(r); setHeroScreen("login"); setBootSeq((n) => n + 1); }}
                    screen={heroScreen}
                    onScreen={setHeroScreen}
                    theme="light"
                    accent={accent}
                    motion="full"
                    showHints={false}
                  />
                </div>

                {/* floating card: visit */}
                <div className="float-slow absolute -left-8 top-[86px] z-20 w-[158px] rounded-2xl border border-white/12 bg-midnight/80 p-3 backdrop-blur-xl sm:-left-24 sm:top-24">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.12em] text-lime">
                      <span className="live-dot size-1.5 rounded-full bg-lime text-lime" /> Faol vizit
                    </span>
                    <Clock3 size={11} className="text-white/40" />
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <HeroClock />
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[8px] text-white/60">3/4</span>
                  </div>
                  <p className="mt-1 text-[9.5px] font-semibold leading-tight text-white/80">O'zbekiston Gullari</p>
                  <div className="mt-2 flex gap-0.5">
                    {[1, 1, 1, 0].map((v, i) => (
                      <span key={i} className="h-[2.5px] flex-1 rounded-full" style={{ background: v ? "#C8F56A" : "rgba(255,255,255,.16)" }} />
                    ))}
                  </div>
                </div>

                <ChainCard />

                {/* floating card: sync */}
                <div className="float-slower absolute -right-6 bottom-[164px] z-20 flex w-[176px] items-center gap-2.5 rounded-2xl border border-white/12 bg-white/[0.09] p-3 backdrop-blur-xl sm:-right-16 sm:bottom-40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lime/15 text-lime">
                    <Wifi size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-semibold text-white">Sinxronlandi</p>
                    <p className="truncate text-[8px] text-white/45">12 buyurtma · 8 foto</p>
                  </div>
                  <Check size={13} className="ml-auto shrink-0 text-lime" />
                </div>

                {/* floating chip: FPS */}
                <div className="absolute right-2 top-10 z-20 hidden items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1.5 backdrop-blur-xl sm:flex">
                  <Gauge size={12} className="text-lime" />
                  <span className="font-mono text-[9px] font-semibold text-white">60 FPS</span>
                </div>

                {/* floating chip: design tokens */}
                <div className="absolute -left-4 bottom-[86px] z-20 hidden items-center gap-1.5 rounded-full border border-white/12 bg-white/10 px-2.5 py-1.5 backdrop-blur-xl sm:flex">
                  <Layers size={12} className="text-brand-300" />
                  <span className="font-mono text-[9px] font-semibold text-white">128 token</span>
                </div>

                {/* map chip */}
                <div className="absolute bottom-8 right-0 z-20 hidden w-[150px] items-center gap-2 rounded-xl border border-white/12 bg-midnight/80 p-2.5 backdrop-blur-xl sm:flex">
                  <span className="grid size-6 place-items-center rounded-lg bg-brand-500/20 text-brand-300"><MapPin size={12} /></span>
                  <div>
                    <p className="text-[8px] font-semibold text-white">Marshrut faol</p>
                    <p className="font-mono text-[7px] text-white/40">8 ta vizit · 21 km</p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-white/12 bg-midnight/85 p-1 backdrop-blur-xl">
                {roles.map((r) => {
                  const a = accents.find((x) => x.id === r.accentId) ?? accents[0];
                  const active = r.key === role;
                  return (
                    <button key={r.key} type="button" onClick={() => { setRole(r.key); setHeroScreen("login"); setBootSeq((n) => n + 1); }} onDoubleClick={() => onOpenRole(r.key)} title={`${r.name} · ikki marta bosing`} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9.5px] font-semibold transition", active ? "text-midnight" : "text-white/60 hover:text-white")} style={active ? { background: "#C8F56A" } : undefined}>
                      <span className="size-1.5 rounded-full" style={{ background: active ? "#06211E" : a.hex }} />
                      {r.short}
                    </button>
                  );
                })}
                <button type="button" onClick={() => onOpenRole(role)} className="ml-0.5 flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1.5 text-[9px] font-semibold text-white/65 transition hover:border-lime/30 hover:text-lime">
                  Studio <ArrowRight size={9} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="flex items-center justify-between border-y border-white/10 px-4 py-3 sm:px-8">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Redesign principles</span>
          <a href="#dizayn" className="group inline-flex items-center gap-1 text-[10px] font-medium text-white/50 transition hover:text-lime">
            Tokenlarni ko'rish <ArrowUpRight size={11} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
        <div className="marquee-paused overflow-hidden border-b border-white/10 py-3.5">
          <div className="marquee-track gap-8">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-8">
                {["Oflayn-first", "60 FPS", "Spring motion", "Tap feedback", "Adaptive effects", "Tez qidiruv", "Bir qo'lda boshqaruv", "WCAG AA"].map((item, i) => (
                  <span key={`${dup}-${item}`} className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    <span className={i % 3 === 0 ? "size-1.5 rounded-full bg-lime" : "size-1.5 rounded-full bg-brand-400/60"} />
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
