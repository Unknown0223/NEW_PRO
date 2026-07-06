"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InitialSetupBundleDialog } from "@/components/settings/initial-setup/initial-setup-bundle-dialog";
import { InitialSetupStepTable } from "@/components/settings/initial-setup/initial-setup-step-table";
import {
  INITIAL_SETUP_GROUPS,
  dependencyLabels,
  stepsForGroup
} from "@/lib/initial-setup/catalog";
import { parseBundleXlsx, downloadBundleTemplate, downloadBundleExport, downloadStepTemplate, type BundleParseResult } from "@/lib/initial-setup/bundle-xlsx";
import { parseXlsxPreview } from "@/lib/initial-setup/preview-xlsx";
import { getStepTableConfig, requiredColumnKeys } from "@/lib/initial-setup/ref-table-config";
import {
  effectiveDoneIds,
  getColdStartSteps,
  getNextReadyStep,
  isStepReady,
  missingDependencyTitles,
  systemSatisfiedStepIds
} from "@/lib/initial-setup/flow-order";
import {
  doneStepIds,
  loadInitialSetupProgress,
  markStep,
  type InitialSetupProgress
} from "@/lib/initial-setup/progress";
import type { InitialSetupPreviewState, InitialSetupStep } from "@/lib/initial-setup/types";
import { getUserFacingError } from "@/lib/error-utils";
import { api } from "@/lib/api";
import { isAxiosError } from "axios";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileSpreadsheet,
  Download,
  SkipForward,
  Upload
} from "lucide-react";

type Props = {
  tenantSlug: string | null;
};

function statusIcon(done: boolean, skipped: boolean, blocked: boolean) {
  if (done && !skipped) return <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />;
  if (skipped) return <SkipForward className="size-5 shrink-0 text-muted-foreground" />;
  if (blocked) return <AlertTriangle className="size-5 shrink-0 text-amber-600" />;
  return <Circle className="size-5 shrink-0 text-muted-foreground" />;
}

