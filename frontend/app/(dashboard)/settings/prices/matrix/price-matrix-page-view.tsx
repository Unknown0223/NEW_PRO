"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { PriceMatrixCategoryPanels } from "@/components/settings/prices/price-matrix-category-panels";
import { PriceMatrixCategoryPicker } from "@/components/settings/prices/price-matrix-category-picker";
import { PriceMatrixEffectiveDatetime } from "@/components/settings/prices/price-matrix-effective-datetime";
import { PriceMatrixFilters } from "@/components/settings/prices/price-matrix-filters";
import { PriceMatrixImportPreviewDialog } from "@/components/settings/prices/price-matrix-import-preview-dialog";
import { PriceMatrixPercentAdjuster } from "@/components/settings/prices/price-matrix-percent-adjuster";
import { PriceMatrixSaveDialog } from "@/components/settings/prices/price-matrix-save-dialog";
import { PriceMatrixToolbar } from "@/components/settings/prices/price-matrix-toolbar";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import type { usePriceMatrixPage } from "./use-price-matrix-page";

type PriceMatrixPageState = ReturnType<typeof usePriceMatrixPage>;

export function PriceMatrixPageView(props: PriceMatrixPageState) {
  const {
    tenantSlug,
    isAdmin,
    kind,
    setKind,
    priceType,
    setPriceType,
    selectedCategoryIds,
    setSelectedCategoryIds,
    effectiveAt,
    setEffectiveAt,
    bulk,
    setBulk,
    draft,
    setDraft,
    msg,
    serverFieldErrs,
    templateLoading,
    importOpen,
    setImportOpen,
    importRows,
    importParseErr,
    saveDialogOpen,
    setSaveDialogOpen,
    categoryIdsArr,
    flatCats,
    priceTypes,
    categoryPanels,
    currency,
    matrixRows,
    matrixLoading,
    changeCount,
    saveMut,
    applyBulk,
    applyPercent,
    resetDraft,
    handleDownloadTemplate,
    handleImportFile,
    handleImportSaved,
    hasCategories,
    toolbarEnabled
  } = props;

  return (
    <PageShell>
      <PageHeader
        title="Установка новых цен"
        description="Chapdan kategoriyalarni belgilang, narx turini tanlang. Shablon — barcha tanlangan mahsulotlar."
        actions={
          <Link href="/settings/prices" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Цена
          </Link>
        }
      />

      <SettingsWorkspace>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center">
            <PriceMatrixFilters
              kind={kind}
              onKindChange={setKind}
              priceType={priceType}
              onPriceTypeChange={setPriceType}
              priceTypes={priceTypes}
              serverFieldErrs={serverFieldErrs}
              className="min-w-0 flex-1"
            />
            <div className="h-px w-full bg-border sm:hidden" />
            <div className="w-full shrink-0 sm:w-auto sm:min-w-[13rem] sm:max-w-[18rem]">
              <PriceMatrixEffectiveDatetime
                value={effectiveAt}
                onChange={setEffectiveAt}
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_1fr]">
              <PriceMatrixCategoryPicker
                flatCats={flatCats}
                selected={selectedCategoryIds}
                onSelectedChange={setSelectedCategoryIds}
                disabled={!isAdmin}
              />

              <div className="min-w-0">
                {hasCategories ? (
                  <PriceMatrixToolbar
                    bulk={bulk}
                    onBulkChange={setBulk}
                    onApplyBulk={applyBulk}
                    disabled={!isAdmin}
                    bulkDisabled={!toolbarEnabled}
                    scopeHint="Foiz, summa, shablon va import — barcha belgilangan kategoriyalar va tanlangan narx turi bo‘yicha."
                    canDownloadTemplate={
                      Boolean(priceType) && categoryIdsArr.length > 0 && matrixRows.length > 0
                    }
                    templateLoading={templateLoading}
                    onDownloadTemplate={() => void handleDownloadTemplate()}
                    canImportExcel={
                      Boolean(priceType) && categoryIdsArr.length > 0 && matrixRows.length > 0
                    }
                    onImportFile={(f) => void handleImportFile(f)}
                    percentSlot={
                      <PriceMatrixPercentAdjuster
                        onApply={applyPercent}
                        disabled={!isAdmin || !toolbarEnabled}
                      />
                    }
                  />
                ) : null}

                <PriceMatrixCategoryPanels
                  panels={categoryPanels}
                  currency={currency}
                  draft={draft}
                  onDraftChange={(productId, value) =>
                    setDraft((p) => ({
                      ...p,
                      [productId]: value
                    }))
                  }
                  isLoading={matrixLoading}
                  needsFilters={!priceType}
                  needsCategories={!hasCategories}
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {changeCount > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{changeCount}</span> ta pozitsiya
                    o‘zgartirildi
                  </>
                ) : (
                  "O‘zgarishlar yo‘q — narxni jadvalda tahrirlang yoki import qiling."
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {changeCount > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!isAdmin}
                    onClick={resetDraft}
                  >
                    <RotateCcw className="mr-1.5 size-4" aria-hidden />
                    Сбросить
                  </Button>
                ) : null}
                <Button
                  size="default"
                  disabled={!isAdmin || changeCount === 0}
                  className="min-w-[10rem] bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  onClick={() => setSaveDialogOpen(true)}
                >
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </div>

        {importParseErr ? <p className="text-sm text-destructive">{importParseErr}</p> : null}
        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      </SettingsWorkspace>

      <PriceMatrixSaveDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        changeCount={changeCount}
        effectiveAt={effectiveAt}
        saving={saveMut.isPending}
        onConfirm={() => saveMut.mutate()}
      />

      {tenantSlug && importOpen ? (
        <PriceMatrixImportPreviewDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          tenantSlug={tenantSlug}
          categoryIds={categoryIdsArr}
          priceType={priceType}
          currency={currency}
          initialRows={importRows}
          onSaved={() => void handleImportSaved()}
        />
      ) : null}
    </PageShell>
  );
}
