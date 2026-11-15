import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateMultiProposal,
  combineTotals,
  periodLabel,
  previousPeriod,
  type DirectionContext,
  type Formula,
  type MultiProposalInput
} from "@salec/plans-proposal";
import { buildMultiDemoInput, directionKpiIds, KPI_GROUPS } from "@/data/demo-data";
import { AUDIT_ACTOR, diffConfigs, type AuditChange, type AuditEntry } from "@/lib/audit";
import { initialVisibleKpiIds } from "@/lib/draft-config";
import { draftKey, type SharedDraft } from "@/lib/storage";
import { downloadText } from "@/lib/format";
import { proposalCsv } from "@/lib/csv";
import { writeCellFormulas, type CellRef, type ConfigMap } from "@/lib/selection";
import {
  withAllConfigs,
  withCellFormula,
  withConfig,
  withExcluded,
  withManual
} from "@/lib/config-ops";
import { useSelection } from "./use-selection";
import { useSharedDraft } from "./use-shared-draft";

export type WorkspaceTab = "calculator" | "outcomes" | "drafts" | "analysis";
export type Toast = { message: string; tone: "success" | "error" | "info" } | null;
export type { ConfigMap } from "@/lib/selection";

function visibleIds(draft: SharedDraft): number[] {
  return draft.visibleKpiIds.length
    ? draft.visibleKpiIds
    : initialVisibleKpiIds(draft.context.directionId);
}

