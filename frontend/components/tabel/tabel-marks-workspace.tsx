"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabelMarksCardDialog } from "@/components/tabel/tabel-marks-card-dialog";
import { TabelMarksFilters } from "@/components/tabel/tabel-marks-filters";
import { TabelMarksReviewButtons } from "@/components/tabel/tabel-marks-review-buttons";
import { TabelMarksStats } from "@/components/tabel/tabel-marks-stats";
import { TabelMarksTable, TabelOpenDaysTable } from "@/components/tabel/tabel-marks-table";
import { MARKS_PAGE_SIZE, type OpenDayRow, type TabelMarkRow } from "@/components/tabel/tabel-marks-types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { staffPickerDisplayName } from "@/lib/person-display";
import { usePermissions } from "@/lib/use-permissions";

export type { TabelMarkRow } from "@/components/tabel/tabel-marks-types";

function ymdOrNull(raw: string | null): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function TabelMarksWorkspace({ onlyProblems = false }: { onlyProblems?: boolean }) {
  const { tenantSlug } = useAuthStore();
  const perms = usePermissions();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const paramFrom = ymdOrNull(searchParams.get("from"));
  const paramTo = ymdOrNull(searchParams.get("to")) ?? paramFrom;
  const paramUserId = Number(searchParams.get("user_id") || "");
  const [from, setFrom] = useState(paramFrom ?? today);
  const [to, setTo] = useState(paramTo ?? today);
  const [userId, setUserId] = useState<number | "">(
    Number.isFinite(paramUserId) && paramUserId > 0 ? paramUserId : ""
  );
  const [branches, setBranches] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [card, setCard] = useState<TabelMarkRow | null>(null);
  const [media, setMedia] = useState<{ url: string; slot: string } | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canExport = perms.hasAny("tabel.otmetki.export", "staff.tabel.export");

  useEffect(() => {
    if (paramFrom) setFrom(paramFrom);
    if (paramTo) setTo(paramTo);
    if (Number.isFinite(paramUserId) && paramUserId > 0) setUserId(paramUserId);
  }, [paramFrom, paramTo, paramUserId]);

  const marksQ = useQuery({
    queryKey: ["tabel", "marks", tenantSlug, { from, to, branches, source, onlyProblems, userId }],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const endpoint = onlyProblems ? `/api/${tenantSlug}/tabel/problems` : `/api/${tenantSlug}/tabel/marks`;
      const { data } = await api.get<{ data: { items: TabelMarkRow[]; open_days?: OpenDayRow[] } }>(endpoint, {
        params: {
          from: from || undefined,
          to: to || undefined,
          user_id: userId || undefined,
          branch: branches.length ? branches.join(",") : undefined,
          source: source || undefined,
          only_problems: onlyProblems ? "true" : undefined,
          take: 300
        }
      });
      return { items: data.data.items ?? [], openDays: data.data.open_days ?? [] };
    }
  });

  const filtersQ = useQuery({
    queryKey: ["timesheet-filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          branches: string[];
          employees: Array<{
            id: number;
            fio?: string | null;
            name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            middle_name?: string | null;
          }>;
        };
      }>(`/api/${tenantSlug}/timesheet/filters`);
      return { branches: data.data.branches ?? [], employees: data.data.employees ?? [] };
    }
  });

  const reviewMut = useMutation({
    mutationFn: async (vars: { id: number; decision: "approved" | "rejected"; comment?: string }) => {
      await api.post(`/api/${tenantSlug}/tabel/marks/${vars.id}/review`, {
        decision: vars.decision,
        comment: vars.comment
      });
    },
    onSuccess: async () => {
      setNotice("Статус отметки обновлён, дневной табель пересчитан.");
      await qc.invalidateQueries({ queryKey: ["tabel", "marks", tenantSlug] });
    }
  });

  const items = marksQ.data?.items ?? [];
  const openDays = marksQ.data?.openDays ?? [];
  const staffOptions = useMemo(() => {
    const list = (filtersQ.data?.employees ?? []).map((e) => ({
      id: e.id,
      label: staffPickerDisplayName(e)
    }));
    list.sort((a, b) => a.label.localeCompare(b.label, "ru"));
    return list;
  }, [filtersQ.data?.employees]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((r) => {
      if (kind && kind !== "Нет ухода" && !(r.problem_reasons ?? []).includes(kind)) return false;
      if (!q) return true;
      return `${r.user_fio} ${r.user_code ?? ""} ${r.user_role} ${r.user_branch ?? ""}`.toLowerCase().includes(q);
    });
  }, [items, search, kind]);

  const visibleOpen = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openDays.filter((r) => {
      if (!q) return true;
      return `${r.user_fio} ${r.user_role} ${r.user_branch ?? ""}`.toLowerCase().includes(q);
    });
  }, [openDays, search]);

  const totalPages = Math.max(1, Math.ceil(visible.length / MARKS_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * MARKS_PAGE_SIZE;
    return visible.slice(start, start + MARKS_PAGE_SIZE);
  }, [visible, pageSafe]);

  useEffect(() => {
    setPage(1);
  }, [from, to, branches, source, userId, search, kind, onlyProblems]);

  const stats = useMemo(() => {
    let inn = 0;
    let mid = 0;
    let out = 0;
    let withMedia = 0;
    for (const r of visible) {
      if (r.role_in_day === "in") inn += 1;
      else if (r.role_in_day === "estimated_out") mid += 1;
      else if (r.role_in_day === "out") out += 1;
      if (r.has_photo_front || r.has_photo_back || r.has_video_front || r.has_video_back) withMedia += 1;
    }
    return { inn, mid, out, withMedia };
  }, [visible]);

  useEffect(() => {
    return () => {
      if (media?.url) URL.revokeObjectURL(media.url);
    };
  }, [media]);

  async function exportExcel() {
    if (!tenantSlug || !canExport) return;
    setExporting(true);
    setNotice(null);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/tabel/marks/export`, {
        responseType: "blob",
        params: {
          from: from || undefined,
          to: to || undefined,
          user_id: userId || undefined,
          branch: branches.length ? branches.join(",") : undefined,
          source: source || undefined,
          only_problems: onlyProblems ? "true" : undefined
        }
      });
      const cd = String(res.headers["content-disposition"] ?? "");
      const m = /filename="([^"]+)"/i.exec(cd);
      const filename = m?.[1] ?? `tabel-${onlyProblems ? "problems" : "marks"}.xlsx`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Excel файл скачан.");
    } catch (e) {
      setNotice(getUserFacingError(e, "Не удалось выгрузить Excel"));
    } finally {
      setExporting(false);
    }
  }

  async function openMedia(row: TabelMarkRow, slot: string) {
    setCard(row);
    setMediaError(null);
    setMediaLoading(true);
    if (media?.url) URL.revokeObjectURL(media.url);
    setMedia(null);
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/tabel/marks/${row.id}/media/${slot}`, {
        responseType: "blob"
      });
      setMedia({ url: URL.createObjectURL(res.data), slot });
    } catch (e) {
      setMediaError(getUserFacingError(e, "Не удалось открыть файл"));
    } finally {
      setMediaLoading(false);
    }
  }

  function closeCard() {
    setCard(null);
    if (media?.url) URL.revokeObjectURL(media.url);
    setMedia(null);
    setMediaError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {onlyProblems
              ? "Проблемные отметки и нарушения (Анти-фрод)"
              : "Журнал отметок (Приход / Примерный уход / Уход)"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {onlyProblems
              ? "Вне гео-зоны, лицо не совпало, Fake GPS и дни без нажатого выхода. Одобрение или отклонение пересчитывает дневной табель."
              : "За выбранный день: приход, примерный уход и официальный уход. Фото, видео с кодом и точка GPS открываются в карточке."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport ? (
            <Button variant="outline" size="sm" onClick={() => void exportExcel()} disabled={exporting}>
              <Download className="mr-1.5 size-4" />
              {exporting ? "Выгрузка…" : "Excel"}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void marksQ.refetch()} disabled={marksQ.isFetching}>
            <RefreshCw className="mr-1.5 size-4" />
            Обновить
          </Button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          {notice}
        </div>
      ) : null}

      {marksQ.isError ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
          {getUserFacingError(marksQ.error, "Не удалось загрузить журнал отметок")}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => void marksQ.refetch()}>
            Повторить
          </Button>
        </div>
      ) : null}

      <TabelMarksStats
        onlyProblems={onlyProblems}
        items={items}
        openDays={openDays}
        kind={kind}
        onKind={setKind}
        stats={stats}
      />

      <TabelMarksFilters
        from={from}
        to={to}
        branch={branches[0] ?? ""}
        source={source}
        userId={userId}
        search={search}
        branches={filtersQ.data?.branches ?? []}
        staffOptions={staffOptions}
        onFrom={setFrom}
        onTo={setTo}
        onBranch={(v) => setBranches(v ? [v] : [])}
        onSource={setSource}
        onUserId={setUserId}
        onSearch={setSearch}
      />

      {kind === "Нет ухода" ? null : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            <span>
              {pageRows.length} / {visible.length}
              {marksQ.isFetching ? " · обновление…" : ""}
            </span>
            <div className="inline-flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={pageSafe <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </Button>
              <span className="min-w-12 text-center font-semibold text-foreground">
                {pageSafe} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </Button>
            </div>
          </div>
          <TabelMarksTable
            pageRows={pageRows}
            loading={marksQ.isLoading}
            errored={marksQ.isError}
            onOpenCard={(row) => {
              setCard(row);
              setMedia(null);
              setMediaError(null);
            }}
            onOpenMedia={(row, slot) => {
              void openMedia(row, slot);
            }}
            reviewSlot={(row) => (
              <TabelMarksReviewButtons
                row={row}
                onlyProblems={onlyProblems}
                pending={reviewMut.isPending}
                onReview={async (id, decision) => {
                  await reviewMut.mutateAsync({ id, decision });
                }}
              />
            )}
          />
        </div>
      )}

      {onlyProblems && (kind === "" || kind === "Нет ухода") ? (
        <TabelOpenDaysTable rows={visibleOpen} loading={marksQ.isLoading} />
      ) : null}

      <TabelMarksCardDialog
        card={card}
        media={media}
        mediaLoading={mediaLoading}
        mediaError={mediaError}
        onClose={closeCard}
        onOpenMedia={(row, slot) => {
          void openMedia(row, slot);
        }}
      />
    </div>
  );
}
