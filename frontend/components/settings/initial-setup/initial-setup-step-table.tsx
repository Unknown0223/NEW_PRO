"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { applyStepPreview } from "@/lib/initial-setup/apply-step";
import { isStepReady, missingDependencyTitles } from "@/lib/initial-setup/flow-order";
import {
  getStepTableConfig
} from "@/lib/initial-setup/ref-table-config";
import {
  emptyPreview,
  flattenTerritoryNodes,
  mergePreview,
  previewFromRows,
  profileToPreview
} from "@/lib/initial-setup/profile-to-preview";
import {
  previewHasBlockingErrors,
  updatePreviewCell
} from "@/lib/initial-setup/preview-xlsx";
import {
  getCellValue,
  normalizeRowCells,
  reindexPreviewRows,
  revalidatePreviewRows
} from "@/lib/initial-setup/row-validation";
import type { InitialSetupPreviewState, InitialSetupStep } from "@/lib/initial-setup/types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import type { StepTableColumn, StepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { formatNumberGrouped } from "@/lib/format-numbers";
import {
  RELATION_SOURCE_LABEL,
  loadRelationOptions,
  relationSourcesForColumns,
  type RelationOption,
  type RelationOptionsMap,
  type RelationSource
} from "@/lib/initial-setup/relation-options";
import { INPUT_SURFACE_CLASS } from "@/lib/ui-input-styles";
import { InitialSetupBulkToolbar } from "@/components/settings/initial-setup/initial-setup-bulk-toolbar";
import { importMessageIndicatesSuccess, isImportFailedError, isImportFailureMessage } from "@/lib/initial-setup/import-result";
import { ProductCatalogImportErrorsDialog } from "@/components/products/product-catalog-import-errors-dialog";

const FIELD_INPUT_CLASS =
  "h-9 min-w-0 w-full rounded-lg border-slate-200 bg-white text-sm shadow-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

