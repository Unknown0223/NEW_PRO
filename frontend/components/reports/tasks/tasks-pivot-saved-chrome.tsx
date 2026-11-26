"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Loader2, Save } from "lucide-react";
import type { PivotConfig } from "@salec/pivot-engine";
import { SavedPivotReportItem } from "@/components/reports/saved-pivot-report-item";
import { SharePivotReportDialog } from "@/components/reports/share-pivot-report-dialog";
import { VirtualPivotToolbarButton as ToolbarButton } from "@/components/reports/virtual-pivot-toolbar-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { canSavePivotConfig } from "@/lib/pivot-layout-form";
import {
  TASKS_PIVOT_DATASET_ID,
  deletePivotConfigReport,
  fetchReportBuilderSavedReports,
  fetchReportBuilderShareCandidates,
  savePivotConfigReport,
  savedReportConfigToPivotConfig,
  sharePivotConfigReport,
  updatePivotConfigReport
} from "@/lib/pivot-bridge";
import { useAuthStore } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { getUserFacingError } from "@/lib/error-utils";

type Props = {
  config: PivotConfig;
  onLoadConfig: (next: PivotConfig) => void;
};

/** Отчёты / Сохр. как / Поделиться — tasks Virtual Pivot. */
export function TasksPivotSavedChrome({ config, onLoadConfig }: Props) {
  const perms = usePermissions();
  const canSave = perms.has("reports.otchet_po_zadacham.view");
  const canShare = perms.has("reports.otchet_po_zadacham.view");
  const canDelete = perms.has("reports.otchet_po_zadacham.view");
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();

  const [reportsOpen, setReportsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareId, setShareId] = useState<number | null>(null);
  const [shareName, setShareName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedQ = useQuery({
    queryKey: ["tasks-pivot-saved", tenantSlug],
    enabled: Boolean(tenantSlug) && (reportsOpen || saveOpen),
    staleTime: STALE.reference,
    queryFn: () => fetchReportBuilderSavedReports(tenantSlug!)
  });

  const tasksSaved = useMemo(
    () => (savedQ.data ?? []).filter((r) => r.dataset_id === TASKS_PIVOT_DATASET_ID),
    [savedQ.data]
  );

  const dirty =
    activeId != null && baseline != null && JSON.stringify(config) !== baseline;

  const shareCandidatesQ = useQuery({
    queryKey: ["tasks-pivot-share-candidates", tenantSlug],
    enabled: Boolean(tenantSlug) && shareOpen,
    staleTime: STALE.reference,
    queryFn: () => fetchReportBuilderShareCandidates(tenantSlug!)
  });

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["tasks-pivot-saved", tenantSlug] });
  }, [qc, tenantSlug]);

  const saveMut = useMutation({
    mutationFn: async (args: { name: string; overwriteId?: number }) => {
      if (!tenantSlug) throw new Error("NO_TENANT");
      if (args.overwriteId != null) {
        return updatePivotConfigReport(tenantSlug, args.overwriteId, args.name, config, {
          datasetId: TASKS_PIVOT_DATASET_ID
        });
      }
      return savePivotConfigReport(tenantSlug, args.name, config, {
        datasetId: TASKS_PIVOT_DATASET_ID
      });
    },
    onSuccess: (row) => {
      setActiveId(row.id);
      setBaseline(JSON.stringify(config));
      setSaveOpen(false);
      setNotice(`Сохранено: ${row.name}`);
      setError(null);
      invalidate();
    },
    onError: (e) => setError(getUserFacingError(e))
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      if (!tenantSlug) throw new Error("NO_TENANT");
      await deletePivotConfigReport(tenantSlug, id);
    },
    onSuccess: (_v, id) => {
      if (activeId === id) {
        setActiveId(null);
        setBaseline(null);
      }
      invalidate();
    },
    onError: (e) => setError(getUserFacingError(e))
  });

  const shareMut = useMutation({
    mutationFn: async (args: { id: number; userIds: number[] }) => {
      if (!tenantSlug) throw new Error("NO_TENANT");
      return sharePivotConfigReport(tenantSlug, args.id, args.userIds);
    },
    onSuccess: (result) => {
      setShareOpen(false);
      setNotice(`Отчёт отправлен ${result.sharedCount.toLocaleString("ru-RU")} пользователям.`);
    },
    onError: (e) => setError(getUserFacingError(e))
  });

  const loadSaved = useCallback(
    (id: number, raw: unknown) => {
      const next = savedReportConfigToPivotConfig(raw);
      if (!next) {
        setError("Не удалось открыть сохранённый отчёт");
        return;
      }
      onLoadConfig(next);
      setActiveId(id);
      setBaseline(JSON.stringify(next));
      setReportsOpen(false);
      setNotice(null);
      setError(null);
    },
    [onLoadConfig]
  );

  return (
    <>
      <ToolbarButton
        icon={<FolderOpen />}
        label="Отчёты"
        onClick={() => {
          setReportsOpen(true);
          setNotice(null);
        }}
      />
      <ToolbarButton
        icon={saveMut.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        label="Сохр. как"
        disabled={!canSave || !canSavePivotConfig(config) || saveMut.isPending}
        onClick={() => {
          setSaveName("");
          setSaveOpen(true);
          setError(null);
        }}
      />

      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent className="max-w-md gap-3">
          <DialogHeader>
            <DialogTitle>Сохранённые отчёты (задачи)</DialogTitle>
          </DialogHeader>
          {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex max-h-72 flex-col gap-1.5 overflow-auto">
            {savedQ.isLoading ? (
              <p className="text-xs text-muted-foreground">Загрузка…</p>
            ) : tasksSaved.length === 0 ? (
              <p className="text-xs text-muted-foreground">Сохранённых отчётов пока нет.</p>
            ) : (
              tasksSaved.map((s) => (
                <SavedPivotReportItem
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  dense
                  selected={activeId === s.id}
                  dirty={activeId === s.id && dirty}
                  saveDisabled={!canSave || !canSavePivotConfig(config) || saveMut.isPending}
                  loading={
                    (deleteMut.isPending && deleteMut.variables === s.id) ||
                    (saveMut.isPending && saveMut.variables?.overwriteId === s.id)
                  }
                  onSelect={() => loadSaved(s.id, s.config)}
                  onSave={() =>
                    saveMut.mutate({ name: s.name, overwriteId: s.id })
                  }
                  onShare={
                    canShare
                      ? () => {
                          setShareId(s.id);
                          setShareName(s.name);
                          setShareOpen(true);
                        }
                      : undefined
                  }
                  onDelete={canDelete ? () => void deleteMut.mutate(s.id) : undefined}
                />
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportsOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm gap-3">
          <DialogHeader>
            <DialogTitle>Сохранить как</DialogTitle>
          </DialogHeader>
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Название отчёта"
            className="h-9"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!saveName.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate({ name: saveName.trim() })}
            >
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SharePivotReportDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        reportName={shareName}
        candidates={shareCandidatesQ.data ?? []}
        loadingCandidates={shareCandidatesQ.isLoading || shareCandidatesQ.isFetching}
        submitting={shareMut.isPending}
        onConfirm={(userIds) => {
          if (shareId == null) return;
          shareMut.mutate({ id: shareId, userIds });
        }}
      />
    </>
  );
}