export function InitialSetupWorkspace({ tenantSlug }: Props) {
  const [progress, setProgress] = useState<InitialSetupProgress>(() =>
    loadInitialSetupProgress(tenantSlug)
  );
  const [toast, setToast] = useState<string | null>(null);
  const [draftByStep, setDraftByStep] = useState<Record<string, InitialSetupPreviewState>>({});
  const [parsing, setParsing] = useState<string | null>(null);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [bundleData, setBundleData] = useState<BundleParseResult>({});
  const [templateBusy, setTemplateBusy] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const doneIds = useMemo(() => doneStepIds(progress), [progress]);

  const readinessQ = useQuery({
    queryKey: ["initial-setup-readiness", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const [profileRes, whRes, catRes, tdRes, scRes] = await Promise.all([
        api.get<{ name: string; references: Record<string, unknown> }>(`/api/${tenantSlug}/settings/profile`),
        api.get<{ data?: unknown[] }>(`/api/${tenantSlug}/warehouses`).catch(() => ({ data: { data: [] } })),
        api.get<{ data?: unknown[] }>(`/api/${tenantSlug}/product-categories`).catch(() => ({ data: { data: [] } })),
        api.get<{ data?: unknown[] }>(`/api/${tenantSlug}/trade-directions?is_active=true`).catch(() => ({ data: { data: [] } })),
        api.get<{ data?: unknown[] }>(`/api/${tenantSlug}/sales-channels?is_active=true`).catch(() => ({ data: { data: [] } }))
      ]);
      return {
        profile: profileRes.data,
        warehousesCount: whRes.data.data?.length ?? 0,
        productCategoriesCount: catRes.data.data?.length ?? 0,
        tradeDirectionsCount: tdRes.data.data?.length ?? 0,
        salesChannelsCount: scRes.data.data?.length ?? 0
      };
    }
  });

  const systemDoneIds = useMemo(
    () =>
      systemSatisfiedStepIds(readinessQ.data?.profile, {
        warehousesCount: readinessQ.data?.warehousesCount,
        productCategoriesCount: readinessQ.data?.productCategoriesCount,
        tradeDirectionsCount: readinessQ.data?.tradeDirectionsCount,
        salesChannelsCount: readinessQ.data?.salesChannelsCount
      }),
    [readinessQ.data]
  );

  const effectiveDone = useMemo(
    () => effectiveDoneIds(doneIds, systemDoneIds),
    [doneIds, systemDoneIds]
  );

  const nextReadyStep = useMemo(
    () => getNextReadyStep(doneIds, systemDoneIds),
    [doneIds, systemDoneIds]
  );

  useEffect(() => {
    if (nextReadyStep?.id && expandedStepId === null) {
      setExpandedStepId(nextReadyStep.id);
    }
  }, [nextReadyStep?.id, expandedStepId]);

  const flowSteps = useMemo(() => getColdStartSteps(), []);
  const doneCount = flowSteps.filter((s) => doneIds.has(s.id) || systemDoneIds.has(s.id)).length;
  const pct = flowSteps.length ? Math.round((doneCount / flowSteps.length) * 100) : 0;

  const mark = useCallback(
    (stepId: string, status: "done" | "skipped") => {
      if (!tenantSlug) return;
      setProgress(markStep(tenantSlug, stepId, status));
    },
    [tenantSlug]
  );

  async function onBundlePicked(file: File) {
    setParsing("bundle");
    setToast(null);
    try {
      const parsed = await parseBundleXlsx(file);
      const ids = Object.keys(parsed);
      if (!ids.length) {
        setToast("В файле только примеры — измените данные или добавьте свои строки");
        return;
      }
      setDraftByStep((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          next[id] = parsed[id]!;
        }
        return next;
      });
      setBundleData(parsed);
      setBundleOpen(true);
    } catch {
      setToast("Excel o‘qib bo‘lmadi");
    } finally {
      setParsing(null);
    }
  }

  async function onStepFilePicked(step: InitialSetupStep, file: File) {
    setParsing(step.id);
    setToast(null);
    try {
      const config = getStepTableConfig(step.id);
      const preview = await parseXlsxPreview(file, requiredColumnKeys(step, config), 200, config);
      if (!preview.rows.length) {
        setToast("В файле только примеры — измените или добавьте свои строки");
        return;
      }
      setDraftByStep((prev) => ({ ...prev, [step.id]: preview }));
      setExpandedStepId(step.id);
    } catch {
      setToast("Excel o‘qib bo‘lmadi — shablon formatini tekshiring");
    } finally {
      setParsing(null);
    }
  }

  async function onDownloadBundleTemplate() {
    if (!tenantSlug) return;
    setTemplateBusy("bundle");
    try {
      await downloadBundleTemplate(tenantSlug);
    } catch {
      setToast("Shablon yuklab bo‘lmadi");
    } finally {
      setTemplateBusy(null);
    }
  }

  async function onExportBundleData() {
    if (!tenantSlug) return;
    setTemplateBusy("export");
    setToast(null);
    try {
      await downloadBundleExport(tenantSlug);
      setToast("Экспорт готов — файл скачан в формате общего шаблона");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "EMPTY_EXPORT") {
        setToast("Нет данных для экспорта — сначала заполните справочники");
      } else if (
        isAxiosError(e) &&
        (e.response?.data as { error?: string } | undefined)?.error === "EmptyExport"
      ) {
        setToast("Нет данных для экспорта — сначала заполните справочники");
      } else {
        setToast(getUserFacingError(e, "Экспорт не удался — повторите позже"));
      }
    } finally {
      setTemplateBusy(null);
    }
  }

  async function onDownloadStepTemplate(step: InitialSetupStep) {
    if (!tenantSlug) return;
    setTemplateBusy(step.id);
    try {
      await downloadStepTemplate(tenantSlug, step);
    } catch {
      setToast("Shablon yuklab bo‘lmadi");
    } finally {
      setTemplateBusy(null);
    }
  }

  function renderStep(step: InitialSetupStep) {
    const status = progress[step.id];
    const done = status === "done" || status === "skipped";
    const skipped = status === "skipped";
    const systemDone = systemDoneIds.has(step.id) && !done;
    const { ok } = isStepReady(step, effectiveDone);
    const deps = dependencyLabels(step);
    const canEdit = Boolean(tenantSlug) && ok;
    const isNext = nextReadyStep?.id === step.id;
    const missing = missingDependencyTitles(step, effectiveDone);
    const expanded = expandedStepId === step.id;

    return (
      <div
        key={step.id}
        id={`setup-step-${step.id}`}
        className={cn(
          "overflow-hidden rounded-xl border transition-colors",
          isNext && !expanded ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "",
          expanded && isNext ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "",
          status === "done" ? "border-emerald-200/80 bg-emerald-50/30" : skipped ? "border-dashed bg-muted/20" : "border-border bg-card"
        )}
      >
        <button
          type="button"
          className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/30"
          aria-expanded={expanded}
          onClick={() => setExpandedStepId((prev) => (prev === step.id ? null : step.id))}
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {statusIcon(status === "done", skipped, !ok && !done && !systemDone)}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              {isNext ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Следующий шаг
                </span>
              ) : null}
              {systemDone ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  Уже в системе
                </span>
              ) : null}
              {status === "done" ? (
                <span className="text-[10px] font-medium text-emerald-700">Выполнено</span>
              ) : null}
            </div>
            {!expanded ? (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{step.description}</p>
            ) : null}
          </div>
        </button>

        {expanded ? (
          <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3">
            <p className="text-sm text-muted-foreground">{step.description}</p>
            {deps.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Сначала: </span>
                {deps.join(" → ")}
              </p>
            ) : null}
            {step.dependencyHint ? (
              <p className="text-xs text-amber-800/90">{step.dependencyHint}</p>
            ) : null}
            {!ok && !done && !systemDone ? (
              <p className="text-xs font-medium text-amber-700">Ожидание: {missing.join(" → ")}</p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {!done ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  title="Пропустить"
                  aria-label="Пропустить"
                  onClick={() => mark(step.id, "skipped")}
                >
                  <SkipForward className="size-4" />
                </Button>
              ) : skipped ? (
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => mark(step.id, "done")}>
                  Открыть снова
                </Button>
              ) : null}
              {systemDone && !done ? (
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => mark(step.id, "done")}>
                  Отметить выполненным
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!canEdit || templateBusy === step.id}
                onClick={() => void onDownloadStepTemplate(step)}
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" />
                {templateBusy === step.id ? "Загрузка…" : "Шаблон"}
              </Button>
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "cursor-pointer gap-1.5",
                  (!canEdit || parsing === step.id) && "pointer-events-none opacity-50"
                )}
              >
                <Upload className="size-3.5" />
                {parsing === step.id ? "Чтение…" : "Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  disabled={!canEdit}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onStepFilePicked(step, f);
                  }}
                />
              </label>
            </div>

            {tenantSlug ? (
              <InitialSetupStepTable
                tenantSlug={tenantSlug}
                step={step}
                enabled={canEdit}
                effectiveDoneIds={effectiveDone}
                externalPreview={draftByStep[step.id] ?? null}
                onApplied={(message) => {
                  mark(step.id, "done");
                  setToast(message);
                  void readinessQ.refetch();
                  setDraftByStep((prev) => {
                    const next = { ...prev };
                    delete next[step.id];
                    return next;
                  });
                  const next = getNextReadyStep(new Set([...doneIds, step.id]), systemDoneIds);
                  if (next) setExpandedStepId(next.id);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (!tenantSlug) {
    return <p className="text-sm text-muted-foreground">Kirish talab qilinadi.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bitta Excel — hammasi bir joyda</CardTitle>
          <CardDescription>
            Shablon yuklang yoki joriy ma’lumotlarni eksport qiling — format bir xil. Yangi serverga tez ko‘chirish uchun
            eski tizimdan eksport → yangi tizimga import.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={templateBusy === "bundle"}
            onClick={() => void onDownloadBundleTemplate()}
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            {templateBusy === "bundle" ? "Tayyorlanmoqda…" : "Umumiy shablon (.xlsx)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={templateBusy === "export"}
            onClick={() => void onExportBundleData()}
          >
            <Download className="size-3.5 text-primary" />
            {templateBusy === "export" ? "Экспорт…" : "Экспорт данных (.xlsx)"}
          </Button>
          <label
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "cursor-pointer gap-1.5",
              parsing === "bundle" && "pointer-events-none opacity-50"
            )}
          >
            <Upload className="size-3.5" />
            {parsing === "bundle" ? "O‘qilmoqda…" : "Bitta Excel yuklash"}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onBundlePicked(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Boshlang‘ich sozlash</CardTitle>
          <CardDescription>
            Каждый шаг — по порядку. Excel и таблица применяются только когда предыдущие шаги готовы. «Применить» =
            тот же API, что в основных настройках.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-2 min-w-[200px] flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-medium tabular-nums">
              {doneCount} / {flowSteps.length} ({pct}%)
            </span>
          </div>
          <ol className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ArrowRight className="size-3.5 shrink-0" />
              Компания → Территория → Филиалы → Единицы → Валюты → … → Клиенты → Слоты → Остатки
            </li>
            {nextReadyStep ? (
              <li className="font-medium text-primary">
                Сейчас: {nextReadyStep.title}
              </li>
            ) : null}
          </ol>
        </CardContent>
      </Card>

      {toast ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{toast}</p>
      ) : null}

      {INITIAL_SETUP_GROUPS.filter((g) => g.inColdStartFlow).map((group) => (
        <section key={group.id}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{group.title}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{group.subtitle}</p>
          <div className="space-y-2">{stepsForGroup(group.id).map(renderStep)}</div>
        </section>
      ))}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {INITIAL_SETUP_GROUPS.find((g) => g.id === "later-settings")?.title}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Bonus, skidka, xodimlar — alohida sozlamalarda.
        </p>
        <div className="space-y-3">
          {stepsForGroup("later-settings").map((step) => (
            <div key={step.id} className="rounded-xl border border-dashed bg-muted/20 p-4">
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              {step.settingsHref ? (
                <Link
                  href={step.settingsHref}
                  className={cn(buttonVariants({ variant: "link" }), "mt-2 h-auto px-0")}
                >
                  Ochish →
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <InitialSetupBundleDialog
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        tenantSlug={tenantSlug}
        bundle={bundleData}
        progressDone={effectiveDone}
        onComplete={(ok, failed, succeededIds, skipped) => {
          for (const id of succeededIds) mark(id, "done");
          void readinessQ.refetch();
          const parts = [...ok, ...skipped];
          if (parts.length) setToast(parts.join(" · "));
          if (failed.length) setToast(failed.map((f) => f.error).join("; "));
        }}
      />
    </div>
  );
}
