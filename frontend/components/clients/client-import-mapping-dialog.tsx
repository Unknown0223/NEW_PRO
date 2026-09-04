"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ClientImportProgress,
  type ClientImportProgressModel
} from "@/components/clients/client-import-progress";
import { CLIENT_IMPORT_MAPPABLE_FIELDS } from "@/lib/client-import-fields";
import {
  buildUpdateApplyFieldOptions,
  CLIENT_IMPORT_DUPLICATE_KEY_OPTIONS,
  DEFAULT_DUPLICATE_KEY_FIELDS,
  defaultUpdateApplyFieldKeys,
  isClientImportTeamFieldKey,
  RECOMMENDED_DUPLICATE_KEY_FIELDS,
  teamUpdateApplyFieldKeys
} from "@/lib/client-import-masks";
import {
  headerToAgentImportKey,
  mergeAutoClientImportColumns,
  rowToHeaderLabels,
  suggestColumnMapping
} from "@/lib/client-import-header-match";
import type { WorkBook, WorkSheet } from "xlsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const selectClass =
  "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full min-w-0 rounded-md border px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export type ClientImportMappingPayload = {
  columnMap: Record<string, number>;
  sheetName: string;
  headerRowIndex: number;
  /** Yangi klient: dublikat qaysi maydonlar bo‘yicha (`client_code`, `city`, …). */
  duplicateKeyFields?: string[];
  /** Yangilash: faqat tanlangan maydonlar; berilmasa — barcha xaritalangan ustunlar. */
  updateApplyFields?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  isSubmitting: boolean;
  /** «create» — yangi; «update» — ИД ustuni majburiy */
  importMode?: "create" | "update";
  progress?: ClientImportProgressModel | null;
  onConfirm: (payload: ClientImportMappingPayload) => void;
};

type XlsxNs = typeof import("xlsx");

function sheetToMatrix(XLSX: XlsxNs, ws: WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true
  }) as unknown[][];
}

