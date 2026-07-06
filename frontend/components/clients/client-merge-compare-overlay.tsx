"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { MergeCompareGrid } from "./client-merge-compare-grid";
import {
  recommendedMasterId,
  type ClientDedupePreview,
  type MergeDuplicateGroup,
  type MergePreviewStats
} from "./client-merge-compare-shared";

export type { ClientDedupePreview, MergeDuplicateGroup, MergePreviewStats };

export function CompareMergeOverlay(props: {
  group: MergeDuplicateGroup;
  masterId: number | null;
  setMasterId: (id: number | null) => void;
  onClose: () => void;
  onMerge: () => void;
  onSave: () => void;
  merging: boolean;
  saving: boolean;
  mergePreview: MergePreviewStats | null;
  mergePreviewLoading: boolean;
}) {
  const {
    group,
    masterId,
    setMasterId,
    onClose,
    onMerge,
    onSave,
    merging,
    saving,
    mergePreview,
    mergePreviewLoading
  } = props;

  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set());
  const hideClient = useCallback(
    (id: number) => {
      if (masterId === id) {
        setMasterId(null);
      }
      setHiddenIds((prev) => new Set(prev).add(id));
    },
    [masterId, setMasterId]
  );

  const visiblePreviews = useMemo(
    () => group.previews.filter((p) => !hiddenIds.has(p.id)),
    [group.previews, hiddenIds]
  );

  const groupTitle = useMemo(() => {
    const p0 = group.previews[0];
    return p0?.name?.trim() || group.key;
  }, [group]);

  const suggestedId = useMemo(() => recommendedMasterId(visiblePreviews), [visiblePreviews]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted md:left-[15.5rem]">
      <header className="z-30 flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={onClose}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-[19px] font-semibold text-slate-800">Объединение</h1>
            <p className="truncate text-[13px] text-slate-400">/ {groupTitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onSave} disabled={saving || masterId == null}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить группу"}
          </Button>
          <Button
            type="button"
            className="h-10 bg-emerald-600 px-6 text-[14px] font-medium text-white shadow-sm hover:bg-emerald-700"
            disabled={merging || masterId == null || visiblePreviews.length < 2}
            onClick={onMerge}
          >
            {merging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Объединить
          </Button>
        </div>
      </header>

      {suggestedId != null && (masterId == null || masterId !== suggestedId) ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-amber-950 dark:text-amber-100">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">
              Рекомендуемый мастер: <span className="font-mono font-semibold">#{suggestedId}</span>
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setMasterId(suggestedId)}>
            Выбрать #{suggestedId}
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        {visiblePreviews.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">
            Все клиенты скрыты. Закройте панель и откройте группу снова.
          </div>
        ) : (
          <MergeCompareGrid
            previews={visiblePreviews}
            masterId={masterId}
            setMasterId={setMasterId}
            hiddenIds={hiddenIds}
            onHideClient={hideClient}
          />
        )}
      </div>

      <footer className="shrink-0 space-y-1 border-t border-border bg-card px-4 py-2 sm:px-6">
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-slate-600">
          {mergePreviewLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Расчёт preview…
            </span>
          ) : mergePreview ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Заказы: {mergePreview.orders_to_reassign}</span>
              <span>Платежи: {mergePreview.payments_to_reassign}</span>
              <span>QR: {mergePreview.qr_codes_to_reassign}</span>
              <span>Оборудование: {mergePreview.equipment_to_reassign}</span>
              <span>Баланс после merge: {mergePreview.expected_master_balance_after}</span>
              <span>
                Конфликты: {mergePreview.conflict_summary.critical} крит., {mergePreview.conflict_summary.warning} вним.
              </span>
            </div>
          ) : (
            <span>Preview недоступен — выберите мастера.</span>
          )}
        </div>
        <div className="flex items-start gap-2 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Подсветка ячеек: зелёный — совпадение, жёлтый — частично, красный — конфликт. Операция переносит заказы,
            платежи и QR на мастера. Отмена невозможна.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pb-1 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500/80" /> без конфликта
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500/80" /> внимание
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500/80" /> конфликт
          </span>
        </div>
      </footer>
    </div>
  );
}