function RelationSelect({
  value,
  options,
  enabled,
  isErr,
  placeholder,
  onChange
}: {
  value: string;
  options: RelationOption[];
  enabled: boolean;
  isErr: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const hasValue = Boolean(value.trim());
  const known = options.some((o) => o.value === value);
  return (
    <select
      className={cn(
        INPUT_SURFACE_CLASS,
        FIELD_INPUT_CLASS,
        "appearance-none bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8",
        isErr && "border-destructive bg-destructive/5 text-destructive focus-visible:ring-destructive/30"
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"
      }}
      value={value}
      disabled={!enabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{options.length ? `— ${placeholder} —` : "Avval bog‘liq ma’lumot qo‘shing"}</option>
      {hasValue && !known ? <option value={value}>{value} (joriy)</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StepFieldInput({
  col,
  value,
  readOnly,
  enabled,
  isErr,
  errorTitle,
  options,
  onChange
}: {
  col: StepTableColumn;
  value: string;
  readOnly: boolean;
  enabled: boolean;
  isErr: boolean;
  errorTitle?: string;
  options?: RelationOption[];
  onChange: (v: string) => void;
}) {
  if (readOnly) {
    const shown =
      col.numeric && value
        ? formatNumberGrouped(value, { maxFractionDigits: col.maxFractionDigits ?? 6 })
        : value || "—";
    return <span className={cn("block px-1.5 text-sm", col.numeric && "text-right tabular-nums")}>{shown}</span>;
  }

  if (col.relation) {
    return (
      <RelationSelect
        value={value}
        options={options ?? []}
        enabled={enabled}
        isErr={isErr}
        placeholder={col.header.replace(/\s*\*$/, "")}
        onChange={onChange}
      />
    );
  }

  return (
    <Input
      type={col.numeric ? "number" : "text"}
      maxFractionDigits={col.maxFractionDigits ?? 6}
      allowNegative={false}
      className={cn(
        FIELD_INPUT_CLASS,
        isErr && "border-destructive bg-destructive/5 text-destructive focus-visible:ring-destructive/30"
      )}
      value={value}
      disabled={!enabled}
      placeholder={col.header.replace(/\s*\*$/, "")}
      title={errorTitle}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function RelationHintsBar({
  columns,
  optionsMap
}: {
  columns: StepTableColumn[];
  optionsMap: RelationOptionsMap;
}) {
  const items = columns
    .filter((c) => c.relation)
    .map((c) => {
      const src = c.relation as RelationSource;
      const opts = optionsMap[src] ?? [];
      return { key: c.key, header: c.header, label: RELATION_SOURCE_LABEL[src], count: opts.length, opts };
    });
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80">
        Bog‘liq ma’lumotlar (tanlash)
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
              it.count > 0
                ? "border-emerald-200 bg-white text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            )}
            title={it.opts
              .slice(0, 12)
              .map((o) => o.label)
              .join(", ")}
          >
            <span className="font-medium">{it.label}</span>
            <span className="tabular-nums text-muted-foreground">{it.count}</span>
            {it.count === 0 ? <span className="text-amber-700">— avval qo‘shing</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

type Props = {
  tenantSlug: string;
  step: InitialSetupStep;
  enabled: boolean;
  /** Bog‘liqlik bajarilgan qadamlar (progress + tizim) */
  effectiveDoneIds?: ReadonlySet<string>;
  /** Excel yoki bundle dan kelgan qatorlar — jadvalga yoziladi */
  externalPreview?: InitialSetupPreviewState | null;
  compact?: boolean;
  onApplied?: (message: string) => void;
  onFailed?: (message: string, errors?: string[]) => void;
};

export function InitialSetupStepTable({
  tenantSlug,
  step,
  enabled,
  effectiveDoneIds,
  externalPreview,
  compact,
  onApplied,
  onFailed
}: Props) {
  const qc = useQueryClient();
  const config = getStepTableConfig(step.id);
  const [preview, setPreview] = useState<InitialSetupPreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{
    title: string;
    summary: string | null;
    errors: string[];
  } | null>(null);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(() => new Set());
  const [bulkDraft, setBulkDraft] = useState<Record<string, string>>({});

  function showFailure(message: string, errors?: string[]) {
    setMsg(message);
    if (errors?.length) {
      setErrorDialog({
        title: "Import — xatolar",
        summary: message,
        errors
      });
    }
    onFailed?.(message, errors);
  }

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(
      config &&
        (config.mode === "profile" ||
          config.mode === "company-form" ||
          config.stepId === "territory")
    ),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        name: string;
        phone: string | null;
        address: string | null;
        references: Record<string, unknown>;
      }>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const entityListQ = useQuery({
    queryKey: ["initial-setup-entity", step.id, tenantSlug],
    enabled: Boolean(config?.mode === "entity-create" && config.entityKind),
    staleTime: STALE.list,
    queryFn: async () => {
      if (config!.entityKind === "warehouses") {
        const { data } = await api.get<{ data?: { name: string; code?: string | null; address?: string | null }[] }>(
          `/api/${tenantSlug}/warehouses`
        );
        return { kind: "warehouses" as const, rows: data.data ?? [] };
      }
      const { data } = await api.get<{
        data?: { id: number; name: string; code?: string | null; parent_id?: number | null }[];
      }>(`/api/${tenantSlug}/product-categories`);
      return { kind: "product-categories" as const, rows: data.data ?? [] };
    }
  });

  const readonlyQ = useQuery({
    queryKey: ["initial-setup-readonly", step.id, tenantSlug],
    enabled: Boolean(config?.mode === "readonly-api" && config.readonlyFetchPath),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get(`/api/${tenantSlug}${config!.readonlyFetchPath}`);
      return data;
    }
  });

  const relationSources = useMemo(
    () => relationSourcesForColumns(config?.columns ?? []),
    [config?.columns]
  );

  const relationQ = useQuery({
    queryKey: ["initial-setup-relations", tenantSlug, step.id, relationSources.join("|")],
    enabled: Boolean(tenantSlug && relationSources.length),
    staleTime: STALE.list,
    queryFn: () => loadRelationOptions(tenantSlug, relationSources)
  });

  /** Joriy jadvaldagi nomlar ham parent tanloviga qo‘shiladi (hali saqlanmagan) */
  const relationOptionsMap = useMemo((): RelationOptionsMap => {
    const base: RelationOptionsMap = { ...(relationQ.data ?? {}) };
    const namesFromPreview = (preview?.rows ?? [])
      .map((r) => (r.cells.name ?? "").trim())
      .filter(Boolean)
      .map((name) => ({ value: name, label: name }));

    const merge = (src: RelationSource) => {
      const prev = base[src] ?? [];
      const seen = new Set(prev.map((o) => o.value.toLowerCase()));
      const extra = namesFromPreview.filter((o) => !seen.has(o.value.toLowerCase()));
      if (extra.length) base[src] = [...prev, ...extra];
    };

    if (config?.stepId === "product-categories") merge("product-category-parent");
    return base;
  }, [relationQ.data, preview?.rows, config?.stepId]);

  function optionsForCol(col: StepTableColumn): RelationOption[] | undefined {
    if (!col.relation) return undefined;
    return relationOptionsMap[col.relation] ?? [];
  }

  const loadedPreview = useMemo(() => {
    if (!config) return null;
    if (config.stepId === "territory" || config.profileRefKey === "territory_nodes") {
      const nodes = profileQ.data?.references?.territory_nodes;
      const rows = flattenTerritoryNodes(nodes);
      return rows.length ? previewFromRows(config, rows) : emptyPreview(config);
    }
    if (config.mode === "entity-create" && entityListQ.data) {
      const rows: { rowIndex: number; cells: Record<string, string> }[] = [];
      if (entityListQ.data.kind === "warehouses") {
        entityListQ.data.rows.forEach((w, i) => {
          rows.push({
            rowIndex: i + 1,
            cells: { name: w.name, code: w.code ?? "", address: w.address ?? "" }
          });
        });
      } else {
        const list = entityListQ.data.rows as {
          id: number;
          name: string;
          code?: string | null;
          parent_id?: number | null;
        }[];
        const byId = new Map(list.map((x) => [x.id, x]));
        list.forEach((c, i) => {
          const parent = c.parent_id != null ? byId.get(c.parent_id)?.name ?? "" : "";
          rows.push({
            rowIndex: i + 1,
            cells: { name: c.name, code: c.code ?? "", parent }
          });
        });
      }
      return previewFromRows(config, rows);
    }
    if (config.mode === "readonly-api") {
      const rows: { rowIndex: number; cells: Record<string, string> }[] = [];
      if (config.stepId === "warehouses") {
        const list = (readonlyQ.data as { data?: { name: string; code?: string | null; branch?: { name?: string } }[] })
          ?.data ?? [];
        list.forEach((w, i) => {
          rows.push({
            rowIndex: i + 1,
            cells: { name: w.name, code: w.code ?? "", branch: w.branch?.name ?? "" }
          });
        });
      } else if (config.stepId === "product-categories") {
        const list =
          (readonlyQ.data as { data?: { id: number; name: string; code?: string | null; parent_id?: number | null }[] })
            ?.data ?? [];
        const byId = new Map(list.map((x) => [x.id, x]));
        list.forEach((c, i) => {
          const pid = c.parent_id;
          const parent = pid != null ? byId.get(pid)?.name ?? "" : "";
          rows.push({
            rowIndex: i + 1,
            cells: { name: c.name, code: c.code ?? "", parent }
          });
        });
      }
      return previewFromRows(config, rows);
    }
    if (config.mode === "company-form" || config.mode === "profile") {
      const fromProfile = profileToPreview(
        config,
        profileQ.data?.references,
        profileQ.data
          ? { name: profileQ.data.name, phone: profileQ.data.phone, address: profileQ.data.address }
          : undefined
      );
      return fromProfile ?? emptyPreview(config);
    }
    return emptyPreview(config);
  }, [config, profileQ.data, readonlyQ.data, entityListQ.data]);

  useEffect(() => {
    if (!loadedPreview || !config) return;
    const merged = mergePreview(loadedPreview, externalPreview, config);
    setPreview({ ...merged, rows: reindexPreviewRows(merged.rows) });
    setSelectedRowIndexes(new Set());
    setBulkDraft({});
  }, [loadedPreview, externalPreview, config]);

  const depsOk = useMemo(() => {
    if (!effectiveDoneIds) return true;
    return isStepReady(step, effectiveDoneIds).ok;
  }, [step, effectiveDoneIds]);

  const depsBlockedMsg = useMemo(() => {
    if (!effectiveDoneIds || depsOk) return null;
    return `Сначала выполните: ${missingDependencyTitles(step, effectiveDoneIds).join(" → ")}`;
  }, [step, effectiveDoneIds, depsOk]);

  const canApply = enabled && depsOk;

  const hasErrors = useMemo(() => (preview ? previewHasBlockingErrors(preview) : false), [preview]);

  const columnDefs = useMemo(() => {
    if (!config) return [] as Array<{ header: string; key: string; meta?: StepTableColumn }>;
    // Always prefer live config columns so HMR / schema updates are visible
    return config.columns.map((c) => ({ header: c.header, key: c.key, meta: c }));
  }, [config]);

  function resolveColMeta(key: string, header: string): StepTableColumn {
    const fromConfig = config?.columns.find((c) => c.key === key);
    if (fromConfig) return fromConfig;
    return {
      key,
      header,
      numeric: /цена|price|количеств|qty|sort|сумм|miqdor|soni|широт|долгот/i.test(header)
    };
  }

  function setCell(rowIndex: number, key: string, value: string) {
    setPreview((p) => (p && config ? updatePreviewCell(p, rowIndex, key, value, config) : p));
  }

  const allRowsSelected =
    Boolean(preview?.rows.length) && preview!.rows.every((r) => selectedRowIndexes.has(r.rowIndex));
  const someRowsSelected = selectedRowIndexes.size > 0 && !allRowsSelected;

  function toggleRowSelection(rowIndex: number, checked: boolean) {
    setSelectedRowIndexes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowIndex);
      else next.delete(rowIndex);
      return next;
    });
  }

  function toggleAllRows(checked: boolean) {
    if (!preview) return;
    setSelectedRowIndexes(checked ? new Set(preview.rows.map((r) => r.rowIndex)) : new Set());
  }

  function clearRowSelection() {
    setSelectedRowIndexes(new Set());
    setBulkDraft({});
  }

  function applyBulkColumn(colKey: string) {
    const value = (bulkDraft[colKey] ?? "").trim();
    if (!value || !preview || !config) return;
    let next = preview;
    for (const rowIndex of selectedRowIndexes) {
      next = updatePreviewCell(next, rowIndex, colKey, value, config);
    }
    setPreview(next);
  }

  if (!config) {
    return (
      <p className="text-xs text-muted-foreground">
        Vizual jadval mavjud emas.{" "}
        {step.settingsHref ? (
          <Link href={step.settingsHref} className="text-primary underline-offset-4 hover:underline">
            Asosiy sozlamalar
          </Link>
        ) : null}
      </p>
    );
  }

  const readOnly = config.mode === "readonly-api";

  function addRow() {
    if (!preview || readOnly) return;
    const cells: Record<string, string> = {};
    for (const col of config!.columns) {
      if (col.key === "kind") {
        cells[col.key] = "sale";
      } else if (col.relation === "payment-method") {
        cells[col.key] = relationOptionsMap["payment-method"]?.[0]?.value ?? "";
      } else {
        cells[col.key] = "";
      }
    }
    const nextRows = [
      ...preview.rows,
      {
        rowIndex: preview.rows.reduce((m, r) => Math.max(m, r.rowIndex), 0) + 1,
        cells,
        errors: [] as string[],
        warnings: [] as string[]
      }
    ];
    setPreview({
      ...preview,
      rows: revalidatePreviewRows(nextRows, config!)
    });
  }

  function removeRow(rowIndex: number) {
    if (!preview || readOnly) return;
    setSelectedRowIndexes((prev) => {
      const next = new Set(prev);
      next.delete(rowIndex);
      return next;
    });
    setPreview({
      ...preview,
      rows: revalidatePreviewRows(
        preview.rows.filter((r) => r.rowIndex !== rowIndex),
        config!
      )
    });
  }

  async function apply() {
    if (!preview?.rows.length) {
      setMsg("Ma’lumot yo‘q — Excel yuklang yoki qator qo‘shing");
      return;
    }
    if (!canApply) {
      setMsg(depsBlockedMsg ?? "Avval oldingi qadamlarni bajaring");
      return;
    }

    const normalized: InitialSetupPreviewState = {
      ...preview,
      rows: revalidatePreviewRows(preview.rows, config!)
    };
    setPreview(normalized);

    if (previewHasBlockingErrors(normalized)) {
      const n = normalized.rows.filter((r) => r.errors.length).length;
      const lines = normalized.rows
        .filter((r) => r.errors.length)
        .flatMap((r) => r.errors.map((e) => `Строка ${r.rowIndex}: ${e}`));
      showFailure(`Xatolarni tuzating: ${n} qator (dublikat / majburiy maydon)`, lines);
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const message = await applyStepPreview(tenantSlug, step, normalized, qc);
      if (step.importApi && !importMessageIndicatesSuccess(message)) {
        showFailure(message || "Импорт не сохранил строки — проверьте категории в справочнике");
        return;
      }
      setMsg(message);
      onApplied?.(message);
      await qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["initial-setup-relations", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["initial-setup-entity", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["initial-setup-readiness", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
    } catch (e) {
      if (isImportFailedError(e)) {
        showFailure(e.message, e.errors);
      } else {
        showFailure(getUserFacingError(e, "Saqlash xatosi"));
      }
    } finally {
      setBusy(false);
    }
  }

  const errorCount = preview?.rows.filter((r) => r.errors.length).length ?? 0;
  const loading = profileQ.isLoading || readonlyQ.isLoading || entityListQ.isLoading;

  function renderTableView(cfg: StepTableConfig) {
    if (!preview) return null;
    return (
      <div
        className={cn(
          "max-h-[28rem] overflow-auto rounded-xl border border-border/80 bg-background shadow-sm",
          selectedRowIndexes.size > 0 && "mb-24"
        )}
      >
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur">
              {!readOnly ? (
                <th className="w-10 border-b px-2 py-2.5">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={allRowsSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someRowsSelected;
                    }}
                    disabled={!enabled}
                    aria-label="Выбрать все строки"
                    onChange={(e) => toggleAllRows(e.target.checked)}
                  />
                </th>
              ) : null}
              <th className="border-b px-3 py-2.5 text-left text-xs font-semibold text-slate-600">#</th>
              {columnDefs.map((col) => (
                <th key={col.key} className="border-b px-3 py-2.5 text-left text-xs font-semibold text-slate-600">
                  {col.header}
                  {cfg.columns.find((c) => c.key === col.key)?.required ? (
                    <span className="text-destructive"> *</span>
                  ) : null}
                </th>
              ))}
              <th className="border-b px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Статус</th>
              {!readOnly ? <th className="w-10 border-b px-2 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr
                key={row.rowIndex}
                className={cn(
                  "transition-colors",
                  selectedRowIndexes.has(row.rowIndex) && "bg-teal-50/70",
                  row.errors.length
                    ? "bg-destructive/[0.04]"
                    : row.warnings.length
                      ? "bg-amber-50/60"
                      : !selectedRowIndexes.has(row.rowIndex) && "hover:bg-slate-50/80"
                )}
              >
                {!readOnly ? (
                  <td className="border-b border-border/60 px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={selectedRowIndexes.has(row.rowIndex)}
                      disabled={!enabled}
                      aria-label={`Выбрать строку ${row.rowIndex}`}
                      onChange={(e) => toggleRowSelection(row.rowIndex, e.target.checked)}
                    />
                  </td>
                ) : null}
                <td className="border-b border-border/60 px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
                  {row.rowIndex}
                </td>
                {columnDefs.map((col) => {
                  const meta = resolveColMeta(col.key, col.header);
                  const isDup = Boolean(row.errorFields?.includes(col.key));
                  const isErr =
                    isDup ||
                    row.errors.some((e) => e.includes(col.header) || e.includes(`«${col.header}»`));
                  const errTitle = isDup
                    ? row.errors.find((e) => e.startsWith("Дубликат"))
                    : row.errors.find((e) => e.includes(col.header));
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "border-b border-border/60 px-1.5 py-1",
                        isDup && "bg-destructive/10"
                      )}
                    >
                      <StepFieldInput
                        col={meta}
                        value={getCellValue(row.cells, col.key, config) || row.cells[col.key] || ""}
                        readOnly={readOnly}
                        enabled={enabled}
                        isErr={isErr}
                        errorTitle={errTitle}
                        options={optionsForCol(meta)}
                        onChange={(v) => setCell(row.rowIndex, col.key, v)}
                      />
                    </td>
                  );
                })}
                <td className="border-b border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                  {row.errors.length ? (
                    <span className="font-medium text-destructive">{row.errors.join("; ")}</span>
                  ) : row.warnings.length ? (
                    row.warnings.join("; ")
                  ) : (
                    <span className="font-medium text-emerald-700">OK</span>
                  )}
                </td>
                {!readOnly ? (
                  <td className="border-b border-border/60 px-1 py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      disabled={!enabled}
                      onClick={() => removeRow(row.rowIndex)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn("mt-3 space-y-3", compact && "text-xs")}>
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Tizimdan yuklanmoqda…
        </p>
      ) : null}

      {depsBlockedMsg ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {depsBlockedMsg}
        </p>
      ) : null}

      {readOnly ? (
        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Tizimdagi ma’lumot (o‘qish). Tahrirlash — asosiy sozlamalar sahifasida.
          {step.settingsHref ? (
            <>
              {" "}
              <Link href={step.settingsHref} className="font-medium text-primary underline-offset-4 hover:underline">
                Ochish →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {relationSources.length ? (
        <RelationHintsBar columns={config.columns} optionsMap={relationOptionsMap} />
      ) : null}

      {preview && preview.rows.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              <CheckCircle2 className="size-3" /> {preview.rows.length - errorCount} OK
            </span>
            {errorCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                <AlertCircle className="size-3" /> {errorCount} xato
              </span>
            ) : null}
          </div>
          {errorCount > 0 ? (
            <div className="max-h-20 space-y-0.5 overflow-auto rounded-md border border-destructive/20 bg-destructive/5 px-2 py-1.5">
              {preview.rows
                .filter((r) => r.errors.length)
                .map((r) => (
                  <p key={r.rowIndex} className="text-[11px] text-destructive">
                    Qator {r.rowIndex}: {r.errors.join("; ")}
                  </p>
                ))}
            </div>
          ) : null}
          {renderTableView(config)}
          {!readOnly ? (
            <InitialSetupBulkToolbar
              selectedCount={selectedRowIndexes.size}
              totalCount={preview.rows.length}
              columns={config.columns}
              relationOptionsMap={relationOptionsMap}
              draft={bulkDraft}
              onDraftChange={(key, value) => setBulkDraft((prev) => ({ ...prev, [key]: value }))}
              onApplyColumn={applyBulkColumn}
              onClear={clearRowSelection}
              enabled={enabled}
            />
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            {readOnly ? "Tizimda hali ma’lumot yo‘q" : "Ma’lumot qo‘shing"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {readOnly
              ? "Asosiy sozlamalarda yarating yoki Excel shablondan yuklang"
              : "«Qator» tugmasi yoki Excel shablon orqali to‘ldiring"}
          </p>
        </div>
      )}

      {msg ? (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isImportFailureMessage(msg)
              ? "border border-destructive/30 bg-destructive/10 font-medium text-destructive"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
          role="alert"
        >
          {msg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-slate-50/60 px-3 py-2.5">
        {!readOnly ? (
          <>
            <p className="mr-auto w-full text-[11px] text-muted-foreground sm:w-auto">
              Virtual holat — tahrirlang, dublikatlar qizil. Keyin tasdiqlang.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg text-sm"
              disabled={!enabled}
              onClick={addRow}
            >
              <Plus className="size-4" />
              Qator qo‘shish
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-lg text-sm"
              disabled={!canApply || busy || hasErrors || !preview?.rows.length}
              title={
                !canApply
                  ? (depsBlockedMsg ?? "Avval oldingi qadamlarni bajaring")
                  : hasErrors
                    ? "Jadvaldagi xatolarni tuzating"
                    : undefined
              }
              onClick={() => void apply()}
            >
              {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Qo‘llash (tizimga)
            </Button>
          </>
        ) : step.settingsHref ? (
          <Link
            href={step.settingsHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-lg text-sm")}
          >
            Asosiy sozlamalarda tahrirlash
          </Link>
        ) : null}
      </div>

      <ProductCatalogImportErrorsDialog
        open={errorDialog != null}
        onOpenChange={(open) => {
          if (!open) setErrorDialog(null);
        }}
        title={errorDialog?.title ?? "Import — xatolar"}
        summary={errorDialog?.summary}
        errors={errorDialog?.errors ?? []}
      />
    </div>
  );
}