export function ClientImportMappingDialog({
  open,
  onOpenChange,
  file,
  isSubmitting,
  importMode = "create",
  progress = null,
  onConfirm
}: Props) {
  const [parseError, setParseError] = useState<string | null>(null);
  const xlsxModRef = useRef<XlsxNs | null>(null);
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [sheetName, setSheetName] = useState("");
  /** 1-based (Excel qatori), foydalanuvchiga tushunarli */
  const [headerRowOneBased, setHeaderRowOneBased] = useState(1);
  const [mappingSelect, setMappingSelect] = useState<Record<string, string>>({});
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [checkDuplicates, setCheckDuplicates] = useState(false);
  const [dupKeySet, setDupKeySet] = useState<Set<string>>(() => new Set(DEFAULT_DUPLICATE_KEY_FIELDS));
  const [restrictUpdate, setRestrictUpdate] = useState(importMode === "update");
  const updateFieldOptions = useMemo(() => buildUpdateApplyFieldOptions(), []);
  const baseUpdateOptions = useMemo(
    () => updateFieldOptions.filter((o) => !isClientImportTeamFieldKey(o.key)),
    [updateFieldOptions]
  );
  const teamUpdateOptions = useMemo(
    () => updateFieldOptions.filter((o) => isClientImportTeamFieldKey(o.key)),
    [updateFieldOptions]
  );
  const [updateApplySet, setUpdateApplySet] = useState<Set<string>>(
    () => new Set(defaultUpdateApplyFieldKeys(updateFieldOptions))
  );

  const selectAllUpdateFields = useCallback(() => {
    setUpdateApplySet(new Set(updateFieldOptions.map((o) => o.key)));
  }, [updateFieldOptions]);

  const deselectAllUpdateFields = useCallback(() => {
    setUpdateApplySet(new Set());
  }, []);

  const selectTeamUpdateFields = useCallback(() => {
    setUpdateApplySet((prev) => {
      const n = new Set(prev);
      for (const k of teamUpdateApplyFieldKeys(updateFieldOptions)) n.add(k);
      return n;
    });
  }, [updateFieldOptions]);

  const deselectTeamUpdateFields = useCallback(() => {
    setUpdateApplySet((prev) => {
      const n = new Set(prev);
      for (const k of teamUpdateApplyFieldKeys(updateFieldOptions)) n.delete(k);
      return n;
    });
  }, [updateFieldOptions]);

  const allUpdateFieldsSelected =
    updateFieldOptions.length > 0 && updateFieldOptions.every((o) => updateApplySet.has(o.key));
  const noUpdateFieldsSelected = updateApplySet.size === 0;
  const allTeamSelected =
    teamUpdateOptions.length > 0 && teamUpdateOptions.every((o) => updateApplySet.has(o.key));
  const noTeamSelected = teamUpdateOptions.every((o) => !updateApplySet.has(o.key));

  const resetState = useCallback(() => {
    xlsxModRef.current = null;
    setParseError(null);
    setWorkbook(null);
    setSheetName("");
    setHeaderRowOneBased(1);
    setMappingSelect({});
    setLocalErr(null);
    setCheckDuplicates(false);
    setDupKeySet(new Set(DEFAULT_DUPLICATE_KEY_FIELDS));
    setRestrictUpdate(importMode === "update");
    setUpdateApplySet(new Set(defaultUpdateApplyFieldKeys()));
  }, [importMode]);

  useEffect(() => {
    if (!open || !file) {
      if (!open) resetState();
      return;
    }

    setParseError(null);
    setLocalErr(null);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const XLSX = await import("xlsx");
          xlsxModRef.current = XLSX;
          const buf = reader.result as ArrayBuffer;
          const wb = XLSX.read(buf, { type: "array", cellDates: true, sheetRows: 120 });
          if (!wb.SheetNames.length) {
            setParseError("В файле нет листов.");
            setWorkbook(null);
            return;
          }
          setWorkbook(wb);
          setSheetName(wb.SheetNames[0] ?? "");
          setHeaderRowOneBased(1);
        } catch {
          setParseError("Не удалось прочитать файл Excel.");
          setWorkbook(null);
        }
      })();
    };
    reader.onerror = () => {
      setParseError("Файл не прочитан.");
      setWorkbook(null);
    };
    reader.readAsArrayBuffer(file);
  }, [open, file, resetState]);

  const matrix = useMemo(() => {
    const XLSX = xlsxModRef.current;
    if (!workbook || !sheetName || !XLSX) return [] as unknown[][];
    const ws = workbook.Sheets[sheetName];
    if (!ws) return [];
    return sheetToMatrix(XLSX, ws);
  }, [workbook, sheetName]);

  const headerRowIdx = Math.max(0, headerRowOneBased - 1);
  const fileColumnLabels = useMemo(() => {
    const row = matrix[headerRowIdx];
    return rowToHeaderLabels(row);
  }, [matrix, headerRowIdx]);

  const detectedTeamFromFile = useMemo(() => {
    const row = matrix[headerRowIdx];
    if (!Array.isArray(row)) return [] as string[];
    const labels: string[] = [];
    row.forEach((c) => {
      const raw = c == null ? "" : String(c);
      const key = headerToAgentImportKey(raw);
      if (!key) return;
      labels.push(raw.trim() || key);
    });
    return labels;
  }, [matrix, headerRowIdx]);

  useEffect(() => {
    if (!open || !workbook || !sheetName || matrix.length === 0) return;
    if (headerRowIdx >= matrix.length) return;
    const row = matrix[headerRowIdx];
    if (!Array.isArray(row)) return;
    const headers = row.map((c) => (c == null ? "" : String(c)));
    const suggested = suggestColumnMapping(headers);
    const next: Record<string, string> = {};
    for (const { key } of CLIENT_IMPORT_MAPPABLE_FIELDS) {
      if (suggested[key] !== undefined) next[key] = String(suggested[key]);
      else next[key] = "";
    }
    setMappingSelect(next);
  }, [open, workbook, sheetName, matrix, headerRowIdx]);

  const applyAutoMap = () => {
    if (headerRowIdx >= matrix.length) return;
    const row = matrix[headerRowIdx];
    if (!Array.isArray(row)) return;
    const headers = row.map((c) => (c == null ? "" : String(c)));
    const suggested = suggestColumnMapping(headers);
    setMappingSelect((prev) => {
      const next = { ...prev };
      for (const { key } of CLIENT_IMPORT_MAPPABLE_FIELDS) {
        if (suggested[key] !== undefined) next[key] = String(suggested[key]);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    setLocalErr(null);
    const columnMap: Record<string, number> = {};
    for (const { key } of CLIENT_IMPORT_MAPPABLE_FIELDS) {
      const v = mappingSelect[key];
      if (v === "" || v === undefined) continue;
      const n = Number.parseInt(v, 10);
      if (Number.isFinite(n) && n >= 0) columnMap[key] = n;
    }
    const headerCells = matrix[headerRowIdx];
    const headers = Array.isArray(headerCells)
      ? headerCells.map((c) => (c == null ? "" : String(c)))
      : [];
    const merged = mergeAutoClientImportColumns(headers, columnMap);
    if (importMode === "update") {
      if (merged.client_db_id === undefined) {
        setLocalErr('Укажите столбец «ИД» / id (внутренний id клиента в системе) — обязательно для обновления.');
        return;
      }
      if (restrictUpdate && updateApplySet.size === 0) {
        setLocalErr("Отметьте хотя бы одно поле для обновления или снимите «Только выбранные поля».");
        return;
      }
    } else if (merged.name === undefined) {
      setLocalErr("Укажите столбец «Наименование» — обязательно для новых клиентов.");
      return;
    }
    onConfirm({
      columnMap: merged,
      sheetName,
      headerRowIndex: headerRowIdx,
      duplicateKeyFields:
        importMode === "create" ? (checkDuplicates ? Array.from(dupKeySet) : []) : undefined,
      updateApplyFields:
        importMode === "update" && restrictUpdate ? Array.from(updateApplySet) : undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,720px)] max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl"
        showCloseButton={!isSubmitting}
      >
        <div className="border-b border-border/80 p-4">
          <DialogHeader>
            <DialogTitle>
              {importMode === "update"
                ? "Обновление клиентов из Excel"
                : "Импорт Excel — сопоставление столбцов"}
            </DialogTitle>
            <DialogDescription>
              {file ? (
                <span className="break-all">
                  Файл: <strong>{file.name}</strong>
                  {importMode === "update"
                    ? " — строки с «ИД»; пустые ячейки в обычных полях очищают значение. Команда (агент / дни / экспедитор): пустая ячейка сохраняет текущее назначение; чтобы снять — напишите «очистить». Отметьте нужные поля ниже, включая блок «Команда»."
                    : " — сопоставьте столбцы. «Команда» (Агент / день / Экспедитор) читается из файла полностью (авто или вручную). ИД необязателен."}
                </span>
              ) : (
                "Файл не выбран."
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <ClientImportProgress progress={progress} />
          </div>
          {parseError ? (
            <p className="text-sm text-destructive">{parseError}</p>
          ) : !workbook ? (
            <p className="text-muted-foreground text-sm">Чтение файла…</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-sky-200/80 bg-sky-50/70 px-3 py-2 text-xs text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-100">
                    <p className="mb-1.5 font-semibold">Уникальность (дубликаты) — что проверять</p>
                    <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-snug">
                      <li>
                        <strong>★ Код клиента</strong> — главный бизнес-ID (рекомендуется)
                      </li>
                      <li>
                        <strong>★ ИНН</strong> / <strong>★ ПИНФЛ</strong> — юридический / физ. идентификатор
                      </li>
                      <li>
                        <strong>★ Телефон</strong> — частый практический дубликат
                      </li>
                      <li>
                        <strong>Наименование</strong> — в БД уже уникально в рамках компании
                      </li>
                      <li>
                        <strong>Город</strong> — слабый ключ (много клиентов в одном городе)
                      </li>
                    </ul>
                    <p className="mt-1.5 text-[11px] opacity-90">
                      {importMode === "update"
                        ? "При обновлении эти проверки выполняются автоматически (ИД в файле + конфликт кода/ИНН/ПИНФЛ/телефона/имени с другим клиентом)."
                        : "При новом импорте включите «Проверять дубликаты» и отметьте ★-поля ниже."}
                    </p>
                    <p className="mt-1 border-t border-sky-200/60 pt-1.5 text-[11px] dark:border-sky-800/50">
                      <strong>Долг — агент и доставочник:</strong> снять / заменить сотрудника можно
                      только если остаток долга по его <em>доставленным</em> заказам у клиента равен{" "}
                      <strong>0</strong>. Любая сумма &gt; 0 блокирует. Переплата по заказам (оплачено
                      больше) даёт остаток 0 — смена разрешена. Импорт пропустит заблокированные
                      назначения (остальные поля обновятся) и покажет предупреждение со списком и
                      суммой.
                    </p>
                  </div>
                  {importMode === "create" ? (
                    <div className="bg-muted/40 space-y-2 rounded-md border border-border/80 p-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="border-input h-4 w-4 rounded"
                          checked={checkDuplicates}
                          disabled={isSubmitting}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setCheckDuplicates(on);
                            if (on && dupKeySet.size === 0) {
                              setDupKeySet(new Set(DEFAULT_DUPLICATE_KEY_FIELDS));
                            }
                          }}
                        />
                        Проверять дубликаты (необязательно — без галочки все строки импортируются)
                      </label>
                      {checkDuplicates ? (
                        <>
                          <p className="text-muted-foreground text-xs">
                            Отметьте поля (★ = рекомендуется). Совпадение с БД или с предыдущей строкой
                            файла пропускает создание.
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {CLIENT_IMPORT_DUPLICATE_KEY_OPTIONS.map(({ key, label }) => (
                              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="border-input h-4 w-4 rounded"
                                  checked={dupKeySet.has(key)}
                                  disabled={isSubmitting}
                                  onChange={(e) => {
                                    setDupKeySet((prev) => {
                                      const n = new Set(prev);
                                      if (e.target.checked) n.add(key);
                                      else n.delete(key);
                                      return n;
                                    });
                                  }}
                                />
                                {label}
                                {(RECOMMENDED_DUPLICATE_KEY_FIELDS as readonly string[]).includes(key) ? (
                                  <span className="text-amber-700 dark:text-amber-400 text-[10px]">★</span>
                                ) : null}
                              </label>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="bg-muted/40 space-y-2 rounded-md border border-border/80 p-3">
                      <p className="text-sm font-medium">Обновление — дубликаты уже включены</p>
                      <p className="text-muted-foreground text-xs">
                        Повторный ИД в файле и конфликт наименования / кода / ИНН / ПИНФЛ / телефона с
                        другим клиентом блокируют строку. Клиент без агента сохраняется; агент без
                        рабочего места не привязывается.
                      </p>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="border-input h-4 w-4 rounded"
                          checked={restrictUpdate}
                          disabled={isSubmitting}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setRestrictUpdate(on);
                            if (on && updateApplySet.size === 0) {
                              setUpdateApplySet(new Set(defaultUpdateApplyFieldKeys()));
                            }
                          }}
                        />
                        Обновлять только выбранные поля (иначе — все сопоставленные столбцы)
                      </label>
                      {restrictUpdate ? (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-muted-foreground text-xs">
                              Отметьте только то, что нужно изменить. Блок «Команда» по умолчанию
                              выключен — включите, если меняете агентов / дни / экспедиторов из файла.
                            </p>
                            <div className="flex shrink-0 flex-wrap items-center gap-1">
                              <span className="text-muted-foreground text-xs tabular-nums">
                                {updateApplySet.size} / {updateFieldOptions.length}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={isSubmitting || allUpdateFieldsSelected}
                                onClick={() => selectAllUpdateFields()}
                              >
                                Выбрать все
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={isSubmitting || noUpdateFieldsSelected}
                                onClick={() => deselectAllUpdateFields()}
                              >
                                Снять все
                              </Button>
                            </div>
                          </div>
                          <div className="max-h-56 space-y-3 overflow-y-auto rounded border border-border/60 bg-background/50 p-2">
                            <div>
                              <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
                                Основные поля
                              </p>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {baseUpdateOptions.map(({ key, label }) => (
                                  <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      className="border-input h-3.5 w-3.5 shrink-0 rounded"
                                      checked={updateApplySet.has(key)}
                                      disabled={isSubmitting}
                                      onChange={(e) => {
                                        setUpdateApplySet((prev) => {
                                          const n = new Set(prev);
                                          if (e.target.checked) n.add(key);
                                          else n.delete(key);
                                          return n;
                                        });
                                      }}
                                    />
                                    <span className="min-w-0">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="border-t border-border/50 pt-2">
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                                  Команда (агент · дни · экспедитор)
                                </p>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px]"
                                    disabled={isSubmitting || allTeamSelected}
                                    onClick={() => selectTeamUpdateFields()}
                                  >
                                    Вкл. команду
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px]"
                                    disabled={isSubmitting || noTeamSelected}
                                    onClick={() => deselectTeamUpdateFields()}
                                  >
                                    Выкл. команду
                                  </Button>
                                </div>
                              </div>
                              <p className="text-muted-foreground mb-1 text-[10px]">
                                Пустая ячейка не снимает назначение; «очистить» / clear — снимает.
                              </p>
                              <div className="grid gap-1 sm:grid-cols-2">
                                {teamUpdateOptions.map(({ key, label }) => (
                                  <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      className="border-input h-3.5 w-3.5 shrink-0 rounded"
                                      checked={updateApplySet.has(key)}
                                      disabled={isSubmitting}
                                      onChange={(e) => {
                                        setUpdateApplySet((prev) => {
                                          const n = new Set(prev);
                                          if (e.target.checked) n.add(key);
                                          else n.delete(key);
                                          return n;
                                        });
                                      }}
                                    />
                                    <span className="min-w-0">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[10rem] flex-1 space-y-1.5">
                  <Label htmlFor="import-sheet">Лист</Label>
                  <select
                    id="import-sheet"
                    className={selectClass}
                    value={sheetName}
                    disabled={isSubmitting}
                    onChange={(e) => setSheetName(e.target.value)}
                  >
                    {workbook.SheetNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-36 space-y-1.5">
                  <Label htmlFor="import-header-row">Строка заголовков (Excel)</Label>
                  <input
                    id="import-header-row"
                    type="number"
                    min={1}
                    max={Math.max(1, matrix.length)}
                    className={selectClass}
                    disabled={isSubmitting || matrix.length === 0}
                    value={headerRowOneBased}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n >= 1) setHeaderRowOneBased(n);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting || matrix.length === 0}
                  onClick={() => applyAutoMap()}
                >
                  Автосопоставление
                </Button>
              </div>

              {headerRowIdx >= matrix.length ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Строка заголовков вне таблицы. Введите номер от {1} до {Math.max(1, matrix.length)}.
                </p>
              ) : (
                <>
                  {detectedTeamFromFile.length > 0 ? (
                    <div className="rounded-md border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                      <strong>Команда в файле:</strong> {detectedTeamFromFile.slice(0, 12).join(", ")}
                      {detectedTeamFromFile.length > 12
                        ? ` … (+${detectedTeamFromFile.length - 12})`
                        : ""}
                      {importMode === "create"
                        ? " — при импорте новых клиентов эти столбцы читаются полностью."
                        : " — в обновлении отметьте блок «Команда» выше, если нужно менять назначения."}
                    </div>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4">
                  {CLIENT_IMPORT_MAPPABLE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <Label className="text-muted-foreground shrink-0 text-xs sm:w-[40%] sm:text-sm">
                        {label}
                      </Label>
                      <select
                        className={selectClass}
                        disabled={isSubmitting || fileColumnLabels.length === 0}
                        value={mappingSelect[key] ?? ""}
                        onChange={(e) =>
                          setMappingSelect((m) => ({
                            ...m,
                            [key]: e.target.value
                          }))
                        }
                      >
                        <option value="">— не выбрано —</option>
                        {fileColumnLabels.map((colLabel, idx) => (
                          <option key={`${key}-${idx}`} value={String(idx)}>
                            {idx + 1}. {colLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/80 bg-muted/30 p-4 sm:justify-between">
          <div className="text-destructive min-h-[1.25rem] text-xs sm:flex-1">{localErr}</div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={
                isSubmitting || !!parseError || !workbook || headerRowIdx >= matrix.length || !file
              }
              onClick={() => handleConfirm()}
            >
              {isSubmitting
                ? importMode === "update"
                  ? "Обновление…"
                  : "Импорт…"
                : importMode === "update"
                  ? "Сохранить (обновить)"
                  : "Начать импорт"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
