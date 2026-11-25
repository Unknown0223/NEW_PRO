"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Search } from "lucide-react";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/use-permissions";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { monthToDateRange } from "@/components/dashboard/shared/date-ranges";
import { cn } from "@/lib/utils";
import { FlatReportFilters } from "@/components/reports/flat-report/flat-report-filters";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";
import {
  appendParams,
  applyOptionsDefaults,
  buildEmptyDraft,
  filterRowsByClientSearch,
  mapMultiOptions,
  type MultiItem
} from "@/components/reports/flat-report/flat-report-helpers";
import {
  PHOTO_FILTER_CONFIG,
  fmtPhotoDt,
  type PhotoReportRow
} from "./photo-report-config";
import { PhotoReportAgentGallery } from "./photo-report-agent-gallery";

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_KEYS = [
  "client_name",
  "client_code",
  "user_name",
  "category",
  "territory",
  "client_category",
  "status_label"
] as const;

type GalleryTarget = { userId: number; userName: string; userRole: string };

export function PhotoReportWorkspace() {
  const cfg = PHOTO_FILTER_CONFIG as FlatReportConfig;
  const canExport = usePermissions().has(cfg.exportPermission);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { from: from0, to: to0 } = monthToDateRange();
  const [exporting, setExporting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const deferredSearch = useDeferredValue(tableSearch);
  const [gallery, setGallery] = useState<GalleryTarget | null>(null);
  const [draft, setDraft] = useState(() => buildEmptyDraft(cfg.filterFields, from0, to0, 50));
  const [applied, setApplied] = useState(draft);

  const filtersQ = useQuery({
    queryKey: ["report-photo-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Record<string, unknown> }>(
        `/api/${tenantSlug}/reports/photo/filter-options`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!filtersQ.data) return;
    setDraft((d) => applyOptionsDefaults(d, cfg.filterFields, filtersQ.data));
    setApplied((a) => applyOptionsDefaults(a, cfg.filterFields, filtersQ.data));
  }, [filtersQ.data, cfg.filterFields]);

  const reportQ = useQuery({
    queryKey: ["report-photo", tenantSlug, applied],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, applied);
      const { data } = await api.get<{
        data: { rows: PhotoReportRow[]; total: number; page: number; limit: number };
      }>(`/api/${tenantSlug}/reports/photo?${p.toString()}`);
      return data.data;
    }
  });

  const agentPhotosQ = useQuery({
    queryKey: ["report-photo-agent", tenantSlug, gallery?.userId, applied],
    enabled: Boolean(tenantSlug && hydrated && gallery?.userId),
    staleTime: STALE.report,
    queryFn: async () => {
      const p = new URLSearchParams();
      appendParams(p, { ...applied, page: 1, limit: 100 });
      p.set("user_ids", String(gallery!.userId));
      const { data } = await api.get<{
        data: { rows: PhotoReportRow[]; total: number };
      }>(`/api/${tenantSlug}/reports/photo?${p.toString()}`);
      return data.data;
    }
  });

  const multiItemsByKey = useMemo(() => {
    const opts = filtersQ.data;
    const map: Record<string, MultiItem[]> = {};
    for (const field of cfg.filterFields) {
      if (field.kind !== "multiSelect") continue;
      map[field.paramKey] = mapMultiOptions(opts?.[field.optionsFrom]);
    }
    return map;
  }, [cfg.filterFields, filtersQ.data]);

  const rawRows = (reportQ.data?.rows ?? []) as PhotoReportRow[];
  const rows = filterRowsByClientSearch(
    rawRows as unknown as Array<Record<string, unknown>>,
    deferredSearch,
    [...SEARCH_KEYS]
  ) as unknown as PhotoReportRow[];

  const totalPages = reportQ.data
    ? Math.max(1, Math.ceil(reportQ.data.total / reportQ.data.limit))
    : 1;

  function applyFilters(page = 1) {
    setApplied({ ...draft, page });
    setDraft((s) => ({ ...s, page }));
  }

  function resetFilters() {
    const next = applyOptionsDefaults(
      buildEmptyDraft(cfg.filterFields, from0, to0, Number(applied.limit) || 50),
      cfg.filterFields,
      filtersQ.data
    );
    setDraft(next);
    setApplied(next);
    setTableSearch("");
  }

  async function exportXlsx() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    try {
      const p = new URLSearchParams();
      appendParams(p, applied);
      p.set("export_limit", "5000");
      const res = await api.get<Blob>(`/api/${tenantSlug}/reports/photo/export?${p.toString()}`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cfg.exportFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function openAgentGallery(row: PhotoReportRow) {
    if (row.user_id == null) return;
    setGallery({
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role
    });
  }

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{cfg.title}</h1>
      <p className="text-sm text-muted-foreground">
        Список фотоотчётов. «Фото» — все снимки выбранного сотрудника за период.
      </p>

      <FlatReportFilters
        config={cfg}
        draft={draft}
        setDraft={setDraft}
        filterOptions={filtersQ.data}
        multiItemsByKey={multiItemsByKey}
        dateTypeField={undefined}
        dateTypeAsRadio={false}
        dateTypeOptions={[]}
        canExport={canExport}
        exporting={exporting}
        fetching={reportQ.isFetching}
        onReset={resetFilters}
        onApply={() => applyFilters(1)}
        onExport={() => void exportXlsx()}
      />

      <div className="rounded border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-xs"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Фильтр в таблице…"
            />
          </div>
          <select
            className={cn(filterSelectClassName, "h-8 w-auto")}
            value={String(applied.limit)}
            onChange={(e) => {
              const limit = Number.parseInt(e.target.value, 10) || 50;
              setDraft((d) => ({ ...d, limit, page: 1 }));
              setApplied((a) => ({ ...a, limit, page: 1 }));
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / стр.
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">Всего: {reportQ.data?.total ?? 0}</span>
        </div>

        {reportQ.isLoading ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">Загрузка…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Клиент</th>
                  <th className="px-2 py-2">Дата</th>
                  <th className="px-2 py-2">Категория клиента</th>
                  <th className="px-2 py-2">Территория</th>
                  <th className="px-2 py-2">Пользователь</th>
                  <th className="px-2 py-2">Категория отчета</th>
                  <th className="px-2 py-2">Статус</th>
                  <th className="px-2 py-2">Фото</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.photo_id} className="border-b last:border-0">
                      <td className="px-2 py-1.5 text-muted-foreground">{row.row_number}</td>
                      <td className="px-2 py-1.5 font-medium">{row.client_name}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{fmtPhotoDt(row.created_at)}</td>
                      <td className="px-2 py-1.5">{row.client_category || "—"}</td>
                      <td className="px-2 py-1.5">{row.territory || "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.user_name || "—"}
                        {row.user_role ? ` (${row.user_role})` : ""}
                      </td>
                      <td className="px-2 py-1.5">{row.category}</td>
                      <td className="px-2 py-1.5">{row.status_label}</td>
                      <td className="px-2 py-1.5">
                        {(() => {
                          const open = gallery?.userId === row.user_id;
                          const count = row.agent_photo_count || 0;
                          return (
                            <Button
                              type="button"
                              variant={open ? "default" : "outline"}
                              size="sm"
                              className="h-7 min-w-[2.75rem] gap-1 tabular-nums text-xs"
                              disabled={row.user_id == null || count < 1}
                              title={
                                open
                                  ? "Закрыть фото сотрудника"
                                  : `Фото сотрудника: ${count}`
                              }
                              onClick={() => {
                                if (open) setGallery(null);
                                else openAgentGallery(row);
                              }}
                            >
                              <Camera className="h-3.5 w-3.5" />
                              {count}
                            </Button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={(reportQ.data?.page ?? 1) <= 1}
            onClick={() => applyFilters(Math.max(1, (reportQ.data?.page ?? 1) - 1))}
          >
            Назад
          </Button>
          <span className="text-xs text-muted-foreground">
            {reportQ.data?.page ?? 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(reportQ.data?.page ?? 1) >= totalPages}
            onClick={() => applyFilters((reportQ.data?.page ?? 1) + 1)}
          >
            Далее
          </Button>
        </div>
      </div>

      {gallery ? (
        <PhotoReportAgentGallery
          agentName={gallery.userName}
          agentRole={gallery.userRole}
          photos={agentPhotosQ.data?.rows ?? []}
          loading={agentPhotosQ.isLoading}
          onClose={() => setGallery(null)}
        />
      ) : null}
    </div>
  );
}
