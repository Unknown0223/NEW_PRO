import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Download,
  Info,
  Menu,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Undo2,
  X
} from "lucide-react";
import { periodKey } from "@salec/plans-proposal";
import { useProposal, type WorkspaceTab } from "@/hooks/use-proposal";
import { DEMO_TODAY } from "@/data/demo-data";
import { Sidebar } from "@/components/sidebar";
import { ContextBar } from "@/components/context-bar";
import { SummaryCards } from "@/components/summary-cards";
import { KpiColumns } from "@/components/kpi-columns";
import { BulkBar } from "@/components/bulk-bar";
import { BlocksView } from "@/components/blocks-view";
import { RowDrawer, type InspectState } from "@/components/row-drawer";
import { SettingsModal } from "@/components/settings-modal";
import { OutcomePanel } from "@/components/outcome-panel";
import { DraftsPanel } from "@/components/drafts-panel";
import { AnalysisPanel } from "@/components/analysis-panel";
import { Badge, Button, cx } from "@/components/ui";

const TITLES: Record<WorkspaceTab, { title: string; subtitle: string }> = {
  calculator: {
    title: "Taklifiy reja",
    subtitle: "Filial bloklari, barcha KPI ustunlari va jadval ichida bevosita tahrirlash."
  },
  outcomes: {
    title: "Takliflar natijasi",
    subtitle:
      "Yopilgan oy fakti bilan solishtirilgan tahlil: qaysi taklif o‘zini oqladi, qaysi biri oqlanmadi."
  },
  drafts: {
    title: "Umumiy taklifiy reja drafti",
    subtitle:
      "Hamma uchun bitta tayyor jadval: tahrirlash, o‘chirish va kim / qachon / nima tarixi."
  },
  analysis: {
    title: "Analiz va yo‘riqnoma",
    subtitle: "Hisoblash mantiqi, mavjud modul tahlili va qo‘lda sinov rejasi."
  }
};

