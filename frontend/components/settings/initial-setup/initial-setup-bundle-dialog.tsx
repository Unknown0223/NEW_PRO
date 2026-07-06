"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { INITIAL_SETUP_STEPS } from "@/lib/initial-setup/catalog";
import { applyBundleInOrder, type BundleApplyProgress } from "@/lib/initial-setup/apply-step";
import type { BundleParseResult } from "@/lib/initial-setup/bundle-xlsx";
import { getStepById } from "@/lib/initial-setup/catalog";
import { sortStepIdsByFlowOrder } from "@/lib/initial-setup/flow-order";
import { InitialSetupStepTable } from "@/components/settings/initial-setup/initial-setup-step-table";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, SkipForward } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  bundle: BundleParseResult;
  progressDone: ReadonlySet<string>;
  onComplete: (
    messages: string[],
    failed: { stepId: string; error: string }[],
    succeededIds: string[],
    skipped: string[]
  ) => void;
};

export function InitialSetupBundleDialog({
  open,
  onOpenChange,
  tenantSlug,
  bundle,
  progressDone,
  onComplete
}: Props) {
  const qc = useQueryClient();
  const stepIds = useMemo(
    () => sortStepIdsByFlowOrder(Object.keys(bundle).filter((id) => bundle[id]?.rows.length)),
    [bundle]
  );
  const [tab, setTab] = useState(stepIds[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [applyLog, setApplyLog] = useState<BundleApplyProgress[]>([]);

  const activeStep = getStepById(tab);

  async function applyAll() {
    setBusy(true);
    setApplyLog([]);
    const order = INITIAL_SETUP_STEPS.filter((s) => stepIds.includes(s.id));
    const { ok, failed, succeededIds, skipped } = await applyBundleInOrder(
      tenantSlug,
      bundle,
      order,
      qc,
      progressDone,
      (p) => setApplyLog((prev) => [...prev.filter((x) => x.stepId !== p.stepId), p])
    );
    onComplete(ok, failed, succeededIds, skipped);
    setBusy(false);
    if (!failed.length) onOpenChange(false);
  }

  if (!stepIds.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Импорт Excel — проверка</DialogTitle>
          <DialogDescription>
            {stepIds.length} листов. Применение идёт по порядку: Основа → Справочники → Продукты → Клиенты. Каждый
            шаг ждёт завершения предыдущих.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-52 md:flex-col md:border-b-0 md:border-r">
            {stepIds.map((id, idx) => {
              const step = getStepById(id);
              const log = applyLog.find((x) => x.stepId === id);
              return (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs",
                    tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  onClick={() => setTab(id)}
                >
                  <span className="tabular-nums opacity-60">{idx + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{step?.title ?? id}</span>
                  {log?.status === "running" ? (
                    <Loader2 className="size-3 shrink-0 animate-spin" />
                  ) : log?.status === "done" ? (
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
                  ) : log?.status === "skipped" ? (
                    <SkipForward className="size-3 shrink-0 opacity-60" />
                  ) : (
                    <Circle className="size-3 shrink-0 opacity-30" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {activeStep ? (
              <InitialSetupStepTable
                tenantSlug={tenantSlug}
                step={activeStep}
                enabled
                effectiveDoneIds={progressDone}
                externalPreview={bundle[tab] ?? null}
                onApplied={() => {}}
              />
            ) : null}
          </div>
        </div>

        {applyLog.length ? (
          <div className="max-h-28 overflow-auto border-t px-6 py-2 text-[11px] text-muted-foreground">
            {applyLog.map((l) => (
              <p key={l.stepId}>
                {l.title}: {l.status}
                {l.message ? ` — ${l.message}` : ""}
              </p>
            ))}
          </div>
        ) : null}

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Закрыть
          </Button>
          <Button type="button" onClick={() => void applyAll()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Применить по порядку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
