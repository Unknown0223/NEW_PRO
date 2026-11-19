import {
  BarChart3,
  ChevronRight,
  FileClock,
  TrendingUp,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Target,
  X
} from "lucide-react";
import type { WorkspaceTab } from "@/hooks/use-proposal";
import { cx } from "./ui";

type Props = {
  tab: WorkspaceTab;
  onTab: (tab: WorkspaceTab) => void;
  open: boolean;
  onClose: () => void;
  draftCount: number;
};

export function Sidebar({ tab, onTab, open, onClose, draftCount }: Props) {
  const go = (next: WorkspaceTab) => {
    onTab(next);
    onClose();
  };
  return (
    <>
      {open && (
        <button
          aria-label="Menyuni yopish"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cx(
          "sidebar-pattern fixed inset-y-0 left-0 z-40 flex w-[224px] flex-col bg-brand-900 text-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[72px] items-center gap-2.5 px-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white text-brand-800 shadow-xs">
            <BarChart3 size={21} strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-[19px] leading-6 font-bold tracking-[0.08em]">
              SALEC<span className="ml-0.5 text-[#a4c893]">.</span>
            </div>
            <div className="text-[8px] tracking-[0.16em] text-white/45">SAVDO BOSHQARUVI</div>
          </div>
          <button
            className="ml-auto text-white/60 lg:hidden"
            onClick={onClose}
            aria-label="Menyuni yopish"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-4 mb-6 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-[11px] font-medium text-white/90">Demo tashkilot</p>
          <p className="mt-0.5 text-[9px] text-white/40">Sinov muhiti</p>
        </div>
        <nav aria-label="Asosiy navigatsiya" className="flex-1 overflow-y-auto px-3">
          <p className="mb-2 px-3 text-[9px] font-semibold tracking-[0.14em] text-white/30">
            ISH MAYDONI
          </p>
          <div className="mb-2 flex items-center gap-3 px-3 text-xs font-semibold text-white/90">
            <Target size={16} />
            <span>Planlar</span>
          </div>
          <div className="ml-[21px] space-y-1 border-l border-white/10 pl-3">
            <button
              onClick={() => go("calculator")}
              className={cx(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[11px] font-semibold transition",
                tab === "calculator"
                  ? "bg-[#e4eddd] text-[#244b36] shadow-xs"
                  : "text-white/65 hover:bg-white/10"
              )}
            >
              <Sparkles size={14} className="shrink-0" />
              <span className="truncate">Taklifiy reja</span>
              <span className="ml-auto rounded bg-[#91ad76]/20 px-1 text-[7px] tracking-wide">
                YANGI
              </span>
            </button>
            <button
              onClick={() => go("outcomes")}
              className={cx(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[11px] transition",
                tab === "outcomes" ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10"
              )}
            >
              <TrendingUp size={13} />
              Natijalar
            </button>
            <button
              onClick={() => go("drafts")}
              className={cx(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[11px] transition",
                tab === "drafts" ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10"
              )}
            >
              <FileClock size={13} />
              Umumiy draft
              {draftCount > 0 && (
                <span className="ml-auto rounded bg-white/10 px-1.5 text-[9px]">{draftCount}</span>
              )}
            </button>
          </div>
        </nav>
        <div className="p-4">
          <button
            onClick={() => go("analysis")}
            className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
          >
            <Lightbulb size={17} className="mb-2 text-[#c5d4a3]" />
            <p className="text-[11px] font-semibold text-white/85">Qanday ishlaydi?</p>
            <p className="mt-1 text-[10px] leading-4 text-white/40">
              Hisoblash mantiqi, analiz va modul texnik rejasi
            </p>
            <span className="mt-2 flex items-center gap-1 text-[10px] text-[#c5d4a3]">
              Batafsil <ChevronRight size={11} />
            </span>
          </button>
          <div className="mt-4 flex items-center gap-2 px-1 text-[9px] text-white/30">
            <HelpCircle size={12} />
            SALEC · Taklifiy reja prototipi<span className="ml-auto">v0.5</span>
          </div>
        </div>
      </aside>
    </>
  );
}