export function App() {
  const c = useProposal();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspect, setInspect] = useState<InspectState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const meta = TITLES[c.tab];
  const partial = periodKey(c.context.source) >= DEMO_TODAY.slice(0, 7);
  const sourceFuture = periodKey(c.context.source) > DEMO_TODAY.slice(0, 7);
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        tab={c.tab}
        onTab={c.setTab}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        draftCount={c.sharedDrafts.length}
      />
      <div className="lg:pl-[224px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#e3e9e5] bg-white/95 px-4 backdrop-blur-sm sm:px-6">
          <button
            className="icon-btn lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menyuni ochish"
          >
            <Menu size={19} />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-[11px] text-[#98a49c]"
          >
            <span className="hidden sm:inline">Ish maydoni</span>
            <ChevronRight size={11} className="hidden sm:block" />
            <span>Planlar</span>
            <ChevronRight size={11} />
            <span className="truncate font-medium text-[#596f60]">{meta.title}</span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Badge tone="amber" className="hidden sm:inline-flex">
              <span className="size-1 rounded-full bg-amber-500" /> DEMO
            </Badge>
            <span className="hidden text-[10px] text-[#9ba69f] md:inline">14 noyabr, 2026</span>
            <span className="hidden h-5 w-px bg-[#e5ebe7] sm:block" />
            <Bell size={16} className="text-[#9baa9f]" />
            <span className="flex size-7 items-center justify-center rounded-full border border-[#dce6dd] bg-[#edf3e9] text-[9px] font-bold text-[#64805d]">
              PL
            </span>
            <div className="hidden leading-4 sm:block">
              <p className="text-[10px] font-semibold text-[#607465]">Planlovchi</p>
              <p className="text-[8px] text-[#a0aaa3]">Demo sessiya</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1660px] px-4 py-6 sm:px-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <h1 className="text-[25px] leading-8 font-bold tracking-[-0.035em] text-[#243f31]">
                  {meta.title}
                </h1>
                {c.tab === "calculator" && (
                  <span className="rounded-md border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-brand-600">
                    YANGI MODUL
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-5 text-[#8b9a90]">{meta.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => c.setTab("analysis")}>
                <Info size={13} /> Qanday ishlaydi?
              </Button>
              {c.tab === "calculator" && (
                <>
                  <Button variant="ghost" disabled={!c.history.length} onClick={c.undo}>
                    <Undo2 size={13} /> Bekor qilish
                  </Button>
                  <Button onClick={() => setSettingsOpen(true)}>
                    <Settings2 size={13} /> Sozlamalar
                  </Button>
                  <Button onClick={c.exportCsv}>
                    <Download size={13} /> CSV eksport
                  </Button>
                  <Button variant="primary" onClick={() => c.setTab("drafts")}>
                    <Save size={13} /> Umumiy draft
                  </Button>
                </>
              )}
            </div>
          </div>
          <div
            className="mb-5 flex gap-1 overflow-x-auto border-b border-[#e0e8e2]"
            role="tablist"
            aria-label="Taklifiy reja bo‘limlari"
          >
            {(
              [
                { id: "calculator", label: "Hisob-kitob", Icon: Sparkles },
                { id: "outcomes", label: "Oqlash tahlili", Icon: TrendingUp },
                { id: "drafts", label: "Umumiy draft", Icon: Save },
                { id: "analysis", label: "Analiz va qoidalar", Icon: Info }
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={c.tab === id}
                onClick={() => c.setTab(id)}
                className={cx(
                  "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition",
                  c.tab === id
                    ? "text-brand-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-600"
                    : "text-[#97a49b] hover:text-brand-600"
                )}
              >
                <Icon size={13} />
                {label}
                {id === "drafts" && c.sharedDrafts.length > 0 && (
                  <span className="rounded bg-brand-50 px-1 text-[9px] text-brand-600">
                    {c.sharedDrafts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {c.tab === "calculator" && (
            <div className="animate-enter space-y-4">
              <ContextBar c={c} />
              {partial && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3.5 py-2.5">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <p className="flex-1 text-[10px] leading-4 text-amber-800">
                    {sourceFuture ? (
                      <>
                        <strong>Manba oyi hali kelmagan.</strong> Bu oy uchun fakt va reja yo‘q.
                        Iltimos, oldingi yopilgan oyga o‘ting.
                      </>
                    ) : (
                      <>
                        <strong>Manba oyi to‘liq emas.</strong> Noyabr fakti 14.11.2026 holatiga
                        ko‘ra MTD. Uni to‘liq oy deb ishlatmang — yakunlangan oyga o‘ting yoki
                        sozlamalarda prognozni yoqing.
                      </>
                    )}
                  </p>
                  <button
                    onClick={() =>
                      c.setSource(
                        c.context.target.year > 2026 || c.context.target.month > 1
                          ? { year: 2026, month: 10 }
                          : {
                              year: c.context.target.month === 1 ? 2025 : 2026,
                              month: c.context.target.month === 1 ? 12 : c.context.target.month - 1
                            }
                      )
                    }
                    className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 hover:text-amber-950"
                  >
                    Yopilgan oyga o‘tish <ArrowRight size={11} />
                  </button>
                </div>
              )}
              <SummaryCards c={c} />
              <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <KpiColumns c={c} />
                <span className="text-[10px] text-[#93a198]">
                  Default holatda filiallar yig‘ilgan. Bir blok ochilsa, avvalgisi yopiladi.
                </span>
              </div>
              <BulkBar c={c} onClear={c.clearSelection} />
              <BlocksView c={c} onInspect={(key, kpiGroupId) => setInspect({ key, kpiGroupId })} />
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] leading-4 text-[#9aa79e]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Sintetik demo · production rejalariga yozilmaydi
                </span>
                <span>Manba: KPI sof fakt / tasdiqlangan reja · Valyuta: UZS</span>
              </div>
            </div>
          )}
          {c.tab === "outcomes" && <OutcomePanel c={c} />}
          {c.tab === "drafts" && <DraftsPanel c={c} />}
          {c.tab === "analysis" && <AnalysisPanel c={c} />}
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3eae5] pt-4 text-[9px] text-[#a3aea7]">
            <span>SALEC · Taklifiy reja prototipi</span>
            <span>Hisoblash yadrosi: @salec/plans-proposal · v0.5</span>
          </footer>
        </main>
      </div>
      <RowDrawer c={c} state={inspect} onClose={() => setInspect(null)} />
      <SettingsModal c={c} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {c.toast && (
        <div
          role="status"
          className={cx(
            "animate-enter fixed right-5 bottom-5 z-50 flex max-w-[420px] items-start gap-2.5 rounded-xl border bg-white p-4 shadow-xl",
            c.toast.tone === "error" ? "border-red-200" : "border-brand-200"
          )}
        >
          {c.toast.tone === "error" ? (
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-500" />
          ) : c.toast.tone === "info" ? (
            <Info size={17} className="mt-0.5 shrink-0 text-sky-500" />
          ) : (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-brand-500" />
          )}
          <p className="text-xs leading-5 text-[#657c6c]">{c.toast.message}</p>
          <button
            className="icon-btn -mt-1 -mr-1 shrink-0"
            onClick={() => c.setToast(null)}
            aria-label="Xabarni yopish"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
