import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  Check,
  Gauge,
  Image as ImageIcon,
  Layers,
  List,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Wifi,
  Zap,
} from "lucide-react";
import { metrics, optimizations } from "../data/design";
import { LiveBadge, Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

const iconMap: Record<string, typeof Layers> = {
  layers: Layers,
  list: List,
  wifi: Wifi,
  image: ImageIcon,
  search: Search,
  zap: Zap,
};

const categories = ["Barchasi", "Render", "Ro'yxat", "Tarmoq", "Rasm", "Qidiruv", "Effekt"];

export default function Performance({ embedded = false }: { embedded?: boolean }) {
  const [measuring, setMeasuring] = useState(false);
  const [done, setDone] = useState(true);
  const [filter, setFilter] = useState("Barchasi");
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const measure = () => {
    setMeasuring(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setMeasuring(false);
      setDone(true);
      toast("60 FPS barqaror · 0 dropped frame");
    }, 1800);
  };

  const fps = measuring ? 47 : done ? 60 : 52;
  const pct = Math.round((fps / 60) * 100);
  const R = 76;
  const C = 2 * Math.PI * R;
  const list = filter === "Barchasi" ? optimizations : optimizations.filter((o) => o.category === filter);

  return (
    <section id="tezlik" className={(embedded ? "noise canvas-dark relative overflow-hidden rounded-[26px] p-4 sm:p-6" : "noise canvas-dark relative overflow-hidden py-20 sm:py-28")}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="amb-mesh absolute inset-0 opacity-45" />
        <div className="aurora-a amb amb-1 absolute -left-24 top-0 size-[420px] rounded-full opacity-35 blur-[100px]" />
        <div className="aurora-b amb amb-2 absolute -right-20 top-1/3 size-[480px] rounded-full opacity-35 blur-[100px]" />
        <div className="aurora-c amb amb-3 absolute bottom-0 left-1/2 size-[360px] -translate-x-1/2 rounded-full opacity-25 blur-[120px]" />
        <div className="line-grid-dark absolute inset-0 opacity-40" />
      </div>

      <div className={embedded ? "relative" : "container-x relative"}>
        <Reveal>
          <SectionHead
            dark
            eyebrow="Performance"
            title={<>Chiroyli va <span className="text-lime">tez</span> — bir vaqtda</>}
            description="Yangi effektlar sekinlashtirmaydi. Har bir animatsiya byudjetga ega, har bir ro'yxat cheklangan, har bir so'rov keshlangan."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <LiveBadge dark label="60 FPS target" />
                <button
                  type="button"
                  onClick={measure}
                  disabled={measuring}
                  className="group inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2.5 text-[11.5px] font-bold text-midnight transition hover:bg-[#d7fa8c] disabled:opacity-70"
                >
                  <RefreshCw size={13} className={measuring ? "animate-spin" : "transition-transform group-hover:rotate-90"} />
                  {measuring ? "O'lchanmoqda…" : "Profilerni ishga tushirish"}
                </button>
              </div>
            }
          />
        </Reveal>

        <div className="mt-9 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <div className="relative h-full overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-lime"><Activity size={15} /></span>
                  <div>
                    <p className="text-[12px] font-semibold text-white">Performance profiler</p>
                    <p className="font-mono text-[8.5px] text-white/35">pixel 6 · release build</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[8.5px] text-white/55">
                  <span className={cn("size-1.5 rounded-full", measuring ? "animate-pulse bg-[#FEBC2E]" : "bg-lime")} />
                  {measuring ? "recording" : "stable"}
                </span>
              </div>

              <div className="relative mx-auto mt-5 grid size-[220px] place-items-center">
                <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90">
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#38B8AC" />
                      <stop offset="60%" stopColor="#C8F56A" />
                      <stop offset="100%" stopColor="#EEFCD4" />
                    </linearGradient>
                  </defs>
                  <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
                  {[...Array(40)].map((_, i) => {
                    const angle = (i / 40) * 360;
                    const rad = (angle * Math.PI) / 180;
                    const x1 = 100 + Math.cos(rad) * 90;
                    const y1 = 100 + Math.sin(rad) * 90;
                    const x2 = 100 + Math.cos(rad) * 95;
                    const y2 = 100 + Math.sin(rad) * 95;
                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.13)" strokeWidth="1" />;
                  })}
                  <circle
                    cx="100"
                    cy="100"
                    r={R}
                    fill="none"
                    stroke="url(#gaugeGrad)"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * C} ${C}`}
                    style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)", filter: "drop-shadow(0 0 12px rgba(200,245,106,.35))" }}
                  />
                </svg>
                <div className="text-center">
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/35">frames / sec</p>
                  <p className="font-display text-[52px] font-bold leading-none tracking-[-0.05em] text-white">
                    {fps}
                  </p>
                  <p className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[8px] font-semibold", measuring ? "bg-[#FEBC2E]/15 text-[#FEBC2E]" : "bg-lime/15 text-lime")}>
                    <Gauge size={9} /> {measuring ? "o'lchanmoqda" : "barqaror"}
                  </p>
                </div>
                {!measuring && (
                  <span className="absolute right-1 top-3 rounded-full border border-white/10 bg-midnight/70 px-2 py-1 font-mono text-[7.5px] text-lime/90 backdrop-blur">
                    +8% ↑
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 rounded-[14px] border border-white/10 bg-white/[0.03] py-2.5">
                {[
                  { l: "Jank", v: "0.4%", s: "−82%" },
                  { l: "Xotira", v: "24 MB", s: "−31%" },
                  { l: "Tap delay", v: "42 ms", s: "−58%" },
                ].map((s) => (
                  <div key={s.l} className="px-2 text-center">
                    <p className="font-mono text-[12px] font-semibold text-white">{s.v}</p>
                    <p className="mt-0.5 text-[8px] text-white/35">{s.l}</p>
                    <p className="mt-1 inline-flex items-center gap-0.5 font-mono text-[7.5px] font-semibold text-lime"><ArrowDownRight size={8} />{s.s}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-end gap-1">
                {[38, 52, 44, 64, 58, 72, 61, 78, 69, 84, 76, 92, 88, 96, 90, 100].map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${28 + h * 0.28}px`,
                      background: i > 11 ? "linear-gradient(to top,#38B8AC,#C8F56A)" : "rgba(255,255,255,0.12)",
                      transition: "height .6s ease",
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[7px] uppercase tracking-wider text-white/25">
                <span>oldin</span>
                <span className="text-lime/60">optimallashtirilgan</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="h-full rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-white">Avval → keyin</h3>
                  <p className="mt-0.5 text-[9.5px] text-white/40">Xuddi shu qurilma, xuddi shu tarmoq.</p>
                </div>
                <span className="rounded-full bg-lime/10 px-2 py-1 font-mono text-[8px] font-semibold text-lime">−42% umumiy</span>
              </div>

              <div className="mt-5 space-y-4">
                {metrics.map((m, i) => {
                  const ratio = Math.max(8, Math.round((m.after / m.before) * 100));
                  return (
                    <div key={m.label}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10.5px] font-medium text-white/70">{m.label}</span>
                        <span className="flex items-baseline gap-1.5 font-mono text-[10px]">
                          <span className="text-white/30 line-through decoration-white/20">{m.before}{m.unit}</span>
                          <span className="font-semibold text-white">{m.after}{m.unit}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-white/20" style={{ width: "100%" }} />
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-lime transition-all duration-1000"
                            style={{ width: `${ratio}%`, transitionDelay: `${i * 80}ms` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-[13px] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[8.5px] text-white/40">Bundle budjeti</p>
                    <Package size={11} className="text-white/30" />
                  </div>
                  <p className="mt-1 font-display text-[18px] font-bold tracking-tight text-white">1.1<span className="text-[9px] font-medium text-white/40"> / 1.4 MB</span></p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[79%] rounded-full bg-brand-300" />
                  </div>
                </div>
                <div className="rounded-[13px] border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[8.5px] text-white/40">Cold start</p>
                    <Zap size={11} className="text-lime/70" />
                  </div>
                  <p className="mt-1 font-display text-[18px] font-bold tracking-tight text-white">0.9<span className="text-[9px] font-medium text-white/40"> s</span></p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[38%] rounded-full bg-lime" />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-[11px] border border-lime/15 bg-lime/[0.06] p-2.5">
                <Sparkles size={12} className="mt-0.5 shrink-0 text-lime" />
                <p className="text-[9px] leading-relaxed text-white/55">
                  Effektlar adaptiv: past quvvatli qurilmada glow va blur o'chadi, o'tishlar 220ms ga tushadi.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <div className="mt-8 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">Optimizatsiyalar</span>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={cn(
                  "rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition",
                  filter === c ? "border-lime bg-lime text-midnight" : "border-white/12 bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o, i) => {
            const Icon = iconMap[o.icon] ?? Zap;
            return (
              <Reveal key={o.title} delay={i * 50}>
                <div className="group h-full rounded-[16px] border border-white/10 bg-white/[0.035] p-4 transition duration-300 hover:-translate-y-1 hover:border-lime/25 hover:bg-white/[0.06]">
                  <div className="flex items-start justify-between">
                    <span className="grid size-8 place-items-center rounded-[10px] border border-white/10 bg-white/[0.06] text-brand-300 transition group-hover:border-lime/20 group-hover:text-lime">
                      <Icon size={14} />
                    </span>
                    <span className="rounded-full border border-lime/20 bg-lime/10 px-2 py-0.5 font-mono text-[8px] font-semibold text-lime">{o.gain}</span>
                  </div>
                  <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/30">{o.category}</p>
                  <h4 className="mt-1 text-[12px] font-semibold text-white">{o.title}</h4>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/45">{o.description}</p>
                  <div className="mt-3 flex items-center gap-1 border-t border-white/8 pt-2.5 text-[9px] font-medium text-white/35">
                    <Check size={10} className="text-lime/70" /> Ishlab chiqarishga tayyor
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={140}>
          <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center">
            <p className="font-mono text-[8.5px] leading-relaxed text-white/30">
              O'lchovlar: Pixel 6 (Android 14), iPhone 12 (iOS 17) · production build · 4G tarmoq
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toast("Performance checklist nusxalandi")}
                className="rounded-full border border-white/12 px-3 py-1.5 text-[9.5px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Checklist
              </button>
              <a href="#studio" className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[9.5px] font-semibold text-white/80 transition hover:bg-white/15">
                Studioda sinash
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
