"use client";

import * as WebDataRocksReact from "@webdatarocks/react-webdatarocks";
import {
  Download,
  FolderOpen,
  Fullscreen,
  ListFilter,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Settings2,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getUserFacingError } from "@/lib/error-utils";
import type { WdrReportJson } from "@/lib/report-builder-wdr-migrate";
import {
  applyConditionalFormattingToHost,
  getPivotApi,
  scheduleWdrLayoutRefresh,
  tryGetWdrReportJson,
  type ConditionalRule,
  type DatasetResponse,
  type PivotClass
} from "./wdr-report-builder.utils";

export type WdrPivotSectionProps = {
  lastDataset: DatasetResponse | null;
  pivotRef: React.RefObject<PivotClass | null>;
  pivotWrapRef: React.RefObject<HTMLDivElement | null>;
  formatMenuRef: React.RefObject<HTMLDivElement | null>;
  pivotViewportPx: number;
  hierarchyExpanded: boolean;
  formatMenuOpen: boolean;
  setFormatMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  formatCellsDialogOpen: boolean;
  setFormatCellsDialogOpen: (v: boolean) => void;
  conditionalDialogOpen: boolean;
  setConditionalDialogOpen: (v: boolean) => void;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (v: boolean) => void;
  savedReportsDialogOpen: boolean;
  setSavedReportsDialogOpen: (v: boolean) => void;
  activeSavedReportId: number | null;
  cellFormatPattern: string;
  setCellFormatPattern: (v: string) => void;
  conditionalRules: ConditionalRule[];
  setConditionalRules: React.Dispatch<React.SetStateAction<ConditionalRule[]>>;
  formatValueScope: string;
  setFormatValueScope: (v: string) => void;
  formatAlign: string;
  setFormatAlign: (v: string) => void;
  formatThousands: string;
  setFormatThousands: (v: string) => void;
  formatDecimalSep: string;
  setFormatDecimalSep: (v: string) => void;
  formatDecimalPlaces: string;
  setFormatDecimalPlaces: (v: string) => void;
  formatNegatives: string;
  setFormatNegatives: (v: string) => void;
  formatNullValue: string;
  setFormatNullValue: (v: string) => void;
  formatAsPercent: string;
  setFormatAsPercent: (v: string) => void;
  saveName: string;
  setSaveName: (v: string) => void;
  saveMutPending: boolean;
  savedQ: { data?: Array<{ id: number; name: string }> };
  lastWdrReportRef: React.MutableRefObject<WdrReportJson>;
  pivotReadyRef: React.MutableRefObject<boolean>;
  onSave: () => Promise<boolean>;
  onBrowserExport: () => void;
  onToggleHierarchy: () => void;
  runToolbarAction: (kind: "format" | "options" | "fields") => boolean;
  onToggleFullscreen: () => void;
  loadDefaultReport: () => Promise<void>;
  loadSaved: (id: number) => Promise<void>;
  pivotMountKey: string;
  beforeToolbarCreated: (toolbar: import("./wdr-report-builder.utils").WdrToolbarLike) => void;
  initialReport: WdrReportJson;
  syncPivotSnapshot: () => void;
  hideInternalToolbar: () => void;
};

