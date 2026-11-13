import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Code2,
  Server,
  Command,
  Gauge,
  ClipboardCheck,
  Grid3X3,
  Layers,
  Menu,
  Palette,
  Play,
  Smartphone,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { workspaceViews, type ViewKey } from "../data/design";
import ThemePicker from "./ThemePicker";
import { canvasThemes } from "../data/themes";
import { Logo } from "./ui";
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

export default function Nav({
  view,
  onView,
  onPalette,
  onReplayIntro,
  canvas,
  onCanvas,
}: {
  view: ViewKey;
  onView: (v: ViewKey) => void;
  onPalette: () => void;
  onReplayIntro: () => void;
  canvas: string;
  onCanvas: (id: string) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (v: ViewKey) => {
    onView(v);
    setOpen(false);
    requestAnimationFrame(() => document.getElementById("ishmaydoni")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[90] transition-all duration-300",
        scrolled || open ? "border-b border-line/80 bg-canvas/90 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="container-x flex h-[68px] items-center justify-between gap-3">
        <Logo invert={!scrolled && !open} onClick={() => setOpen(false)} />

        <nav className="hidden items-center gap-0.5 rounded-full border border-line/70 bg-white/60 p-1 backdrop-blur-md lg:flex" aria-label="Ish maydoni bo'limlari">
          {workspaceViews.map((v) => {
            const Icon = icons[v.icon] ?? Layers;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => go(v.key)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[11.5px] font-medium transition-colors",
                  active ? "bg-ink text-white" : "text-ink-2 hover:bg-white hover:text-ink",
                )}
              >
                <Icon size={12} className={active ? "text-lime" : "text-muted"} />
                {v.short}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemePicker value={canvas} onChange={onCanvas} />
          <button
            type="button"
            onClick={onReplayIntro}
            className="hidden size-9 place-items-center rounded-full border border-line bg-white/70 text-ink-2 backdrop-blur transition hover:border-brand-300 hover:text-brand-700 md:grid"
            title="Kirish animatsiyasini qayta ko'rish"
            aria-label="Kirish animatsiyasini qayta ko'rish"
          >
            <Play size={13} />
          </button>
          <button
            type="button"
            onClick={onPalette}
            className="hidden items-center gap-1.5 rounded-full border border-line bg-white/70 px-2.5 py-2 text-[10.5px] font-medium text-ink-2 backdrop-blur transition hover:border-brand-300 hover:text-brand-700 sm:flex"
            aria-label="Tezkor o'tish (⌘K)"
          >
            <Command size={12} />
            <span className="hidden md:inline">Tezkor o'tish</span>
            <span className="rounded border border-line bg-[#F7FAF9] px-1 font-mono text-[8.5px] text-muted">K</span>
          </button>
          <button
            type="button"
            onClick={() => go("prototip")}
            className={cn(
              "group hidden items-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition sm:flex",
              scrolled ? "bg-ink text-white hover:bg-brand-800" : "bg-lime text-midnight hover:bg-[#d7fa8c]",
            )}
          >
            Prototip
            <ArrowUpRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
            aria-expanded={open}
            className="grid size-9 place-items-center rounded-full border border-line bg-white/80 text-ink backdrop-blur lg:hidden"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          <p className="px-1 pb-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Ish maydoni</p>
          <div className="grid grid-cols-2 gap-1.5">
            {workspaceViews.map((v) => {
              const Icon = icons[v.icon] ?? Layers;
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => go(v.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-[11px] border px-2.5 py-2.5 text-left text-[11.5px] font-semibold transition",
                    active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
                  )}
                >
                  <Icon size={13} className={active ? "text-lime" : "text-brand-600"} />
                  {v.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 px-1 pb-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Sahifa mavzusi</p>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {canvasThemes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onCanvas(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition",
                  canvas === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2",
                )}
              >
                <span className="size-3 rounded-full" style={{ background: `conic-gradient(from 210deg, ${t.amb1}, ${t.amb2}, ${t.amb3}, ${t.amb1})` }} />
                {t.name}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => { setOpen(false); onPalette(); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] border border-line bg-white py-2.5 text-[11px] font-semibold text-ink-2">
              <Command size={12} /> Tezkor o'tish
            </button>
            <button type="button" onClick={() => { setOpen(false); onReplayIntro(); }} className="flex items-center justify-center gap-1.5 rounded-[11px] border border-line bg-white px-3 py-2.5 text-[11px] font-semibold text-ink-2">
              <Play size={12} /> Intro
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
