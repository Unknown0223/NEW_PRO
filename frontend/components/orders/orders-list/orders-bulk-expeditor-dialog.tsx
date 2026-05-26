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
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { Link2, Link2Off } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Expeditor = { id: number; fio: string; code: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  expeditors: Expeditor[];
  isLoadingExpeditors?: boolean;
  isPending?: boolean;
  onAttach: (expeditorUserId: number) => void;
  onDetach: () => void;
};

export function OrdersBulkExpeditorDialog({
  open,
  onOpenChange,
  selectedCount,
  expeditors,
  isLoadingExpeditors,
  isPending,
  onAttach,
  onDetach
}: Props) {
  const [choice, setChoice] = useState("");

  useEffect(() => {
    if (!open) setChoice("");
  }, [open]);

  const options = useMemo(
    () =>
      expeditors.map((ex) => ({
        value: String(ex.id),
        label: ex.code ? `${ex.fio} (${ex.code})` : ex.fio,
        searchText: ex.code ?? undefined
      })),
    [expeditors]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Доставщик</DialogTitle>
          <DialogDescription>
            {formatGroupedInteger(selectedCount)} заказ(ов) — выберите доставщика и прикрепите или
            открепите.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FilterSearchableSelect
            emptyLabel="Выберите доставщика"
            value={choice}
            onValueChange={setChoice}
            options={options}
            disabled={isPending || isLoadingExpeditors}
            includeEmptyOption={false}
            searchPlaceholder="Поиск по ФИО или коду"
            minPopoverWidth={320}
            className="h-10 text-sm"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full gap-1.5"
              disabled={isPending || !choice.trim()}
              onClick={() => {
                const uid = Number.parseInt(choice, 10);
                if (Number.isFinite(uid) && uid > 0) onAttach(uid);
              }}
            >
              <Link2 className="size-4" />
              Прикрепить
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5"
              disabled={isPending}
              onClick={onDetach}
            >
              <Link2Off className="size-4" />
              Открепить у всех
            </Button>
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
