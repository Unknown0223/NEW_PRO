"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  calculateMultiProposal,
  combineTotals,
  DEFAULT_CONFIG,
  employeeKey,
  previousPeriod,
  type DirectionContext,
  type MultiProposalInput,
  type ProposalConfig
} from "@salec/plans-proposal";
import { useAuthStore } from "@/lib/auth-store";
import { AUDIT_ACTOR, type AuditEntry } from "@taklifiy/lib/audit";
import { downloadText } from "@taklifiy/lib/format";
import { proposalCsv } from "@taklifiy/lib/csv";
import type { ConfigMap } from "@taklifiy/lib/selection";
import { useSelection } from "./use-selection";
import { useProposalEdits } from "./use-proposal-edits";
import {
  applyProposalDraft,
  fetchProposalContext,
  fetchProposalDraft,
  proposalKeys,
  saveProposalDraft,
  type ProposalContextData
} from "@taklifiy/lib/proposals-api";

export type WorkspaceTab = "calculator" | "outcomes" | "drafts";
export type Toast = { message: string; tone: "success" | "error" | "info" } | null;
export type { ConfigMap } from "@taklifiy/lib/selection";

function emptyContext(directionId = 1): DirectionContext {
  const d = new Date();
  const target = { year: d.getFullYear(), month: d.getMonth() + 1 };
  return {
    tenantId: 1,
    directionId,
    target,
    source: previousPeriod(target),
    metric: "cost"
  };
}