export function useProposal() {
  const shared = useSharedDraft();
  const patchDraft = shared.patch;
  const [context, setContext] = useState<DirectionContext>(() => shared.active.context);
  const [configs, setConfigs] = useState<ConfigMap>(
    () => JSON.parse(JSON.stringify(shared.active.configs)) as ConfigMap
  );
  const [visibleKpiIds, setVisibleKpiIds] = useState<number[]>(() => visibleIds(shared.active));
  const [history, setHistory] = useState<ConfigMap[]>([]);
  const [tab, setTab] = useState<WorkspaceTab>("calculator");
  const [toast, setToast] = useState<Toast>(
    shared.error ? { message: shared.error, tone: "error" } : null
  );

  const notify = useCallback(
    (message: string, tone: NonNullable<Toast>["tone"] = "success") => setToast({ message, tone }),
    []
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!shared.error) return;
    notify(shared.error, "error");
    shared.clearError();
  }, [shared.error, notify]);

  const allKpiIds = useMemo(() => directionKpiIds(context.directionId), [context.directionId]);
  const input: MultiProposalInput = useMemo(
    () => buildMultiDemoInput(context, configs, allKpiIds),
    [context, configs, allKpiIds]
  );
  const result = useMemo(() => calculateMultiProposal(input), [input]);
  const visibleResult = useMemo(() => {
    const kpis = result.kpis.filter((k) => visibleKpiIds.includes(k.kpiGroupId));
    return { kpis, totals: combineTotals(kpis.map((k) => k.result.totals)) };
  }, [result, visibleKpiIds]);
  const selection = useSelection(visibleKpiIds, visibleResult);

  /** Har bir o‘zgartirish darhol umumiy draftga va audit jurnaliga yoziladi. */
  const commitConfigs = useCallback(
    (next: ConfigMap) => {
      const changes = diffConfigs(configs, next, input.datasets);
      setHistory((h) => [...h.slice(-19), configs]);
      setConfigs(next);
      patchDraft({ configs: JSON.parse(JSON.stringify(next)) as ConfigMap }, changes);
    },
    [configs, input.datasets, patchDraft]
  );

  const updateConfig = useCallback(
    (kpiGroupId: number, update: Parameters<typeof withConfig>[2]) =>
      commitConfigs(withConfig(configs, kpiGroupId, update)),
    [configs, commitConfigs]
  );

  const updateAllConfigs = useCallback(
    (update: Parameters<typeof withAllConfigs>[1]) =>
      commitConfigs(withAllConfigs(configs, update)),
    [configs, commitConfigs]
  );

  const setCellFormula = useCallback(
    (kpiGroupId: number, key: string, formula: Formula | null) =>
      commitConfigs(withCellFormula(configs, kpiGroupId, key, formula)),
    [configs, commitConfigs]
  );

  const setManual = useCallback(
    (kpiGroupId: number, key: string, manual: Parameters<typeof withManual>[3]) =>
      commitConfigs(withManual(configs, kpiGroupId, key, manual)),
    [configs, commitConfigs]
  );

  const toggleExcluded = useCallback(
    (kpiGroupId: number, key: string) => commitConfigs(withExcluded(configs, kpiGroupId, key)),
    [configs, commitConfigs]
  );

  const applyCellFormulas = useCallback(
    (cells: CellRef[], formula: Formula, scopeLabel?: string) => {
      const outcome = writeCellFormulas(configs, input.datasets, cells, formula);
      if (!outcome.appliedCells.length) {
        notify("Tanlangan kataklar himoyalangan yoki topilmadi; hech narsa o‘zgarmadi.", "info");
        return 0;
      }
      commitConfigs(outcome.configs);
      const suffix = outcome.skipped
        ? ` ${outcome.skipped} ta himoyalangan katak o‘tkazib yuborildi.`
        : "";
      notify(
        `${scopeLabel ? `${scopeLabel}: ` : ""}${outcome.appliedCells.length} ta katakka formula qo‘llandi.${suffix}`
      );
      return outcome.appliedCells.length;
    },
    [configs, input.datasets, commitConfigs, notify]
  );

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    const changes: AuditChange[] = diffConfigs(configs, previous, input.datasets).map((c) => ({
      ...c,
      action: "undo"
    }));
    setConfigs(previous);
    setHistory((h) => h.slice(0, -1));
    patchDraft({ configs: JSON.parse(JSON.stringify(previous)) as ConfigMap }, changes);
    notify("Oxirgi o‘zgartirish bekor qilindi va tarixga yozildi", "info");
  }, [history, configs, input.datasets, patchDraft, notify]);

  const changeContext = useCallback(
    (patch: Partial<DirectionContext>) => {
      const next = { ...context, ...patch };
      if (patch.target) next.source = previousPeriod(next.target);
      const keyChanged = draftKey(next) !== draftKey(context);
      if (keyChanged) {
        const loaded = shared.activate(next);
        setConfigs(JSON.parse(JSON.stringify(loaded.configs)) as ConfigMap);
        setVisibleKpiIds(visibleIds(loaded));
        setHistory([]);
        notify(
          `${periodLabel(next.target)} · yo‘nalish ${next.directionId} uchun umumiy draft ochildi`,
          "info"
        );
      } else {
        patchDraft(
          { context: JSON.parse(JSON.stringify(next)) as DirectionContext },
          patch.source
            ? [
                {
                  action: "context",
                  kpiGroupId: null,
                  cellKey: null,
                  employeeName: null,
                  field: "Manba oyi",
                  before: periodLabel(context.source),
                  after: periodLabel(next.source),
                  summary: `Manba oyi ${periodLabel(context.source)} → ${periodLabel(next.source)}`
                }
              ]
            : []
        );
      }
      setContext(next);
      selection.clearSelection();
    },
    [context, shared, patchDraft, notify, selection.clearSelection]
  );

  const setSource = useCallback(
    (source: DirectionContext["source"]) => changeContext({ source }),
    [changeContext]
  );

  const toggleVisibleKpi = useCallback(
    (id: number) => {
      const next = visibleKpiIds.includes(id)
        ? visibleKpiIds.length > 1
          ? visibleKpiIds.filter((x) => x !== id)
          : visibleKpiIds
        : [...visibleKpiIds, id].sort((a, b) => a - b);
      setVisibleKpiIds(next);
      patchDraft({ visibleKpiIds: [...next] }, [
        {
          action: "visibility",
          kpiGroupId: null,
          cellKey: null,
          employeeName: null,
          field: "Ko‘rinadigan KPI ustunlari",
          before: visibleKpiIds.join(", "),
          after: next.join(", "),
          summary: `Ko‘rinadigan KPI ustunlari: ${next.length} ta`
        }
      ]);
    },
    [visibleKpiIds, patchDraft]
  );

  const deleteDraftRow = useCallback(
    (kpiGroupId: number, key: string, employeeName: string) => {
      const exists = shared.active.removed.some(
        (r) => r.kpiGroupId === kpiGroupId && r.key === key
      );
      if (exists) return;
      patchDraft({ removed: [...shared.active.removed, { kpiGroupId, key }] }, [
        {
          action: "delete",
          kpiGroupId,
          cellKey: key,
          employeeName,
          field: "Draft qatori",
          before: "Jadvalda bor",
          after: "O‘chirilgan",
          summary: `${employeeName} · KPI ${kpiGroupId} qatori umumiy draftdan o‘chirildi`
        }
      ]);
      notify(`${employeeName} · KPI ${kpiGroupId} qatori o‘chirildi`, "info");
    },
    [shared.active.removed, patchDraft, notify]
  );

  const restoreDraftRow = useCallback(
    (kpiGroupId: number, key: string, employeeName: string) => {
      patchDraft(
        {
          removed: shared.active.removed.filter(
            (r) => !(r.kpiGroupId === kpiGroupId && r.key === key)
          )
        },
        [
          {
            action: "restore",
            kpiGroupId,
            cellKey: key,
            employeeName,
            field: "Draft qatori",
            before: "O‘chirilgan",
            after: "Jadvalda bor",
            summary: `${employeeName} · KPI ${kpiGroupId} qatori qayta tiklandi`
          }
        ]
      );
      notify("Qator jadvalga qaytarildi", "info");
    },
    [shared.active.removed, patchDraft, notify]
  );

  const restoreAllRows = useCallback(() => {
    patchDraft({ removed: [] }, [
      {
        action: "restore",
        kpiGroupId: null,
        cellKey: null,
        employeeName: null,
        field: "Barcha qatorlar",
        before: `${shared.active.removed.length} ta o‘chirilgan`,
        after: "To‘liq jadval",
        summary: "Barcha o‘chirilgan qatorlar tiklandi"
      }
    ]);
    notify("Barcha qatorlar tiklandi", "info");
  }, [shared.active.removed, patchDraft, notify]);

  const renameDraft = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      patchDraft({ name: clean }, [
        {
          action: "rename",
          kpiGroupId: null,
          cellKey: null,
          employeeName: null,
          field: "Draft nomi",
          before: shared.active.name,
          after: clean,
          summary: `Draft nomi «${shared.active.name}» → «${clean}»`
        }
      ]);
      notify("Umumiy draft nomi yangilandi");
    },
    [shared.active.name, patchDraft, notify]
  );

  const deleteDraft = useCallback(() => {
    const fresh = shared.resetActive(context);
    setContext(fresh.context);
    setConfigs(JSON.parse(JSON.stringify(fresh.configs)) as ConfigMap);
    setVisibleKpiIds(visibleIds(fresh));
    selection.clearSelection();
    setHistory([]);
    notify("Umumiy draft o‘chirildi va qayta yaratildi", "info");
  }, [shared, context, selection.clearSelection, notify]);

  const importDraft = useCallback(
    (draft: SharedDraft) => {
      const imported = shared.importDraft(draft);
      setContext(imported.context);
      setConfigs(JSON.parse(JSON.stringify(imported.configs)) as ConfigMap);
      setVisibleKpiIds(visibleIds(imported));
      selection.clearSelection();
      setHistory([]);
      setTab("drafts");
      notify(`«${imported.name}» umumiy draft sifatida yuklandi`);
    },
    [shared, selection.clearSelection, notify]
  );

  const exportCsv = useCallback(() => {
    downloadText(
      `salec-taklif-${context.target.year}-${String(context.target.month).padStart(2, "0")}-dir-${context.directionId}.csv`,
      proposalCsv(input, result, visibleKpiIds, KPI_GROUPS),
      "text/csv;charset=utf-8"
    );
    notify("CSV eksport qilindi. Eksport tasdiqlash yoki DB yozuvi emas.");
  }, [context, input, result, visibleKpiIds, notify]);

  const audit: AuditEntry[] = shared.audit;
  return {
    context,
    configs,
    input,
    result,
    visibleResult,
    visibleKpiIds,
    allKpiIds,
    tab,
    setTab,
    ...selection,
    updateConfig,
    updateAllConfigs,
    setCellFormula,
    setManual,
    toggleExcluded,
    applyCellFormulas,
    history,
    undo,
    changeContext,
    setSource,
    toggleVisibleKpi,
    sharedDraft: shared.active,
    sharedDrafts: shared.drafts,
    audit,
    auditActor: AUDIT_ACTOR,
    deleteDraftRow,
    restoreDraftRow,
    restoreAllRows,
    renameDraft,
    deleteDraft,
    importDraft,
    exportCsv,
    toast,
    setToast,
    notify
  };
}

export type ProposalController = ReturnType<typeof useProposal>;
