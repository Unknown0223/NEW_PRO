import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Code2,
  CornerDownLeft,
  Gauge,
  ClipboardCheck,
  Grid3X3,
  Layers,
  Palette,
  Search,
  Smartphone,
  Sparkles,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  roles,
  screens,
  workspaceViews,
  type RoleKey,
  type ScreenKey,
  type ViewKey,
} from "../data/design";
import { canvasThemes } from "../data/themes";
import { cn } from "../utils/cn";

const viewIcons: Record<string, LucideIcon> = {
  users: Users,
  phone: Smartphone,
  grid: Grid3X3,
  palette: Palette,
  motion: Wand2,
  gauge: Gauge,
  audit: ClipboardCheck,
  code: Code2,
};

type Item = {
  id: string;
  label: string;
  hint: string;
  group: string;
  icon: LucideIcon;
  action: () => void;
};

export default function CommandPalette({
  open,
  onClose,
  onView,
  onRole,
  onScreen,
  onCanvas,
}: {
  open: boolean;
  onClose: () => void;
  onView: (v: ViewKey) => void;
  onRole: (r: RoleKey) => void;
  onScreen: (s: ScreenKey) => void;
  onCanvas: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const viewItems: Item[] = workspaceViews.map((v) => ({
      id: `view-${v.key}`,
      label: v.label,
      hint: v.hint,
      group: "Bo'limlar",
      icon: viewIcons[v.icon] ?? Layers,
      action: () => onView(v.key),
    }));
    const roleItems: Item[] = roles.map((r) => ({
      id: `role-${r.key}`,
      label: `${r.name} ilovasi`,
      hint: `${r.screensCount} ekran · ${r.modules.slice(0, 3).join(" · ")}`,
      group: "Rollar",
      icon: Users,
      action: () => onRole(r.key),
    }));
    const screenItems: Item[] = screens.map((s) => ({
      id: `screen-${s.key}`,
      label: s.label,
      hint: s.description,
      group: s.role === "shared" ? "Umumiy ekranlar" : `${roles.find((r) => r.key === s.role)?.short ?? s.role} ekranlari`,
      icon: Layers,
      action: () => onScreen(s.key),
    }));
    const themeItems: Item[] = canvasThemes.map((t) => ({
      id: `theme-${t.id}`,
      label: `${t.name} mavzusi`,
      hint: `${t.note} · ${t.c900}`,
      group: "Sahifa mavzusi",
      icon: Palette,
      action: () => onCanvas(t.id),
    }));
    return [...viewItems, ...themeItems, ...roleItems, ...screenItems];
  }, [onView, onRole, onScreen, onCanvas]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items.slice(0, 12);
    return items
      .filter((i) => `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(query))
      .slice(0, 14);
  }, [items, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === "Enter" && filtered[cursor]) {
        e.preventDefault();
        filtered[cursor].action();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, cursor, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center px-3 pt-[9vh] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Tezkor o'tish">
      <button type="button" aria-label="Yopish" onClick={onClose} className="absolute inset-0 bg-midnight/55 backdrop-blur-[3px]" />
      <div className="view-in relative w-full max-w-[620px] overflow-hidden rounded-[20px] border border-white/60 bg-white shadow-[0_50px_100px_-30px_rgba(6,33,30,0.6)]">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={16} className="text-brand-600" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Bo'lim, rol yoki ekran qidirish…"
            className="w-full bg-transparent text-[13px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
            aria-label="Qidirish"
          />
          <span className="hidden rounded border border-line bg-[#F7FAF9] px-1.5 py-0.5 font-mono text-[9px] text-muted sm:inline">esc</span>
          <button type="button" onClick={onClose} className="grid size-6 place-items-center rounded-md text-muted hover:bg-[#F3F8F6] hover:text-ink"><X size={13} /></button>
        </div>

        <div ref={listRef} className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-10 text-center">
              <Search size={22} className="mx-auto text-line-dark" />
              <p className="mt-2 text-[12px] font-semibold text-ink">Hech narsa topilmadi</p>
              <p className="text-[10px] text-muted">Boshqa so'z bilan urinib ko'ring</p>
            </div>
          )}
          {filtered.map((item, i) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <div key={item.id}>
                {showGroup && (
                  <p className="px-2 pb-1 pt-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">{item.group}</p>
                )}
                <button
                  type="button"
                  data-idx={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition",
                    cursor === i ? "bg-ink text-white" : "text-ink-2 hover:bg-[#F5F9F7]",
                  )}
                >
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", cursor === i ? "bg-white/10 text-lime" : "bg-[#F0F6F3] text-brand-700")}>
                    <Icon size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[11.5px] font-semibold", cursor === i ? "text-white" : "text-ink")}>{item.label}</span>
                    <span className={cn("block truncate text-[9px]", cursor === i ? "text-white/50" : "text-muted")}>{item.hint}</span>
                  </span>
                  {cursor === i ? <CornerDownLeft size={12} className="shrink-0 text-lime" /> : <ArrowRight size={11} className="shrink-0 text-line-dark" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#FAFCFB] px-3 py-2 font-mono text-[8.5px] text-muted">
          <span className="flex items-center gap-2">
            <span className="rounded border border-line bg-white px-1 py-0.5">↑↓</span> harakat
            <span className="rounded border border-line bg-white px-1 py-0.5">↵</span> ochish
            <span className="rounded border border-line bg-white px-1 py-0.5">esc</span> yopish
          </span>
          <span className="flex items-center gap-1.5"><Sparkles size={9} className="text-brand-500" /> {items.length} ta natija bazasida</span>
        </div>
      </div>
    </div>
  );
}
