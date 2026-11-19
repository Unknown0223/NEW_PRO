"use client";

import { useCallback } from "react";
import type { DirectionContext, Formula, MultiProposalInput } from "@salec/plans-proposal";
import { periodLabel, previousPeriod } from "@salec/plans-proposal";
import { AUDIT_ACTOR, diffConfigs, type AuditEntry } from "@taklifiy/lib/audit";
import { writeCellFormulas, type CellRef, type ConfigMap } from "@taklifiy/lib/selection";
import {
  withAllConfigs,
  withCellFormula,
  withConfig,
  withExcluded,
  withManual
} from "@taklifiy/lib/config-ops";

type Args = {
  configs: ConfigMap;
  setConfigs: (c: ConfigMap) => void;
  setHistory: React.Dispatch<React.SetStateAction<ConfigMap[]>>;
  setAudit: React.Dispatch<React.SetStateAction<AuditEntry[]>>;
  context: DirectionContext;
  setContext: (c: DirectionContext) => void;
  input: MultiProposalInput;
  history: ConfigMap[];
  persistServer: (next: ConfigMap) => Promise<void>;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
  clearSelection: () => void;
  setRemoved: React.Dispatch<React.SetStateAction<Array<{ kpiGroupId: number; key: string }>>>;
  setDraftMeta: React.Dispatch<
    React.SetStateAction<{ id: number; version: number; name: string } | null>
  >;
};

export function useProposalEdits({
  configs,
  setConfigs,
  setHistory,
  setAudit,
  context,
  setContext,
  input,
  history,
  persistServer,
  notify,
  clearSelection,
  setRemoved,
  setDraftMeta
}: Args) {
  const commitConfigs = useCallback(
    (next: ConfigMap) => {
      const changes = diffConfigs(configs, next, input.datasets);
      setHistory((h) => [...h.slice(-19), configs]);
      setConfigs(next);
      if (changes.length) {
        setAudit((prev) => [
          ...prev,
          ...changes.map((c, i) => ({
            id: `${Date.now()}-${i}`,
            at: new Date().toISOString(),
            actor: AUDIT_ACTOR,
            contextKey: `${context.directionId}:${context.target.year}-${context.target.month}`,
            ...c
          }))
        ]);
      }
      void persistServer(next);
    },
    [configs, input.datasets, setHistory, setConfigs, setAudit, context, persistServer]
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
        notify("Tanlangan kataklar himoyalangan yoki topilmadi.", "info");
        return 0;
      }
      commitConfigs(outcome.configs);
      notify(
        `${scopeLabel ? `${scopeLabel}: ` : ""}${outcome.appliedCells.length} ta katakka formula qo‘llandi.`
      );
      return outcome.appliedCells.length;
    },
    [configs, input.datasets, commitConfigs, notify]
  );

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous) return;
    setConfigs(previous);
    setHistory((h) => h.slice(0, -1));
    void persistServer(previous);
    notify("Oxirgi o‘zgartirish bekor qilindi", "info");
  }, [history, setConfigs, setHistory, persistServer, notify]);

  const changeContext = useCallback(
    (patch: Partial<DirectionContext>) => {
      const next = { ...context, ...patch };
      if (patch.target) next.source = previousPeriod(next.target);
      setContext(next);
      setConfigs({});
      setHistory([]);
      setRemoved([]);
      setDraftMeta(null);
      clearSelection();
      notify(`${periodLabel(next.target)} konteksti yuklanmoqda…`, "info");
    },
    [
      context,
      setContext,
      setConfigs,
      setHistory,
      setRemoved,
      setDraftMeta,
      clearSelection,
      notify
    ]
  );

  const setSource = useCallback(
    (source: DirectionContext["source"]) => changeContext({ source }),
    [changeContext]
  );

  return {
    updateConfig,
    updateAllConfigs,
    setCellFormula,
    setManual,
    toggleExcluded,
    applyCellFormulas,
    undo,
    changeContext,
    setSource
  };
}
