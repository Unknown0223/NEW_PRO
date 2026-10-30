"use client";

import { CLIENT_IMPORT_MAPPABLE_FIELDS } from "@/lib/client-import-fields";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { WorkBook } from "xlsx";
import type { ClientImportDecisionPreviewDto } from "./client-import-result-dialog";

type XlsxNs = typeof import("xlsx");

type ReviewRow = {
  excelRow: number;
  status: "ok" | "error" | "duplicate";
  message: string;
  fields: Set<string>;
  cells: Record<string, string>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  sheetName: string;
  headerRowIndex: number;
  columnMap: Record<string, number>;
  decisionPreview: ClientImportDecisionPreviewDto | null;
};

type ErrorSort = "none" | "errors_first" | "errors_last";

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function fieldLabel(key: string): string {
  return CLIENT_IMPORT_MAPPABLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** Import xatolari + qabul qilinadigan qatorlar jadvali (qizil ustunlar, xato boyicha sort, kaskad filter). */
export function ClientImportReviewDialog({
  open,
  onOpenChange,
  file,
  sheetName,
  headerRowIndex,
  columnMap,
  decisionPreview
}: Props) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [errorSort, setErrorSort] = useState<ErrorSort>("none");
  const [sortField, setSortField] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const mappedKeys = useMemo(
    () =>
      Object.entries(columnMap)
        .filter(([, idx]) => typeof idx === "number" && idx >= 0)
        .sort((a, b) => a[1] - b[1])
        .map(([k]) => k),
    [columnMap]
  );

  const errorFieldSet = useMemo(() => {
    const s = new Set<string>();
    for (const issue of decisionPreview?.rowIssues ?? []) {
      for (const f of issue.fields) s.add(f);
    }
    return s;
  }, [decisionPreview]);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    void (async () => {
      try {
        const XLSX = (await import("xlsx")) as XlsxNs;
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true }) as WorkBook;
        const sn = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
        const ws = sn ? wb.Sheets[sn] : undefined;
        if (!ws) {
          if (!cancelled) setParseErr("Лист не найден.");
          return;
        }
        const matrix = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
          raw: true,
          blankrows: true
        }) as unknown[][];
        const issueByRow = new Map(
          (decisionPreview?.rowIssues ?? []).map((i) => [i.excelRow, i] as const)
        );
        const out: ReviewRow[] = [];
        for (let i = headerRowIndex + 1; i < matrix.length; i++) {
          const row = matrix[i];
          if (!Array.isArray(row)) continue;
          const nameIdx = columnMap.name;
          const nameVal = typeof nameIdx === "number" ? cellStr(row[nameIdx]) : "";
          if (!nameVal || nameVal === "---") continue;
          const excelRow = i + 1;
          const issue = issueByRow.get(excelRow);
          const cells: Record<string, string> = {};
          for (const key of mappedKeys) {
            const idx = columnMap[key];
            cells[key] = typeof idx === "number" ? cellStr(row[idx]) : "";
          }
          out.push({
            excelRow,
            status: issue ? (issue.kind === "duplicate" ? "duplicate" : "error") : "ok",
            message: issue?.message ?? "",
            fields: new Set(issue?.fields ?? []),
            cells
          });
        }
        if (!cancelled) {
          setRows(out);
          setParseErr(null);
          setFilters({});
          setErrorSort("none");
          setSortField(null);
        }
      } catch (e) {
        if (!cancelled) setParseErr(e instanceof Error ? e.message : "Не удалось прочитать файл");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, file, sheetName, headerRowIndex, columnMap, mappedKeys, decisionPreview]);

  const cascadeOptions = useMemo(() => {
    const okRows = rows.filter((r) => r.status === "ok");
    const keys = ["region", "zone", "city", "category_code", "category_name", "import_agent_1"].filter(
      (k) => mappedKeys.includes(k)
    );
    const opts: Record<string, string[]> = {};
    for (const key of keys) {
      let pool = okRows;
      for (const [fk, fv] of Object.entries(filters)) {
        if (!fv || fk === key) continue;
        // kaskad: oldingi filterlar qo‘llangan qabul qilingan ma’lumotlar bo‘yicha
        const order = keys.indexOf(fk);
        const selfOrder = keys.indexOf(key);
        if (order >= 0 && selfOrder >= 0 && order > selfOrder) continue;
        pool = pool.filter((r) => r.cells[fk] === fv);
      }
      const set = new Set(pool.map((r) => r.cells[key]).filter(Boolean));
      opts[key] = [...set].sort((a, b) => a.localeCompare(b, "ru"));
    }
    return { keys, opts };
  }, [rows, mappedKeys, filters]);

  const filtered = useMemo(() => {
    let list = rows;
    for (const [k, v] of Object.entries(filters)) {
      if (!v) continue;
      list = list.filter((r) => r.cells[k] === v);
    }
    if (sortField) {
      const field = sortField;
      if (errorSort === "errors_first") {
        list = [...list].sort((a, b) => {
          const ae = a.fields.has(field) ? 0 : 1;
          const be = b.fields.has(field) ? 0 : 1;
          if (ae !== be) return ae - be;
          return a.excelRow - b.excelRow;
        });
      } else if (errorSort === "errors_last") {
        list = [...list].sort((a, b) => {
          const ae = a.fields.has(field) ? 0 : 1;
          const be = b.fields.has(field) ? 0 : 1;
          if (ae !== be) return be - ae;
          return a.excelRow - b.excelRow;
        });
      }
    }
    return list;
  }, [rows, filters, sortField, errorSort]);

  const cycleErrorSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setErrorSort("errors_first");
      return;
    }
    setErrorSort((prev) =>
      prev === "none" ? "errors_first" : prev === "errors_first" ? "errors_last" : "none"
    );
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-stretch justify-center bg-[#013532]/40 p-2 backdrop-blur-[1px] sm:p-4">
      <div
        className="flex h-full max-h-[96vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="client-import-review-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 id="client-import-review-title" className="text-lg font-bold text-foreground">
              Проверка импорта
            </h3>
            <p className="text-xs text-muted-foreground">
              Принято: {decisionPreview?.validCount ?? 0} · Ошибок:{" "}
              {(decisionPreview?.errorCount ?? 0) + (decisionPreview?.duplicateCount ?? 0)} · Показано:{" "}
              {filtered.length}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 hover:bg-muted"
            aria-label="Закрыть"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {cascadeOptions.keys.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-b border-border px-4 py-2">
            {cascadeOptions.keys.map((key) => (
              <label key={key} className="flex min-w-[140px] flex-col gap-0.5 text-[11px]">
                <span className={cn(errorFieldSet.has(key) && "font-semibold text-red-600")}>
                  {fieldLabel(key)}
                </span>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={filters[key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters((prev) => {
                      const next = { ...prev, [key]: v };
                      // keyindagi kaskadlarni tozalash
                      const idx = cascadeOptions.keys.indexOf(key);
                      for (let i = idx + 1; i < cascadeOptions.keys.length; i++) {
                        const k = cascadeOptions.keys[i]!;
                        next[k] = "";
                      }
                      return next;
                    });
                  }}
                >
                  <option value="">Все</option>
                  {(cascadeOptions.opts[key] ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          {parseErr ? (
            <p className="p-4 text-sm text-red-600">{parseErr}</p>
          ) : (
            <table className="w-full min-w-[800px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-muted/95">
                <tr>
                  <th className="border-b border-border px-2 py-2 font-semibold">#</th>
                  <th className="border-b border-border px-2 py-2 font-semibold">Статус</th>
                  {mappedKeys.map((key) => {
                    const hasErr = errorFieldSet.has(key);
                    const active = sortField === key && errorSort !== "none";
                    return (
                      <th
                        key={key}
                        className={cn(
                          "border-b border-border px-2 py-2 font-semibold",
                          hasErr && "text-red-600"
                        )}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          title="Сортировать по ошибкам в этом столбце"
                          onClick={() => cycleErrorSort(key)}
                        >
                          <span>{fieldLabel(key)}</span>
                          {active && errorSort === "errors_first" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : active && errorSort === "errors_last" ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  <th className="border-b border-border px-2 py-2 font-semibold">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.excelRow}
                    className={cn(
                      r.status !== "ok" && "bg-red-50/80 dark:bg-red-950/30",
                      r.status === "ok" && "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    <td className="border-b border-border/60 px-2 py-1.5 tabular-nums">{r.excelRow}</td>
                    <td className="border-b border-border/60 px-2 py-1.5">
                      {r.status === "ok" ? (
                        <span className="text-emerald-700">OK</span>
                      ) : r.status === "duplicate" ? (
                        <span className="font-medium text-red-700">Дубликат</span>
                      ) : (
                        <span className="font-medium text-red-700">Ошибка</span>
                      )}
                    </td>
                    {mappedKeys.map((key) => (
                      <td
                        key={key}
                        className={cn(
                          "border-b border-border/60 px-2 py-1.5",
                          r.fields.has(key) && "bg-red-100 font-medium text-red-800 dark:bg-red-900/40"
                        )}
                      >
                        {r.cells[key] || "—"}
                      </td>
                    ))}
                    <td className="border-b border-border/60 px-2 py-1.5 text-red-800">{r.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
