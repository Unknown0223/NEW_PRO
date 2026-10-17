"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Upload, X } from "lucide-react";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import {
  STAFF_IMPORT_ROLE_OPTIONS,
  isStaffOfficeWebRole,
  parseStaffImportWorkbookForKind,
  patchPreviewCell,
  previewSheetLabel,
  rebuildStaffImportWorkbookFile,
  type StaffImportKind,
  type StaffImportPreviewSheet,
  type StaffImportRoleChoice
} from "@/lib/staff-import-workbook";

export type WorkSlotsStaffImportResult = {
  created: number;
  updated: number;
  errors: string[];
  importStats?: {
    totalRows: number;
    processedRows: number;
    skippedEmpty: number;
  };
  byKind?: Partial<Record<StaffImportKind, WorkSlotsStaffImportResult>>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  onSuccess?: (result: WorkSlotsStaffImportResult) => void;
};

type Stage = "pick" | "preview" | "done";

export function WorkSlotsStaffImportDialog({
  open,
  onOpenChange,
  tenantSlug,
  onSuccess
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState<StaffImportRoleChoice>("all");
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<StaffImportPreviewSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<WorkSlotsStaffImportResult | null>(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);

  const reset = useCallback(() => {
    setStage("pick");
    setFile(null);
    setSheets([]);
    setActiveSheet(0);
    setBusy(false);
    setErr(null);
    setResult(null);
  }, []);

  const close = useCallback(() => {
    if (busy) return;
    reset();
    onOpenChange(false);
  }, [busy, onOpenChange, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  const measureTabs = useCallback(() => {
    const el = tabsRef.current;
    if (!el) {
      setTabsOverflow(false);
      return;
    }
    setTabsOverflow(el.scrollWidth > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    if (stage !== "preview") return;
    measureTabs();
    const el = tabsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureTabs());
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage, sheets, measureTabs]);

  const current = sheets[activeSheet] ?? null;

  const downloadTemplate = useCallback(async () => {
    if (!tenantSlug) return;
    setErr(null);
    try {
      // Backend accepts mode=all and/or kind=all (legacy required only ?kind=…)
      const qs = role === "all" ? "mode=all&kind=all" : `kind=${encodeURIComponent(role)}`;
      const res = await api.get(`/api/${tenantSlug}/staff/import/template?${qs}`, {
        responseType: "blob"
      });
      const blob = res.data as Blob;
      const ct = String(res.headers?.["content-type"] ?? "").toLowerCase();
      if (ct.includes("application/json") || blob.type.includes("application/json")) {
        const text = await blob.text();
        try {
          const j = JSON.parse(text) as { message?: string; error?: string };
          setErr(j.message?.trim() || j.error?.trim() || "Не удалось скачать шаблон Excel");
        } catch {
          setErr("Не удалось скачать шаблон Excel");
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        role === "all"
          ? "staff_all_roles_import_template.xlsx"
          : `staff_${role}_import_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(getUserFacingError(e, "Не удалось скачать шаблон Excel"));
    }
  }, [tenantSlug, role]);

  const loadPreview = useCallback(
    async (f: File) => {
      setBusy(true);
      setErr(null);
      setResult(null);
      try {
        const parsed = await parseStaffImportWorkbookForKind(f, role);
        if (!parsed.length) {
          setErr(
            "В файле не найдены листы ролей (Агенты, Менеджеры, Операторы, …). Скачайте шаблон и заполните его."
          );
          setFile(f);
          setSheets([]);
          setStage("pick");
          return;
        }
        setFile(f);
        setSheets(parsed);
        setActiveSheet(0);
        setStage("preview");
      } catch (e) {
        const detail = e instanceof Error && e.message.trim() ? e.message.trim() : "";
        setErr(
          detail && detail.length < 200
            ? `Не удалось прочитать Excel файл: ${detail}`
            : "Не удалось прочитать Excel файл. Скачайте шаблон и заполните его."
        );
      } finally {
        setBusy(false);
      }
    },
    [role]
  );

  const cancelPreview = useCallback(() => {
    setSheets([]);
    setFile(null);
    setActiveSheet(0);
    setStage("pick");
    setErr(null);
  }, []);

  const confirmImport = useCallback(async () => {
    if (!tenantSlug || sheets.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const baseName = file?.name?.replace(/\.(xlsx|xls)$/i, "") || "staff_import";
      const rebuilt = rebuildStaffImportWorkbookFile(sheets, `${baseName}_edited.xlsx`);
      const fd = new FormData();
      fd.append("file", rebuilt);

      const multi = sheets.length > 1 || role === "all";
      const first = sheets[0]!;
      const qs = multi
        ? "mode=all&kind=all"
        : isStaffOfficeWebRole(role)
          ? `kind=${encodeURIComponent(role)}`
          : first.defaultWebRole
            ? `kind=${encodeURIComponent(first.defaultWebRole)}`
            : `kind=${encodeURIComponent(first.kind)}`;

      const { data } = await api.post<{ data: WorkSlotsStaffImportResult }>(
        `/api/${tenantSlug}/staff/import.xlsx?${qs}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const r = data.data;
      setResult(r);
      setStage("done");
      onSuccess?.(r);
    } catch (e) {
      setErr(getUserFacingError(e, "Ошибка импорта Excel"));
    } finally {
      setBusy(false);
    }
  }, [tenantSlug, sheets, file, role, onSuccess]);

  const scrollTabs = (dir: -1 | 1) => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  const statsLine = useMemo(() => {
    if (!result) return null;
    return (
      <>
        Создано: {result.created}, обновлено: {result.updated}
        {result.errors.length ? `, ошибок: ${result.errors.length}` : ""}
      </>
    );
  }, [result]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex animate-in fade-in items-center justify-center bg-[#013532]/30 backdrop-blur-[1px] duration-150"
      role="presentation"
      onClick={() => !busy && close()}
    >
      <div
        ref={panelRef}
        className={cn(
          "mx-4 flex w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl",
          stage === "preview"
            ? "h-[min(92vh,880px)] max-w-[min(96vw,1100px)]"
            : "max-w-[720px]"
        )}
        role="dialog"
        aria-modal
        aria-labelledby="work-slots-staff-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h3
              id="work-slots-staff-import-title"
              className="text-lg font-bold text-gray-800"
            >
              Импорт сотрудников
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Шаблон по роли или все роли (несколько листов). Перед записью — проверка и правка.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="rounded-lg p-1 transition-colors hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {stage === "pick" || stage === "done" ? (
          <div className="space-y-4 px-6 py-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                Роль для шаблона / импорта
                <select
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-slate-800"
                  value={role}
                  disabled={busy || stage === "done"}
                  onChange={(e) => setRole(e.target.value as StaffImportRoleChoice)}
                >
                  {STAFF_IMPORT_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-muted disabled:opacity-60"
                onClick={() => void downloadTemplate()}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Скачать шаблон
              </button>
            </div>

            {stage === "pick" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ExcelFileDropZone
                  file={file}
                  disabled={busy}
                  emptyLabel="Выберите Excel файл"
                  dropHint="или перетащите сюда"
                  onFile={(f) => {
                    setErr(null);
                    void loadPreview(f);
                  }}
                  onInvalid={(msg) => setErr(msg)}
                />
                <div className="flex flex-col justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-slate-500">
                  После выбора файла откроется таблица для проверки. Импорт в базу — только после
                  «Подтвердить».
                </div>
              </div>
            ) : null}

            {err ? <p className="text-xs text-red-600">{err}</p> : null}

            {result ? (
              <div className="max-h-56 overflow-auto rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                <p className="font-medium text-slate-800">{statsLine}</p>
                {result.importStats ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Строк: {result.importStats.totalRows}, обработано:{" "}
                    {result.importStats.processedRows}, пустых:{" "}
                    {result.importStats.skippedEmpty}
                  </p>
                ) : null}
                {result.errors.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
                    {result.errors.slice(0, 40).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                    {result.errors.length > 40 ? (
                      <li>…и ещё {result.errors.length - 40}</li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-emerald-700">Импорт завершён без ошибок.</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    onClick={() => {
                      setResult(null);
                      setStage("pick");
                      setFile(null);
                      setSheets([]);
                    }}
                  >
                    Импортировать ещё
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                    onClick={close}
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Сопоставление по логину или коду. Если пароль не указан — для новых используется
                Parol123!. Колонка «Рабочее место» привязывает сотрудника к слоту по коду.
              </p>
            )}
          </div>
        ) : null}

        {stage === "preview" && current ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-6 py-2 text-xs text-slate-600">
              <span>
                Лист: <strong className="text-slate-800">{current.name}</strong> (
                {previewSheetLabel(current)})
              </span>
              <span className="text-slate-400">·</span>
              <span>Строк: {current.rows.length}</span>
              <span className="ml-auto text-slate-500">
                Правьте ячейки, затем подтвердите импорт
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
              <table className="min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-[1] bg-slate-100">
                  <tr>
                    <th className="sticky left-0 z-[2] border border-border bg-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                      #
                    </th>
                    {current.headers.map((h, ci) => (
                      <th
                        key={`${h}-${ci}`}
                        className="whitespace-nowrap border border-border px-2 py-1.5 text-left font-semibold text-slate-700"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.rows.map((row, ri) => (
                    <tr key={ri} className="odd:bg-white even:bg-slate-50/60">
                      <td className="sticky left-0 z-[1] border border-border bg-inherit px-2 py-0.5 text-slate-400">
                        {ri + 1}
                      </td>
                      {current.headers.map((_, ci) => (
                        <td key={ci} className="border border-border p-0">
                          <input
                            className="h-8 w-full min-w-[7rem] bg-transparent px-2 text-xs outline-none focus:bg-emerald-50"
                            value={row[ci] ?? ""}
                            disabled={busy}
                            onChange={(e) =>
                              setSheets((prev) =>
                                patchPreviewCell(prev, activeSheet, ri, ci, e.target.value)
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {current.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={current.headers.length + 1}
                        className="border border-border px-3 py-6 text-center text-slate-400"
                      >
                        Нет строк данных на этом листе
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Excel-like sheet tabs */}
            <div className="flex shrink-0 items-center gap-1 border-t border-border bg-slate-50 px-2 py-1.5">
              {tabsOverflow ? (
                <button
                  type="button"
                  className="rounded p-1 text-slate-500 hover:bg-muted"
                  aria-label="Листы влево"
                  onClick={() => scrollTabs(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
              <div
                ref={tabsRef}
                className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto scrollbar-none"
                style={{ scrollbarWidth: "none" }}
              >
                {sheets.map((s, i) => (
                  <button
                    key={`${s.kind}-${s.defaultWebRole ?? ""}-${s.name}`}
                    type="button"
                    disabled={busy}
                    onClick={() => setActiveSheet(i)}
                    className={cn(
                      "shrink-0 rounded-t-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      i === activeSheet
                        ? "border-b-card border-border bg-card text-emerald-800 shadow-sm"
                        : "border-transparent text-slate-600 hover:bg-white/80"
                    )}
                  >
                    {previewSheetLabel(s)}
                  </button>
                ))}
              </div>
              {tabsOverflow ? (
                <button
                  type="button"
                  className="rounded p-1 text-slate-500 hover:bg-muted"
                  aria-label="Листы вправо"
                  onClick={() => scrollTabs(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {err ? <p className="px-6 py-1 text-xs text-red-600">{err}</p> : null}

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-3">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-muted disabled:opacity-60"
                onClick={cancelPreview}
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busy || sheets.every((s) => s.rows.length === 0)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors",
                  busy || sheets.every((s) => s.rows.length === 0)
                    ? "cursor-not-allowed bg-emerald-300"
                    : "bg-emerald-500 hover:bg-emerald-600"
                )}
                onClick={() => void confirmImport()}
              >
                <Upload className="h-4 w-4" />
                {busy ? "Импорт…" : "Подтвердить"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
