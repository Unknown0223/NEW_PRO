"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { buildSupervisorDashboardQueryString } from "@/lib/dashboard-supervisor-query";
import type { SupervisorDashboardQueryInput } from "@/lib/dashboard-supervisor-query";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  SupervisorEnterprisePager,
  SupervisorEnterpriseTableWrap,
  SupervisorEnterpriseToolbar
} from "@/components/dashboard/supervisor/supervisor-enterprise-ui";
import {
  SupervisorPhotoGalleryLightbox,
  type PhotoGalleryItem
} from "@/components/dashboard/supervisor/supervisor-photo-gallery-lightbox";
import * as XLSX from "xlsx";

export type SupervisorPhotoReportModalTarget = {
  agentId: number;
  agentName: string;
  agentCode?: string | null;
  photoOutlets: number;
  photoCount: number;
};

type PhotoReportMeta = {
  id: number;
  caption: string | null;
  created_at: string;
  client_name?: string;
};

type PhotoReportApi = {
  agent: { id: number; name: string; code: string | null };
  date: string;
  summary: { outlets: number; photo_count: number };
  rows: Array<{
    client_id: number;
    client_label: string;
    client_name: string;
    client_category: string | null;
    territory: string | null;
    categories: Array<{
      label: string;
      count: number;
      photos: PhotoReportMeta[];
    }>;
  }>;
  all_photos: PhotoReportMeta[];
  total: number;
  page: number;
  limit: number;
};

function formatModalDate(isoYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd);
  if (!m) return isoYmd;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

function buildModalTitle(target: SupervisorPhotoReportModalTarget, date: string): string {
  const code = target.agentCode?.trim() || "—";
  const dateLabel = formatModalDate(date);
  return `Фотоотчет: 01 - ${code} - [${target.agentName}] ${dateLabel}`;
}

type SupervisorPhotoReportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  filters: SupervisorDashboardQueryInput;
  target: SupervisorPhotoReportModalTarget | null;
};

