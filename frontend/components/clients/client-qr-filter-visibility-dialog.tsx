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
import {
  CLIENT_QR_FILTER_VISIBILITY_META,
  CLIENT_QR_PAGE_SIZE_OPTIONS,
  DEFAULT_CLIENT_QR_FILTER_VISIBILITY,
  type ClientQrFilterVisibility,
  type ClientQrPageView,
  saveClientQrFilterVisibility,
  saveClientQrPageView
} from "@/lib/client-qr-filter-visibility";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterVisibility: ClientQrFilterVisibility;
  onFilterVisibilityChange: (next: ClientQrFilterVisibility) => void;
  pageView: ClientQrPageView;
  onPageViewChange: (next: ClientQrPageView) => void;
  onApplyPageSize: (size: number) => void;
};

export function ClientQrFilterVisibilityDialog({
  open,
  onOpenChange,
  filterVisibility,
  onFilterVisibilityChange,
  pageView,
  onPageViewChange,
  onApplyPageSize
}: Props) {
  const [draftFilters, setDraftFilters] = useState(filterVisibility);
  const [draftPage, setDraftPage] = useState(pageView);

  useEffect(() => {
    if (open) {
      setDraftFilters(filterVisibility);
      setDraftPage(pageView);
    }
  }, [open, filterVisibility, pageView]);

  const apply = () => {
    onFilterVisibilityChange(draftFilters);
    onPageViewChange(draftPage);
    onApplyPageSize(draftPage.pageSize);
    saveClientQrFilterVisibility(draftFilters);
    saveClientQrPageView(draftPage);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,560px)] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-10 text-left">
          <DialogTitle className="text-base">Видимость страницы</DialogTitle>
          <DialogDescription className="text-xs">
            Какие блоки и поля фильтров показывать. Сохраняется в браузере.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Блоки страницы</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={draftPage.showFilterCard}
                onChange={(e) => setDraftPage((p) => ({ ...p, showFilterCard: e.target.checked }))}
              />
              Панель фильтров
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={draftPage.showStats}
                onChange={(e) => setDraftPage((p) => ({ ...p, showStats: e.target.checked }))}
              />
              Сводка (статистика)
            </label>
            <div className="space-y-1 pt-1">
              <label className="text-xs text-muted-foreground" htmlFor="client-qr-page-size">
                Строк на странице
              </label>
              <select
                id="client-qr-page-size"
                className="h-9 w-full max-w-[8rem] rounded-md border border-input bg-background px-2 text-sm"
                value={String(draftPage.pageSize)}
                onChange={(e) =>
                  setDraftPage((p) => ({
                    ...p,
                    pageSize: Number.parseInt(e.target.value, 10) as ClientQrPageView["pageSize"]
                  }))
                }
              >
                {CLIENT_QR_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">Поля фильтров</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDraftFilters(DEFAULT_CLIENT_QR_FILTER_VISIBILITY)}
                >
                  Все
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setDraftFilters(
                      Object.fromEntries(
                        Object.keys(DEFAULT_CLIENT_QR_FILTER_VISIBILITY).map((k) => [k, false])
                      ) as ClientQrFilterVisibility
                    )
                  }
                >
                  Скрыть
                </Button>
              </div>
            </div>
            <div className="grid gap-1.5">
              {CLIENT_QR_FILTER_VISIBILITY_META.map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={draftFilters[key]}
                    onChange={(e) => setDraftFilters((p) => ({ ...p, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-4 py-3 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
