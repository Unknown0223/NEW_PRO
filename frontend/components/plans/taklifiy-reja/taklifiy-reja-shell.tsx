"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Info,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Undo2,
  X
} from "lucide-react";
import Link from "next/link";
import { previousPeriod } from "@salec/plans-proposal";
import { useProposal, type WorkspaceTab } from "@taklifiy/hooks/use-proposal";
import { ContextBar } from "@taklifiy/components/context-bar";
import { SummaryCards } from "@taklifiy/components/summary-cards";
import { KpiColumns } from "@taklifiy/components/kpi-columns";
import { BulkBar } from "@taklifiy/components/bulk-bar";
import { BlocksView } from "@taklifiy/components/blocks-view";
import { RowDrawer, type InspectState } from "@taklifiy/components/row-drawer";
import { SettingsModal } from "@taklifiy/components/settings-modal";
import { OutcomePanel } from "@taklifiy/components/outcome-panel";
import { DraftsPanel } from "@taklifiy/components/drafts-panel";
import { Badge, Button, cx } from "@taklifiy/components/ui";
import { cn } from "@/lib/utils";
import "./taklifiy-reja.css";

export const TAKLIFIY_TABS: Array<{
  id: WorkspaceTab;
  href: string;
  label: string;
  Icon: typeof Sparkles;
}> = [
  { id: "calculator", href: "/plans/taklifiy-reja", label: "Расчёт", Icon: Sparkles },
  {
    id: "outcomes",
    href: "/plans/taklifiy-reja/natijalar",
    label: "Анализ обоснования",
    Icon: TrendingUp
  },
  { id: "drafts", href: "/plans/taklifiy-reja/draft", label: "Общий черновик", Icon: Save }
];

const TITLES: Record<WorkspaceTab, { title: string; subtitle: string }> = {
  calculator: {
    title: "Предлагаемый план",
    subtitle: "Filial → supervayzer bloklari. KPI ustunida sof fakt / eski reja (shu KPI mahsulotlari)."
  },
  outcomes: {
    title: "Анализ обоснования",
    subtitle: "Yopilgan oy: qaysi taklif usuli faktga yaqinroq."
  },
  drafts: {
    title: "Общий черновик",
    subtitle: "Davr + yo‘nalish uchun bitta jadval va audit."
  }
};

type Props = { tab: WorkspaceTab };

export function TaklifiyRejaShell({ tab }: Props) {
  const router = useRouter();
  const c = useProposal();
  const { setTab } = c;
  const [inspect, setInspect] = useState<InspectState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const meta = TITLES[tab];
  const sourceStatus = c.liveMeta?.sourceMeta.status;
  const partial = sourceStatus === "provisional";
  const sourceFuture = false;

  useEffect(() => {
    setTab(tab);
  }, [tab, setTab]);

  const go = (next: WorkspaceTab) => {
    const href = TAKLIFIY_TABS.find((t) => t.id === next)?.href ?? "/plans/taklifiy-reja";
    setTab(next);
    router.push(href);
  };

  return (
    <div className="taklifiy-root space-y-3">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-800">{meta.title}</h1>
              <Badge tone={c.liveMeta ? "green" : "amber"}>{c.liveMeta ? "LIVE" : "…"}</Badge>
              {c.saving ? <Badge tone="neutral">Saqlanmoqda…</Badge> : null}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{meta.subtitle}</p>
            {c.error ? <p className="mt-1 text-[11px] text-red-600">{c.error}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab === "calculator" && (
              <>
                <Button variant="ghost" disabled={!c.history.length} onClick={c.undo}>
                  <Undo2 size={13} /> Bekor qilish
                </Button>
                <Button onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={13} /> Sozlamalar
                </Button>
                <Button onClick={c.exportCsv}>
                  <Download size={13} /> CSV
                </Button>
                <Button variant="primary" onClick={() => go("drafts")}>
                  <Save size={13} /> Общий черновик
                </Button>
              </>
            )}
            <Link
              href="/plans/setup"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            >
              Установка планов
            </Link>
          </div>
        </div>

        <div
          className="flex gap-1 overflow-x-auto border-b border-slate-200"
          role="tablist"
          aria-label="Разделы предлагаемого плана"
        >
          {TAKLIFIY_TABS.map(({ id, href, label, Icon }) => (
            <Link
              key={id}
              href={href}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition",
                tab === id
                  ? "text-teal-800 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-teal-600"
                  : "text-slate-500 hover:text-teal-700"
              )}
            >
              <Icon size={13} />
              {label}
              {id === "drafts" && c.sharedDrafts.length > 0 && (
                <span className="rounded bg-teal-50 px-1 text-[9px] text-teal-700">
                  {c.sharedDrafts.length}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {tab === "calculator" && (
        <div className="space-y-3">
          <ContextBar c={c} />
          {partial && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <AlertTriangle size={14} className="shrink-0 text-amber-600" />
              <p className="flex-1 text-[11px] leading-4 text-amber-900">
                {sourceFuture ? (
                  <>
                    <strong>Исходный месяц ещё не наступил.</strong> Выберите предыдущий закрытый
                    месяц.
                  </>
                ) : (
                  <>
                    <strong>Исходный месяц неполный (MTD).</strong> Выберите закрытый месяц или
                    включите прогноз в настройках.
                    {c.liveMeta
                      ? ` ${c.liveMeta.sourceMeta.observedDays}/${c.liveMeta.sourceMeta.daysInMonth} дн.`
                      : null}
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => c.setSource(previousPeriod(c.context.target))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:text-amber-950"
              >
                Закрытый месяц <ArrowRight size={11} />
              </button>
            </div>
          )}
          {c.loading ? (
            <p className="px-1 text-[11px] text-slate-500">Загрузка контекста…</p>
          ) : c.liveMeta && c.liveMeta.directions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] text-amber-900">
              Нет активного направления торговли. Сначала создайте направление в справочнике, затем
              вернитесь на эту страницу.
            </div>
          ) : c.allKpiIds.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11px] text-amber-900">
              Для направления нет KPI-групп. Настройте KPI и агентов в «Установка планов», затем
              обновите страницу.
            </div>
          ) : (
            <>
              <SummaryCards c={c} />
              <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <KpiColumns c={c} />
                <span className="text-[10px] text-slate-400">
                  Филиалы свёрнуты по умолчанию · открытие одного блока закрывает предыдущий
                </span>
              </div>
              <BulkBar c={c} onClear={c.clearSelection} />
              <BlocksView c={c} onInspect={(key, kpiGroupId) => setInspect({ key, kpiGroupId })} />
            </>
          )}
          <p className="flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-400">
            <ShieldCheck size={12} /> Live · запись только в draft-цели · UZS
          </p>
        </div>
      )}
      {tab === "outcomes" && <OutcomePanel c={c} />}
      {tab === "drafts" && <DraftsPanel c={c} />}

      <RowDrawer c={c} state={inspect} onClose={() => setInspect(null)} />
      <SettingsModal c={c} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {c.toast && (
        <div
          role="status"
          className={cx(
            "fixed right-5 bottom-5 z-50 flex max-w-[420px] items-start gap-2.5 rounded-lg border bg-white p-4 shadow-lg",
            c.toast.tone === "error" ? "border-red-200" : "border-slate-200"
          )}
        >
          {c.toast.tone === "error" ? (
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-500" />
          ) : c.toast.tone === "info" ? (
            <Info size={17} className="mt-0.5 shrink-0 text-sky-500" />
          ) : (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-teal-600" />
          )}
          <p className="text-xs leading-5 text-slate-600">{c.toast.message}</p>
          <button
            type="button"
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
