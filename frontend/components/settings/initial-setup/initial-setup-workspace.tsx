"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelDropTarget } from "@/components/ui/excel-file-drop-zone";
import { pickFirstExcelFile } from "@/lib/excel-file-pick";
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
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileSpreadsheet,
  Download,
  SkipForward,
  Upload
} from "lucide-react";
import {
  AdaptiveCardGrid,
  ViewModeToggle,
  useDataViewMode
} from "@/components/ui/adaptive-grid";

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
  const [listViewMode, setListViewMode] = useDataViewMode("grid");

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

  const didAutoExpandRef = useRef(false);

  useEffect(() => {
    // Faqat birinchi marta ochiladi — foydalanuvchi yopsa qayta ochilmaydi
    if (didAutoExpandRef.current) return;
    if (!nextReadyStep?.id) return;
    didAutoExpandRef.current = true;
    setExpandedStepId(nextReadyStep.id);
  }, [nextReadyStep?.id]);

  useEffect(() => {
    if (!expandedStepId) return;
    const el = document.getElementById(`setup-step-${expandedStepId}`);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [expandedStepId]);

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
          expanded && "col-span-full sticky top-2 z-20 shadow-md",
          isNext && !expanded ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "",
          expanded && isNext ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "",
          status === "done" ? "border-emerald-200/80 bg-emerald-50/30" : skipped ? "border-dashed bg-muted/20" : "border-border bg-card",
          expanded && "bg-card"
        )}
        style={expanded ? { gridColumn: "1 / -1" } : undefined}
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
              {!ok && !done && !systemDone && missing.length > 0 ? (
                <span
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900"
                  title={`Сначала: ${missing.join(" → ")}`}
                >
                  Kutish: {missing[0]}
                  {missing.length > 1 ? ` +${missing.length - 1}` : ""}
                </span>
              ) : null}
            </div>
            {!expanded ? (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {!ok && !done && !systemDone && missing.length > 0
                  ? `Avval: ${missing.join(" → ")}`
                  : step.description}
              </p>
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
              <ExcelDropTarget
                disabled={!canEdit || parsing === step.id}
                onFile={(f) => void onStepFilePicked(step, f)}
              >
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
                      const f = pickFirstExcelFile(e.target.files);
                      e.target.value = "";
                      if (f) void onStepFilePicked(step, f);
                    }}
                  />
                </label>
              </ExcelDropTarget>
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
      <Card className="overflow-hidden border-slate-200/90 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white pb-4">
          <CardTitle className="text-base">Excel: shablon · eksport · yuklash</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Umumiy shablon va eksport bir xil formatda. Yangi serverga: eski tizimdan eksport → shu yerga
            yuklash. Har bir qadamni alohida ham to‘ldirish mumkin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              disabled={templateBusy === "bundle"}
              onClick={() => void onDownloadBundleTemplate()}
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              {templateBusy === "bundle" ? "Tayyorlanmoqda…" : "Umumiy shablon"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              disabled={templateBusy === "export"}
              onClick={() => void onExportBundleData()}
            >
              <Download className="size-3.5 text-primary" />
              {templateBusy === "export" ? "Eksport…" : "Ma’lumotlarni eksport"}
            </Button>
            <ExcelDropTarget
              disabled={parsing === "bundle"}
              onFile={(f) => void onBundlePicked(f)}
            >
              <label
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "h-9 cursor-pointer gap-1.5 rounded-lg",
                  parsing === "bundle" && "pointer-events-none opacity-50"
                )}
              >
                <Upload className="size-3.5" />
                {parsing === "bundle" ? "O‘qilmoqda…" : "Excel yuklash"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={(e) => {
                    const f = pickFirstExcelFile(e.target.files);
                    e.target.value = "";
                    if (f) void onBundlePicked(f);
                  }}
                />
              </label>
            </ExcelDropTarget>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-2.5 min-w-[160px] flex-1 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-800">
                {doneCount} / {flowSteps.length}
                <span className="ml-1 font-normal text-muted-foreground">({pct}%)</span>
              </span>
              <ViewModeToggle value={listViewMode} onChange={setListViewMode} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Компания → Территория → … → Клиенты → Слоты → Поступление
              {nextReadyStep ? (
                <>
                  {" · "}
                  <span className="font-medium text-primary">Сейчас: {nextReadyStep.title}</span>
                </>
              ) : null}
            </p>
          </div>
        </CardContent>
      </Card>

      {toast ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
          {toast}
        </p>
      ) : null}

      {INITIAL_SETUP_GROUPS.filter((g) => g.inColdStartFlow).map((group) => {
        const steps = stepsForGroup(group.id);
        return (
          <section key={group.id} className="space-y-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{group.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{group.subtitle}</p>
            </div>
            {listViewMode === "grid" ? (
              <AdaptiveCardGrid minCardWidth={260} maxHeight="none" className="overflow-visible">
                {steps.map(renderStep)}
              </AdaptiveCardGrid>
            ) : (
              <div className="space-y-2">{steps.map(renderStep)}</div>
            )}
          </section>
        );
      })}

      <section className="space-y-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {INITIAL_SETUP_GROUPS.find((g) => g.id === "later-settings")?.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bonus, skidka, xodimlar — alohida sozlamalarda.
          </p>
        </div>
        <AdaptiveCardGrid minCardWidth={240} maxHeight="none" className="overflow-visible">
          {stepsForGroup("later-settings").map((step) => (
            <div key={step.id} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-semibold text-slate-900">{step.title}</h3>
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
        </AdaptiveCardGrid>
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
