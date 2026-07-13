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
import { validateRowCells, reindexPreviewRows } from "@/lib/initial-setup/row-validation";
import type { InitialSetupPreviewState, InitialSetupStep } from "@/lib/initial-setup/types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

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
};

export function InitialSetupStepTable({
  tenantSlug,
  step,
  enabled,
  effectiveDoneIds,
  externalPreview,
  compact,
  onApplied
}: Props) {
  const qc = useQueryClient();
  const config = getStepTableConfig(step.id);
  const [preview, setPreview] = useState<InitialSetupPreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(config && (config.mode === "profile" || config.mode === "company-form" || config.stepId === "territory")),
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

  const readonlyQ = useQuery({
    queryKey: ["initial-setup-readonly", step.id, tenantSlug],
    enabled: Boolean(config?.mode === "readonly-api" && config.readonlyFetchPath),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get(`/api/${tenantSlug}${config!.readonlyFetchPath}`);
      return data;
    }
  });

  const loadedPreview = useMemo(() => {
    if (!config) return null;
    if (config.stepId === "territory") {
      const nodes = profileQ.data?.references?.territory_nodes;
      const rows = flattenTerritoryNodes(nodes);
      return rows.length ? previewFromRows(config, rows) : emptyPreview(config);
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
  }, [config, profileQ.data, readonlyQ.data]);

  useEffect(() => {
    if (!loadedPreview || !config) return;
    const merged = mergePreview(loadedPreview, externalPreview, config);
    setPreview({ ...merged, rows: reindexPreviewRows(merged.rows) });
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
    if (!config) return [];
    return preview?.columns.map((header, i) => ({
      header,
      key: config.columns[i]?.key ?? header
    })) ?? config.columns.map((c) => ({ header: c.header, key: c.key }));
  }, [config, preview?.columns]);

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
    for (const col of config!.columns) cells[col.key] = "";
    const { errors } = validateRowCells(cells, undefined, config!);
    setPreview({
      ...preview,
      rows: [
        ...preview.rows,
        {
          rowIndex: preview.rows.reduce((m, r) => Math.max(m, r.rowIndex), 0) + 1,
          cells,
          errors,
          warnings: []
        }
      ]
    });
  }

  function removeRow(rowIndex: number) {
    if (!preview || readOnly) return;
    setPreview({ ...preview, rows: preview.rows.filter((r) => r.rowIndex !== rowIndex) });
  }

  async function apply() {
    if (!preview?.rows.length || hasErrors || !canApply) return;
    setBusy(true);
    setMsg(null);
    try {
      const message = await applyStepPreview(tenantSlug, step, preview, qc);
      setMsg(message);
      onApplied?.(message);
      await qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
    } catch (e) {
      setMsg(getUserFacingError(e, "Saqlash xatosi"));
    } finally {
      setBusy(false);
    }
  }

  const errorCount = preview?.rows.filter((r) => r.errors.length).length ?? 0;
  const loading = profileQ.isLoading || readonlyQ.isLoading;

  return (
    <div className={cn("mt-3 space-y-2", compact && "text-xs")}>
      {loading ? (
        <p className="text-xs text-muted-foreground">Tizimdan yuklanmoqda…</p>
      ) : null}

      {depsBlockedMsg ? (
        <p className="text-xs font-medium text-amber-700">{depsBlockedMsg}</p>
      ) : null}

      {readOnly ? (
        <p className="text-xs text-amber-800/90">
          Tizimdagi ma’lumot (o‘qish). Tahrirlash — asosiy sozlamalar sahifasida; u yerda saqlanganlar shu jadvalda
          ham ko‘rinadi.
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

      {preview && preview.rows.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="size-3" /> {preview.rows.length - errorCount} OK
            </span>
            {errorCount > 0 ? (
            <div className="w-full space-y-1">
              <span className="inline-flex items-center gap-1 text-destructive">
                <AlertCircle className="size-3" /> {errorCount} xato
              </span>
              {preview.rows
                .filter((r) => r.errors.length)
                .map((r) => (
                  <p key={r.rowIndex} className="text-[11px] text-destructive">
                    Qator {r.rowIndex}: {r.errors.join("; ")}
                  </p>
                ))}
            </div>
          ) : null}
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border-b px-2 py-1.5 text-left font-semibold">#</th>
                  {columnDefs.map((col) => (
                    <th key={col.key} className="border-b px-2 py-1.5 text-left font-semibold">
                      {col.header}
                      {config.columns.find((c) => c.key === col.key)?.required ? (
                        <span className="text-destructive"> *</span>
                      ) : null}
                    </th>
                  ))}
                  <th className="border-b px-2 py-1.5 text-left font-semibold">Статус</th>
                  {!readOnly ? <th className="border-b px-2 py-1.5 w-8" /> : null}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={cn(
                      row.errors.length ? "bg-destructive/5" : row.warnings.length ? "bg-amber-50/80" : ""
                    )}
                  >
                    <td className="border-b px-2 py-1 tabular-nums text-muted-foreground">{row.rowIndex}</td>
                    {columnDefs.map((col) => {
                      const isErr = row.errors.some((e) => e.includes(col.header));
                      return (
                        <td key={col.key} className="border-b px-1 py-1">
                          {readOnly ? (
                            <span>{row.cells[col.key] ?? "—"}</span>
                          ) : (
                            <Input
                              className={cn(
                                "h-7 min-w-[5rem] text-xs",
                                isErr && "border-destructive ring-1 ring-destructive/30"
                              )}
                              value={row.cells[col.key] ?? ""}
                              disabled={!enabled}
                              title={isErr ? row.errors.find((e) => e.includes(col.header)) : undefined}
                              onChange={(e) =>
                                setPreview((p) =>
                                  p ? updatePreviewCell(p, row.rowIndex, col.key, e.target.value, config) : p
                                )
                              }
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b px-2 py-1 text-[11px] text-muted-foreground">
                      {row.errors.length ? (
                        <span className="text-destructive">{row.errors.join("; ")}</span>
                      ) : row.warnings.length ? (
                        row.warnings.join("; ")
                      ) : (
                        <span className="text-emerald-700">OK</span>
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="border-b px-1 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-7 text-muted-foreground"
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
        </>
      ) : (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          {readOnly ? "Tizimda hali ma’lumot yo‘q" : "Excel yuklang yoki qator qo‘shing"}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!readOnly ? (
          <>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" disabled={!enabled} onClick={addRow}>
              <Plus className="size-3.5" />
              Qator
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={!canApply || busy || hasErrors || !preview?.rows.length}
              onClick={() => void apply()}
            >
              {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
              Qo‘llash (tizimga)
            </Button>
          </>
        ) : step.settingsHref ? (
          <Link
            href={step.settingsHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 text-xs")}
          >
            Asosiy sozlamalarda tahrirlash
          </Link>
        ) : null}
      </div>

      {msg ? (
        <p className={cn("text-xs", msg.includes("xato") || msg.includes("Xato") ? "text-destructive" : "text-emerald-700")}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}