export function useProposal() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  const [context, setContext] = useState<DirectionContext>(() => emptyContext());
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [visibleKpiIds, setVisibleKpiIds] = useState<number[]>([]);
  const [history, setHistory] = useState<ConfigMap[]>([]);
  const [tab, setTab] = useState<WorkspaceTab>("calculator");
  const [toast, setToast] = useState<Toast>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [draftMeta, setDraftMeta] = useState<{ id: number; version: number; name: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [removed, setRemoved] = useState<Array<{ kpiGroupId: number; key: string }>>([]);

  const notify = useCallback(
    (message: string, tone: NonNullable<Toast>["tone"] = "success") => setToast({ message, tone }),
    []
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  const contextQ = useQuery({
    queryKey: proposalKeys.context(
      tenantSlug,
      context.directionId,
      context.target,
      context.source
    ),
    queryFn: () =>
      fetchProposalContext(tenantSlug!, context.directionId, context.target, context.source),
    enabled: Boolean(tenantSlug),
    staleTime: 30_000
  });

  const draftQ = useQuery({
    queryKey: proposalKeys.draft(tenantSlug, context.directionId, context.target),
    queryFn: () => fetchProposalDraft(tenantSlug!, context.directionId, context.target),
    enabled: Boolean(tenantSlug),
    staleTime: 15_000
  });

  useEffect(() => {
    const data = contextQ.data;
    if (!data) return;
    if (data.direction_id && data.direction_id !== context.directionId) {
      setContext((prev) => ({ ...prev, directionId: data.direction_id }));
      return;
    }
    const ids = data.kpi_groups.map((g) => g.id);
    setVisibleKpiIds((prev) => (prev.length ? prev.filter((id) => ids.includes(id)) : ids));
    setConfigs((prev) => {
      if (Object.keys(prev).length) return prev;
      const next: ConfigMap = {};
      for (const g of data.kpi_groups) {
        next[String(g.id)] = structuredClone(
          data.default_configs[String(g.id)] ?? DEFAULT_CONFIG
        ) as ProposalConfig;
      }
      return next;
    });
  }, [contextQ.data, context.directionId]);

  useEffect(() => {
    const d = draftQ.data;
    if (!d) {
      setDraftMeta(null);
      return;
    }
    setDraftMeta({ id: d.id, version: d.version, name: `Draft #${d.id}` });
    if (d.config && typeof d.config === "object" && Object.keys(d.config).length > 0) {
      setConfigs(JSON.parse(JSON.stringify(d.config)) as ConfigMap);
    }
  }, [draftQ.data]);

  const live: ProposalContextData | undefined = contextQ.data;
  const kpiGroups = live?.kpi_groups ?? [];
  const allKpiIds = useMemo(() => kpiGroups.map((g) => g.id), [kpiGroups]);

  const input: MultiProposalInput = useMemo(() => {
    const datasets = (live?.datasets ?? []).map((d) => ({
      kpiGroupId: d.kpiGroupId,
      employees: d.employees.filter(
        (e) =>
          !removed.some(
            (r) =>
              r.kpiGroupId === d.kpiGroupId &&
              r.key === employeeKey(e.employeeId, e.workSlotId)
          )
      )
    }));
    const cfg: ConfigMap = { ...configs };
    for (const d of datasets) {
      if (!cfg[String(d.kpiGroupId)]) {
        cfg[String(d.kpiGroupId)] = structuredClone(DEFAULT_CONFIG) as ProposalConfig;
      }
    }
    return {
      context: {
        tenantId: context.tenantId,
        directionId: context.directionId,
        target: context.target,
        source: context.source,
        metric: "cost" as const
      },
      configs: cfg,
      datasets
    };
  }, [live, configs, context, removed]);

  const result = useMemo(() => {
    if (!input.datasets.length) return { kpis: [], totals: combineTotals([]) };
    try {
      return calculateMultiProposal(input);
    } catch {
      return { kpis: [], totals: combineTotals([]) };
    }
  }, [input]);

  const visibleResult = useMemo(() => {
    const kpis = result.kpis.filter((k) => visibleKpiIds.includes(k.kpiGroupId));
    return { kpis, totals: combineTotals(kpis.map((k) => k.result.totals)) };
  }, [result, visibleKpiIds]);

  const selection = useSelection(visibleKpiIds, visibleResult);

  const persistServer = useCallback(
    async (nextConfigs: ConfigMap) => {
      if (!tenantSlug) return;
      setSaving(true);
      try {
        const saved = await saveProposalDraft(tenantSlug, {
          direction_id: context.directionId,
          target: context.target,
          source: context.source,
          configs: nextConfigs
        });
        setDraftMeta({ id: saved.id, version: saved.version, name: `Draft #${saved.id}` });
        void qc.invalidateQueries({
          queryKey: proposalKeys.draft(tenantSlug, context.directionId, context.target)
        });
      } catch (e) {
        notify(e instanceof Error ? e.message : "Draft saqlanmadi", "error");
      } finally {
        setSaving(false);
      }
    },
    [tenantSlug, context, qc, notify]
  );

  const edits = useProposalEdits({
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
    clearSelection: selection.clearSelection,
    setRemoved,
    setDraftMeta
  });

  const toggleVisibleKpi = useCallback((id: number) => {
    setVisibleKpiIds((prev) => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter((x) => x !== id) : prev;
      return [...prev, id].sort((a, b) => a - b);
    });
  }, []);

  const deleteDraftRow = useCallback(
    (kpiGroupId: number, key: string, _n?: string) => {
      setRemoved((r) => [...r, { kpiGroupId, key }]);
      notify("Qator draftdan olib tashlandi", "info");
    },
    [notify]
  );
  const restoreDraftRow = useCallback((kpiGroupId: number, key: string, _n?: string) => {
    setRemoved((r) => r.filter((x) => !(x.kpiGroupId === kpiGroupId && x.key === key)));
  }, []);
  const restoreAllRows = useCallback(() => setRemoved([]), []);
  const renameDraft = useCallback(
    (name: string) => {
      if (draftMeta) setDraftMeta({ ...draftMeta, name });
      notify("Draft nomi yangilandi");
    },
    [draftMeta, notify]
  );
  const deleteDraft = useCallback(() => {
    setConfigs({});
    setRemoved([]);
    setHistory([]);
    setDraftMeta(null);
    notify("Draft tozalandi", "info");
  }, [notify]);
  const importDraft = useCallback(
    (_draft: unknown) => notify("Server draft JSON import hozircha o‘chirilgan", "info"),
    [notify]
  );

  const exportCsv = useCallback(() => {
    downloadText(
      `salec-taklif-${context.target.year}-${String(context.target.month).padStart(2, "0")}.csv`,
      proposalCsv(
        input,
        result,
        visibleKpiIds,
        kpiGroups.map((g) => ({ id: g.id, name: g.name }))
      ),
      "text/csv;charset=utf-8"
    );
    notify("CSV eksport qilindi");
  }, [context, input, result, visibleKpiIds, kpiGroups, notify]);

  const applyDraft = useCallback(async () => {
    if (!tenantSlug || !draftMeta) {
      notify("Avval draftni saqlang", "info");
      return;
    }
    setSaving(true);
    try {
      await applyProposalDraft(tenantSlug, draftMeta.id, draftMeta.version);
      notify("Tayyor qatorlar draft targetlarga yozildi");
      void qc.invalidateQueries({
        queryKey: proposalKeys.draft(tenantSlug, context.directionId, context.target)
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : "Apply muvaffaqiyatsiz", "error");
    } finally {
      setSaving(false);
    }
  }, [tenantSlug, draftMeta, context, qc, notify]);

  const sharedDraft = {
    key: `${context.directionId}:${context.target.year}-${context.target.month}`,
    name: draftMeta?.name ?? "Umumiy draft",
    context,
    configs,
    visibleKpiIds,
    removed,
    updatedAt: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    updatedBy: AUDIT_ACTOR
  };

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
    ...edits,
    history,
    toggleVisibleKpi,
    sharedDraft,
    sharedDrafts: draftMeta ? [sharedDraft] : [],
    audit,
    auditActor: AUDIT_ACTOR,
    deleteDraftRow,
    restoreDraftRow,
    restoreAllRows,
    renameDraft,
    deleteDraft,
    importDraft,
    exportCsv,
    applyDraft,
    toast,
    setToast,
    notify,
    loading: contextQ.isLoading || draftQ.isLoading,
    saving,
    liveMeta: live
      ? {
          directions: live.directions,
          kpiGroups: live.kpi_groups,
          sourceMeta: live.source_meta,
          snapshotHash: live.snapshot_hash
        }
      : null,
    draftId: draftMeta?.id ?? null,
    draftVersion: draftMeta?.version ?? null,
    error: contextQ.error instanceof Error ? contextQ.error.message : null
  };
}

export type ProposalController = ReturnType<typeof useProposal>;