export function SupervisorPhotoReportModal({
  open,
  onOpenChange,
  tenantSlug,
  filters,
  target
}: SupervisorPhotoReportModalProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<PhotoGalleryItem[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const baseQs = useMemo(() => buildSupervisorDashboardQueryString(filters), [filters]);

  const reportQ = useQuery({
    queryKey: ["dashboard-supervisor", "photo-reports", tenantSlug, baseQs, target?.agentId, page, limit, search],
    enabled: open && Boolean(tenantSlug) && target != null,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const q = new URLSearchParams(baseQs);
      q.set("agent_id", String(target!.agentId));
      q.set("page", String(page));
      q.set("limit", String(limit));
      if (search.trim()) q.set("search", search.trim());
      const { data } = await api.get<PhotoReportApi>(
        `/api/${tenantSlug}/dashboard/supervisor/photo-reports?${q.toString()}`
      );
      return data;
    }
  });

  const totalPages = Math.max(1, Math.ceil((reportQ.data?.total ?? 0) / limit));

  const openGallery = (photos: PhotoGalleryItem[], startIndex = 0) => {
    if (!photos.length) return;
    setGalleryPhotos(photos);
    setGalleryIndex(startIndex);
    setGalleryOpen(true);
  };

  const openGalleryWithFetch = async (metas: PhotoReportMeta[], startIndex = 0) => {
    if (!metas.length || !tenantSlug) return;
    setGalleryLoading(true);
    try {
      const ids = metas.map((p) => p.id).join(",");
      const { data } = await api.get<{ data: Array<{ id: number; image_url: string; caption: string | null }> }>(
        `/api/${tenantSlug}/dashboard/supervisor/photo-reports/images?ids=${ids}`
      );
      const byId = new Map(data.data.map((p) => [p.id, p.image_url]));
      openGallery(
        metas.map((p) => ({
          id: p.id,
          image_url: byId.get(p.id) ?? "",
          caption: p.caption,
          client_name: p.client_name
        })),
        startIndex
      );
    } catch {
      /* ignore */
    } finally {
      setGalleryLoading(false);
    }
  };

  const openAllPhotos = () => {
    const all = reportQ.data?.all_photos ?? [];
    void openGalleryWithFetch(all);
  };

  const exportExcel = () => {
    const rows = reportQ.data?.rows ?? [];
    const flat = rows.flatMap((r) =>
      r.categories.map((c) => ({
        "Ид клиента": r.client_label,
        Клиенты: r.client_name,
        "Категория клиента": r.client_category ?? "",
        Территория: r.territory ?? "",
        "Категория фотоотчёта": c.label,
        Фото: c.count
      }))
    );
    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Фотоотчет");
    XLSX.writeFile(wb, `foto-otchet-${target?.agentId ?? "agent"}.xlsx`);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const title =
    target && reportQ.data
      ? buildModalTitle(target, reportQ.data.date)
      : target
        ? buildModalTitle(target, filters.date)
        : "Фотоотчет";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="z-50 flex max-h-[92vh] w-[min(96vw,1100px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1100px)]"
          showCloseButton
        >
          <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
            <DialogTitle className="pr-8 text-left text-sm font-semibold leading-snug sm:text-base">
              {title}
            </DialogTitle>
          </DialogHeader>

          <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {galleryLoading ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm shadow-panel">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка фото…
                </div>
              </div>
            ) : null}
            <SupervisorEnterpriseToolbar
              pageSize={limit}
              onPageSizeChange={(n) => {
                setLimit(n);
                setPage(1);
              }}
              search={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              searchPlaceholder="Поиск"
              onExcel={exportExcel}
              onRefresh={() => void reportQ.refetch()}
              refreshing={reportQ.isFetching}
              totalCount={reportQ.data?.total}
            >
              <button
                type="button"
                disabled={!reportQ.data?.all_photos.length || galleryLoading}
                onClick={openAllPhotos}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {galleryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Все картинки
              </button>
            </SupervisorEnterpriseToolbar>

            {reportQ.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка…
              </div>
            ) : reportQ.isError ? (
              <p className="py-8 text-center text-sm text-destructive">Не удалось загрузить фотоотчет.</p>
            ) : (
              <>
                <SupervisorEnterpriseTableWrap>
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-muted/80 dark:bg-muted/50">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Ид клиента
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Клиенты
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Категория клиента
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Территория
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Категория фотоотчёта
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border dark:divide-border">
                      {(reportQ.data?.rows ?? []).map((row, rowIdx) =>
                        row.categories.map((cat, catIdx) => (
                          <tr
                            key={`${row.client_id}-${cat.label}`}
                            className={cn(
                              "transition-colors hover:bg-teal-50/40 dark:hover:bg-teal-950/20",
                              rowIdx === 0 && catIdx === 0 && "bg-teal-50/30 dark:bg-teal-950/15"
                            )}
                          >
                            {catIdx === 0 ? (
                              <>
                                <td
                                  className="px-4 py-3 align-top tabular-nums text-muted-foreground"
                                  rowSpan={row.categories.length}
                                >
                                  {row.client_label}
                                </td>
                                <td className="px-4 py-3 align-top font-medium" rowSpan={row.categories.length}>
                                  <span className="inline-flex items-center gap-1.5">
                                    {row.client_name}
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-teal-600"
                                      onClick={() => void copyText(row.client_name)}
                                      aria-label="Копировать имя клиента"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                </td>
                                <td className="px-4 py-3 align-top" rowSpan={row.categories.length}>
                                  {row.client_category ?? "—"}
                                </td>
                                <td className="px-4 py-3 align-top" rowSpan={row.categories.length}>
                                  {row.territory ?? "—"}
                                </td>
                              </>
                            ) : null}
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="text-left text-teal-600 hover:text-teal-500 hover:underline dark:text-teal-400"
                                onClick={() =>
                                  void openGalleryWithFetch(
                                    cat.photos.map((p) => ({
                                      ...p,
                                      client_name: row.client_name
                                    }))
                                  )
                                }
                              >
                                {cat.label} ({cat.count})
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                      {!reportQ.data?.rows.length ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                            Нет фото за выбранную дату
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </SupervisorEnterpriseTableWrap>

                <SupervisorEnterprisePager
                  page={page}
                  totalPages={totalPages}
                  totalRows={reportQ.data?.total ?? 0}
                  pageSize={limit}
                  onPage={setPage}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SupervisorPhotoGalleryLightbox
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        photos={galleryPhotos}
        initialIndex={galleryIndex}
        title={title}
      />
    </>
  );
}

export function formatPhotoReportCell(outlets: number, photoCount: number): string {
  return `${outlets} Т.Т. (${photoCount} фото)`;
}
