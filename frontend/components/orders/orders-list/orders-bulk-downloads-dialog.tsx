"use client";

import { NakladnoyExportSettingsDialog } from "@/components/orders/nakladnoy-export-settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import type { NakladnoyExportPrefs, NakladnoyTemplateId } from "@/lib/order-nakladnoy";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { FileDown, Printer, Settings } from "lucide-react";
import { useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  canBulkCatalog: boolean;
  template: NakladnoyTemplateId;
  onTemplateChange: (t: NakladnoyTemplateId) => void;
  prefs: NakladnoyExportPrefs;
  onPrefsChange: (p: NakladnoyExportPrefs) => void;
  isPending?: boolean;
  onDownloadExcel: () => void;
  onDownloadPdf: () => void;
  onExportTableExcel: () => void;
};

export function OrdersBulkDownloadsDialog({
  open,
  onOpenChange,
  selectedCount,
  canBulkCatalog,
  template,
  onTemplateChange,
  prefs,
  onPrefsChange,
  isPending,
  onDownloadExcel,
  onDownloadPdf,
  onExportTableExcel
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Загрузка</DialogTitle>
            <DialogDescription>
              Накладные и экспорт для {formatGroupedInteger(selectedCount)} выбранных заказов.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Шаблон накладной</Label>
              <FilterSelect
                className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                emptyLabel="Шаблон"
                value={template}
                onChange={(e) => onTemplateChange(e.target.value as NakladnoyTemplateId)}
                disabled={!canBulkCatalog || isPending}
              >
                <option value="nakladnoy_warehouse">Складская накладная</option>
                <option value="nakladnoy_expeditor">Накладная экспедитора</option>
              </FilterSelect>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={!canBulkCatalog || isPending}
                onClick={onDownloadExcel}
              >
                <FileDown className="size-4" />
                Накладные (Excel)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={!canBulkCatalog || isPending}
                onClick={onDownloadPdf}
              >
                <Printer className="size-4" />
                Накладные (PDF)
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={onExportTableExcel}>
                <FileDown className="size-4" />
                Таблица (Excel)
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                disabled={!canBulkCatalog}
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-3.5" />
                Настройки накладных
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NakladnoyExportSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onSave={onPrefsChange}
      />
    </>
  );
}