export function WdrReportBuilderPivotSection(props: WdrPivotSectionProps) {
  const {
    lastDataset,
    pivotRef,
    pivotWrapRef,
    formatMenuRef,
    pivotViewportPx,
    hierarchyExpanded,
    formatMenuOpen,
    setFormatMenuOpen,
    formatCellsDialogOpen,
    setFormatCellsDialogOpen,
    conditionalDialogOpen,
    setConditionalDialogOpen,
    saveDialogOpen,
    setSaveDialogOpen,
    savedReportsDialogOpen,
    setSavedReportsDialogOpen,
    activeSavedReportId,
    cellFormatPattern,
    setCellFormatPattern,
    conditionalRules,
    setConditionalRules,
    formatValueScope,
    setFormatValueScope,
    formatAlign,
    setFormatAlign,
    formatThousands,
    setFormatThousands,
    formatDecimalSep,
    setFormatDecimalSep,
    formatDecimalPlaces,
    setFormatDecimalPlaces,
    formatNegatives,
    setFormatNegatives,
    formatNullValue,
    setFormatNullValue,
    formatAsPercent,
    setFormatAsPercent,
    saveName,
    setSaveName,
    saveMutPending,
    savedQ,
    lastWdrReportRef,
    pivotReadyRef,
    onSave,
    onBrowserExport,
    onToggleHierarchy,
    runToolbarAction,
    onToggleFullscreen,
    loadDefaultReport,
    loadSaved,
    pivotMountKey,
    beforeToolbarCreated,
    initialReport,
    syncPivotSnapshot,
    hideInternalToolbar
  } = props;

  return (
    <>
      {lastDataset?.truncated ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Показано не более {lastDataset.cap.toLocaleString()} строк из {lastDataset.totalRowCount.toLocaleString()}. Сузьте
          фильтры или выгрузите текущую таблицу через «Экспорт» (Excel в браузере).
        </div>
      ) : null}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Сводная таблица</CardTitle>
          <p className="text-xs text-muted-foreground">
            Перетащите поля в строки / столбцы / значения. Фильтрация по значениям доступна в заголовках колонок.
          </p>
        </CardHeader>
        <CardContent className="min-h-0 pt-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-muted/30 p-2">
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => setSavedReportsDialogOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Отчёт
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setSaveDialogOpen(true)}>
                <Save className="h-3.5 w-3.5" />
                Сохр. как
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onBrowserExport}>
                <Download className="h-3.5 w-3.5" />
                Экспорт
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={onToggleHierarchy}
              >
                {hierarchyExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {hierarchyExpanded ? "Свернуть всё" : "Развернуть всё"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setFormatMenuOpen((v) => !v)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Формат
                </Button>
                {formatMenuOpen ? (
                  <div
                    ref={formatMenuRef as React.Ref<HTMLDivElement>}
                    className="absolute left-0 top-full z-30 -mt-px min-w-[12rem] rounded-b-md border border-border bg-popover p-1 shadow-lg"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setFormatMenuOpen(false);
                        setFormatCellsDialogOpen(true);
                      }}
                    >
                      <span className="text-muted-foreground">S/1.0</span>
                      Формат ячеек
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        setFormatMenuOpen(false);
                        setConditionalDialogOpen(true);
                      }}
                    >
                      <span className="text-muted-foreground">123</span>
                      Условное форматирование
                    </button>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  if (!runToolbarAction("options")) window.alert("Панель «Опции» пока недоступна");
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Опции
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  if (!runToolbarAction("fields")) window.alert("Панель «Поля» пока недоступна");
                }}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Поля
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onToggleFullscreen}>
                <Fullscreen className="h-3.5 w-3.5" />
                На весь экран
              </Button>
            </div>
          </div>
          <div
            ref={pivotWrapRef as React.Ref<HTMLDivElement>}
            className="wdr-host w-full max-w-full min-h-0 overflow-x-auto rounded border border-border bg-background"
            style={{ height: pivotViewportPx }}
          >
            <WebDataRocksReact.Pivot
              key={pivotMountKey}
              ref={pivotRef as React.Ref<PivotClass>}
              toolbar
              localization="https://cdn.webdatarocks.com/loc/ru.json"
              beforetoolbarcreated={beforeToolbarCreated}
              width="100%"
              height={pivotViewportPx}
              report={initialReport as never}
              ready={() => {
                pivotReadyRef.current = true;
                syncPivotSnapshot();
                hideInternalToolbar();
                scheduleWdrLayoutRefresh(getPivotApi(pivotRef));
              }}
              reportcomplete={() => {
                syncPivotSnapshot();
                hideInternalToolbar();
                scheduleWdrLayoutRefresh(getPivotApi(pivotRef));
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сохранить отчёт</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Введите имя для текущей формы отчёта.</p>
            <Input
              className="h-9"
              placeholder="Например: Продажи по агентам"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saveMutPending || saveName.trim().length === 0}
              onClick={() => void onSave().then((ok) => ok && setSaveDialogOpen(false))}
            >
              {saveMutPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savedReportsDialogOpen} onOpenChange={setSavedReportsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Выберите отчёт для просмотра</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {(savedQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет сохранённых отчётов.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs transition-colors",
                    activeSavedReportId === null
                      ? "border-blue-300 bg-blue-600 text-white"
                      : "border-blue-200 bg-blue-500/90 text-white hover:bg-blue-600"
                  )}
                  onClick={() => {
                    void loadDefaultReport()
                      .then(() => setSavedReportsDialogOpen(false))
                      .catch((err: unknown) =>
                        window.alert(getUserFacingError(err, "Ошибка загрузки отчёта по умолчанию"))
                      );
                  }}
                >
                  По умолчанию
                </button>
                {(savedQ.data ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs transition-colors",
                      activeSavedReportId === s.id
                        ? "border-blue-300 bg-blue-600 text-white"
                        : "border-blue-200 bg-blue-500/90 text-white hover:bg-blue-600"
                    )}
                    onClick={() => {
                      void loadSaved(s.id)
                        .then(() => setSavedReportsDialogOpen(false))
                        .catch((err: unknown) => window.alert(getUserFacingError(err, "Ошибка загрузки")));
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSavedReportsDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formatCellsDialogOpen} onOpenChange={setFormatCellsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Форматирование</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-[160px_1fr] gap-2 text-xs">
            <label className="self-center text-foreground">Выбрать</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatValueScope} onChange={(e) => setFormatValueScope(e.target.value)}>
              <option value="selected">Выбрать значение</option>
              <option value="all">Все значения</option>
            </select>

            <label className="self-center text-foreground">Выравнивание текста</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatAlign} onChange={(e) => setFormatAlign(e.target.value)}>
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
            </select>

            <label className="self-center text-foreground">Thousands separator</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatThousands} onChange={(e) => setFormatThousands(e.target.value)}>
              <option value="space">(пробел)</option>
              <option value=",">,</option>
              <option value=".">.</option>
            </select>

            <label className="self-center text-foreground">Десятичный разделитель</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatDecimalSep} onChange={(e) => setFormatDecimalSep(e.target.value)}>
              <option value=".">.</option>
              <option value=",">,</option>
            </select>

            <label className="self-center text-foreground">Десятичные знаки</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatDecimalPlaces} onChange={(e) => setFormatDecimalPlaces(e.target.value)}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>

            <label className="self-center text-foreground">Negative number format</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatNegatives} onChange={(e) => setFormatNegatives(e.target.value)}>
              <option value="-1">-1</option>
              <option value="(1)">(1)</option>
            </select>

            <label className="self-center text-foreground">Нулевое значение</label>
            <Input className="h-8" value={formatNullValue} onChange={(e) => setFormatNullValue(e.target.value)} />

            <label className="self-center text-foreground">Форматировать как проценты</label>
            <select className="h-8 rounded border border-input bg-background px-2 text-foreground" value={formatAsPercent} onChange={(e) => setFormatAsPercent(e.target.value)}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>

            <label className="self-center text-foreground">Шаблон числа</label>
            <Input className="h-8" value={cellFormatPattern} onChange={(e) => setCellFormatPattern(e.target.value)} placeholder="#,##0.00" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormatCellsDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                const wdr = getPivotApi(pivotRef);
                if (!wdr || !pivotReadyRef.current) {
                  window.alert("Таблица ещё не готова");
                  return;
                }
                const plain = tryGetWdrReportJson(wdr) ?? lastWdrReportRef.current;
                const next = {
                  ...plain,
                  savdoCustomFormat: {
                    ...((plain as Record<string, unknown>).savdoCustomFormat as Record<string, unknown>),
                    cellFormatPattern,
                    formatValueScope,
                    formatAlign,
                    formatThousands,
                    formatDecimalSep,
                    formatDecimalPlaces,
                    formatNegatives,
                    formatNullValue,
                    formatAsPercent
                  }
                } as WdrReportJson;
                lastWdrReportRef.current = next;
                wdr.setReport(next as never);
                scheduleWdrLayoutRefresh(wdr);
                setFormatCellsDialogOpen(false);
              }}
            >
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conditionalDialogOpen} onOpenChange={setConditionalDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Форматирование...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded border border-input px-2 py-1 text-foreground hover:bg-muted"
                onClick={() =>
                  setConditionalRules((prev) => [
                    ...prev,
                    {
                      id: `r-${Date.now()}-${prev.length}`,
                      scope: "all",
                      operator: "lt",
                      threshold: "0",
                      fontName: "Arial",
                      fontSize: "12px",
                      color: "#ef4444"
                    }
                  ])
                }
              >
                +
              </button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    const host = pivotWrapRef.current;
                    if (host) applyConditionalFormattingToHost(host, conditionalRules);
                  }}
                >
                  ПРИМЕНИТЬ
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setConditionalDialogOpen(false)}>ОТМЕНИТЬ</Button>
              </div>
            </div>
            {conditionalRules.length === 0 ? (
              <div className="rounded border border-input p-4 text-center text-muted-foreground">
                <p>There are no active conditions.</p>
                <button
                  type="button"
                  className="mt-3 rounded border border-input px-3 py-1 hover:bg-muted"
                  onClick={() =>
                    setConditionalRules([
                      {
                        id: `r-${Date.now()}`,
                        scope: "all",
                        operator: "lt",
                        threshold: "0",
                        fontName: "Arial",
                        fontSize: "12px",
                        color: "#ef4444"
                      }
                    ])
                  }
                >
                  + Add condition
                </button>
              </div>
            ) : (
              conditionalRules.map((rule) => (
                <div key={rule.id} className="space-y-2 rounded border border-input p-2">
                  <div className="grid grid-cols-[80px_1fr_1fr_1fr_24px] items-center gap-2">
                    <label className="text-foreground">Значение:</label>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.scope}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, scope: e.target.value as "all" } : x)))
                      }
                    >
                      <option value="all">Все значения</option>
                    </select>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.operator}
                      onChange={(e) =>
                        setConditionalRules((prev) =>
                          prev.map((x) => (x.id === rule.id ? { ...x, operator: e.target.value as "gt" | "lt" | "eq" } : x))
                        )
                      }
                    >
                      <option value="lt">Меньше чем</option>
                      <option value="gt">Больше чем</option>
                      <option value="eq">Равно</option>
                    </select>
                    <Input
                      className="h-8"
                      value={rule.threshold}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, threshold: e.target.value } : x)))
                      }
                    />
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setConditionalRules((prev) => prev.filter((x) => x.id !== rule.id))}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_90px_36px_1fr] items-center gap-2">
                    <label className="text-foreground">Формат:</label>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.fontName}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, fontName: e.target.value } : x)))
                      }
                    >
                      <option value="Arial">Arial</option>
                      <option value="Inter">Inter</option>
                      <option value="Tahoma">Tahoma</option>
                    </select>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-foreground"
                      value={rule.fontSize}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, fontSize: e.target.value } : x)))
                      }
                    >
                      <option value="11px">11px</option>
                      <option value="12px">12px</option>
                      <option value="13px">13px</option>
                      <option value="14px">14px</option>
                    </select>
                    <div className="flex h-8 items-center justify-center rounded border border-input bg-muted text-foreground">A</div>
                    <Input
                      className="h-8"
                      value={rule.color}
                      onChange={(e) =>
                        setConditionalRules((prev) => prev.map((x) => (x.id === rule.id ? { ...x, color: e.target.value } : x)))
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConditionalDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                const wdr = getPivotApi(pivotRef);
                if (!wdr || !pivotReadyRef.current) {
                  window.alert("Таблица ещё не готова");
                  return;
                }
                const plain = tryGetWdrReportJson(wdr) ?? lastWdrReportRef.current;
                const next = {
                  ...plain,
                  savdoCustomFormat: {
                    ...(plain as Record<string, unknown>).savdoCustomFormat as Record<string, unknown>,
                    conditionalThreshold: "0",
                    conditionalRules
                  }
                } as WdrReportJson;
                lastWdrReportRef.current = next;
                wdr.setReport(next as never);
                scheduleWdrLayoutRefresh(wdr);
                const hostEl = pivotWrapRef.current;
                if (hostEl) applyConditionalFormattingToHost(hostEl, conditionalRules);
                setConditionalDialogOpen(false);
              }}
            >
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
