import { useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Command,
  Gauge,
  Grid3X3,
  Layers,
  Palette,
  Smartphone,
  Server,
  Sparkles,
  Users,
  Wand2,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import {
  workspaceViews,
  type RoleKey,
  type ScreenKey,
  type ViewKey,
} from "../data/design";
import Roles from "./Roles";
import Studio from "./Studio";
import Templates from "./Templates";
import DesignSystem from "./DesignSystem";
import MotionLab from "./MotionLab";
import Performance from "./Performance";
import Audit from "./Audit";
import FlutterKit from "./FlutterKit";
import FullStackKit from "./FullStackKit";
import { LiveBadge, Reveal, useToast } from "./ui";
import { cn } from "../utils/cn";

const icons: Record<string, LucideIcon> = {
  users: Users,
  phone: Smartphone,
  grid: Grid3X3,
  palette: Palette,
  motion: Wand2,
  gauge: Gauge,
  audit: ClipboardCheck,
  code: Code2,
  stack: Server,
};

export default function Workspace({
  view,
  onView,
  activeScreen,
  onChange,
  role,
  onRole,
  onOpenScreen,
  onOpenPalette,
}: {
  view: ViewKey;
  onView: (v: ViewKey) => void;
  activeScreen: ScreenKey;
  onChange: (s: ScreenKey) => void;
  role: RoleKey;
  onRole: (r: RoleKey) => void;
  onOpenScreen: (s: ScreenKey) => void;
  onOpenPalette: () => void;
}) {
  const toast = useToast();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const index = workspaceViews.findIndex((v) => v.key === view);
  const prevIndex = useRef(index);
  const dir = index >= prevIndex.current ? 1 : -1;
  useEffect(() => {
    prevIndex.current = index;
  }, [index]);
  const current = workspaceViews[index] ?? workspaceViews[0];
  const next = workspaceViews[(index + 1) % workspaceViews.length];
  const prev = workspaceViews[(index - 1 + workspaceViews.length) % workspaceViews.length];

  useEffect(() => {
    tabRefs.current[view]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [view]);

  const panel = useMemo(() => {
    switch (view) {
      case "rollar":
        return <Roles embedded onOpen={onOpenScreen} />;
      case "prototip":
        return <Studio embedded activeScreen={activeScreen} onChange={onChange} role={role} onRole={onRole} />;
      case "katalog":
        return <Templates embedded onOpen={onOpenScreen} />;
      case "dizayn":
        return <DesignSystem embedded />;
      case "harakat":
        return <MotionLab embedded />;
      case "tezlik":
        return <Performance embedded />;
      case "flutter":
        return <FlutterKit embedded />;
      case "fullstack":
        return <FullStackKit embedded />;
      default:
        return <Audit onOpenScreen={onOpenScreen} />;
    }
  }, [view, activeScreen, role, onChange, onRole, onOpenScreen]);

  return (
    <section id="ishmaydoni" className="relative border-t border-line/70 bg-canvas pb-16 pt-14 sm:pb-20 sm:pt-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-paper to-transparent" />
      <div className="container-x relative">
        <Reveal>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/80 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-brand-700">
                <Layers size={11} /> yagona ish maydoni
              </div>
              <h2 className="font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink text-balance sm:text-[38px]">
                Hamma narsa bitta joyda — <span className="text-brand-600">osa o'tish</span>
              </h2>
              <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-2/75">
                Rollar, 54 interaktiv ekran, 34 shablon, tokenlar, harakat, unumdorlik, audit va
                Flutter paket — bitta panelda. 8 ko'rinish va ⌘K bilan zumda almashish.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LiveBadge label="Live workspace" />
              <button
                type="button"
                onClick={onOpenPalette}
                className="group inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-[11px] font-semibold text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
              >
                <Command size={12} /> Tezkor o'tish
                <span className="rounded border border-line bg-[#F6FAF8] px-1.5 py-0.5 font-mono text-[8.5px] text-muted group-hover:border-brand-200">⌘K</span>
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { v: "4", l: "Rol", d: "agent → kassir" },
              { v: "34", l: "Shablon", d: "role bo'yicha" },
              { v: "54", l: "Live ekran", d: "bosiladi" },
              { v: "60", l: "FPS maqsad", d: "adaptiv effekt" },
            ].map((s) => (
              <div key={s.l} className="flex items-baseline gap-2 rounded-[14px] border border-line bg-white/70 px-3 py-2.5">
                <span className="font-display text-[20px] font-bold leading-none tracking-tight text-ink">{s.v}</span>
                <span className="text-[10px] font-semibold text-ink-2">{s.l}</span>
                <span className="ml-auto hidden font-mono text-[7.5px] text-muted sm:inline">{s.d}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* sticky tab bar */}
        <div className="sticky top-[68px] z-50 mt-6 -mx-1 px-1 py-2">
          <div className="flex items-center gap-1 overflow-hidden rounded-[18px] border border-line bg-white/90 p-1.5 shadow-[0_18px_40px_-30px_rgba(6,33,30,0.6)] backdrop-blur-xl">
            <div className="no-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto">
              {(["Mahsulot", "Tizim"] as const).map((group, gi) => (
                <div key={group} className="flex items-center gap-0.5">
                  {gi > 0 && <span className="mx-1 hidden h-5 w-px shrink-0 bg-line sm:block" />}
                  {workspaceViews
                    .filter((v) => v.group === group)
                    .map((v) => {
                      const Icon = icons[v.icon] ?? Layers;
                      const active = view === v.key;
                      return (
                        <button
                          key={v.key}
                          ref={(el) => {
                            tabRefs.current[v.key] = el;
                          }}
                          type="button"
                          onClick={() => onView(v.key)}
                          title={v.hint}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex shrink-0 items-center gap-1.5 rounded-[12px] px-2.5 py-2 text-[11.5px] font-semibold transition-all duration-300 sm:px-3",
                            active ? "tab-glow bg-ink text-white" : "text-ink-2 hover:bg-[#F3F8F6] hover:text-ink",
                          )}
                        >
                          <Icon size={13} className={active ? "text-lime" : "text-muted group-hover:text-brand-600"} />
                          <span className="hidden sm:inline">{v.label}</span>
                          <span className="sm:hidden">{v.short}</span>
                          {active && <span className="hidden size-1 rounded-full bg-lime md:block" />}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenPalette}
              aria-label="Tezkor o'tish (⌘K)"
              className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-[10px] border border-line bg-[#FAFCFB] px-2 py-1.5 font-mono text-[9px] text-muted transition hover:border-brand-300 hover:text-brand-700 sm:flex"
            >
              <Command size={10} /> K
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 px-1">
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
            <span className="size-1.5 rounded-full bg-brand-500" /> ish maydoni / {current.label}
          </p>
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => { onView(prev.key); toast(`${prev.label} bo'limiga o'tildi`); }}
              className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-[9px] font-medium text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
            >
              <ArrowLeft size={9} /> {prev.short}
            </button>
            <button
              type="button"
              onClick={() => { onView(next.key); toast(`${next.label} bo'limiga o'tildi`); }}
              className="flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 text-[9px] font-medium text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
            >
              {next.short} <ArrowRight size={9} />
            </button>
          </div>
        </div>

        <div key={view} className={cn("mt-3", dir >= 0 ? "view-in-next" : "view-in-prev")}>
          {panel}
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-[18px] border border-line bg-white/70 p-3.5 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-[11px] text-ink-2/70">
            <span className="grid size-6 place-items-center rounded-full bg-lime-soft text-brand-800"><Sparkles size={12} /></span>
            <span><b className="font-semibold text-ink">{current.label}</b> — {current.hint}. Davom eting:</span>
          </p>
          <div className="flex w-full gap-1.5 sm:w-auto">
            <button
              type="button"
              onClick={() => onView(next.key)}
              className="group flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[10.5px] font-semibold text-white transition hover:bg-brand-800 sm:flex-none"
            >
              {next.label} <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={onOpenPalette}
              className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[10.5px] font-semibold text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
            >
              <Command size={11} /> ⌘K
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
