"use client";

import { ProductCatalogImportErrorsDialog } from "@/components/products/product-catalog-import-errors-dialog";
import { InitialSetupStepTable } from "@/components/settings/initial-setup/initial-setup-step-table";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { api, formatApiSupportReference } from "@/lib/api";
import { getStepById } from "@/lib/initial-setup/catalog";
import { parseXlsxPreview } from "@/lib/initial-setup/preview-xlsx";
import { getStepTableConfig, requiredColumnKeys } from "@/lib/initial-setup/ref-table-config";
import type { InitialSetupPreviewState, InitialSetupStep } from "@/lib/initial-setup/types";
import { cn } from "@/lib/utils";
import { getUserFacingError } from "@/lib/error-utils";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  tenantSlug: string | null;
  backHref: string;
  onDone: () => void;
  showCardHeader?: boolean;
};

type ImportDialogState = {
  title: string;
  summary: string | null;
  errors: string[];
};

type PreviewMode = "full" | "update";

function triggerBlobDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ProductCatalogExcelPanel({
  tenantSlug,
  backHref,
  onDone,
  showCardHeader = true
}: Props) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<null | "template" | "export">(null);
  const [importDialog, setImportDialog] = useState<ImportDialogState | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode | null>(null);
  const [draft, setDraft] = useState<InitialSetupPreviewState | null>(null);
  const [parsing, setParsing] = useState(false);

  const baseStep = getStepById("products-catalog");
  const config = getStepTableConfig("products-catalog");

  const stepForApply: InitialSetupStep | null = useMemo(() => {
    if (!baseStep?.importApi) return baseStep ?? null;
    if (previewMode === "update") {
      return {
        ...baseStep,
        importApi: {
          ...baseStep.importApi,
          importPath: "/products/import-catalog-update",
          importAsyncPath: "/products/import-catalog-update/async"
        }
      };
    }
    return baseStep;
  }, [baseStep, previewMode]);

  async function downloadBlob(path: string, filename: string) {
    if (!tenantSlug) return;
    try {
      const { data } = await api.get(`/api/${tenantSlug}${path}`, { responseType: "blob" });
      const blob = data instanceof Blob ? data : new Blob([data]);
      const ctype = blob.type || "";
      if (ctype.includes("application/json")) {
        const text = await blob.text();
        try {
          const j = JSON.parse(text) as { error?: string; message?: string; requestId?: string };
          const base =
            typeof j.message === "string" && j.message.trim()
              ? j.message.trim()
              : typeof j.error === "string" && j.error.trim()
                ? j.error.trim()
                : "Скачивание отклонено.";
          const ref = formatApiSupportReference(
            typeof j.requestId === "string" ? j.requestId.trim() : undefined
          );
          setMsg(ref ? `${base} — ${ref}` : base);
        } catch {
          setMsg("Скачивание отклонено.");
        }
        return;
      }
      triggerBlobDownload(blob, filename);
      setMsg(null);
    } catch (e) {
      setMsg(getUserFacingError(e, "Не удалось скачать — проблема с сетью или доступом."));
    }
  }

  async function openVirtualPreview(file: File, mode: PreviewMode) {
    if (!config || !baseStep) {
      setMsg("Не найдена конфигурация импорта товаров");
      return;
    }
    setParsing(true);
    setMsg(null);
    try {
      const preview = await parseXlsxPreview(
        file,
        requiredColumnKeys(baseStep, config),
        5000,
        config
      );
      setDraft(preview);
      setPreviewMode(mode);
      const errN = preview.rows.filter((r) => r.errors.length).length;
      if (errN > 0) {
        setMsg(
          `Предпросмотр: строк — ${preview.rows.length}, с ошибками/дубликатами — ${errN}. Исправьте красные ячейки, затем подтвердите`
        );
      } else {
        setMsg(
          `Предпросмотр: строк готово — ${preview.rows.length}. Проверьте и отредактируйте, затем подтвердите кнопкой «Применить»`
        );
      }
    } catch (e) {
      setMsg(getUserFacingError(e, "Не удалось прочитать файл Excel"));
      setDraft(null);
      setPreviewMode(null);
    } finally {
      setParsing(false);
    }
  }

  function clearPreview() {
    setDraft(null);
    setPreviewMode(null);
    setMsg(null);
  }

  return (
    <>
      <Card className="border-primary/20">
        {showCardHeader ? (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Excel — импорт каталога</CardTitle>
            <CardDescription>
              Сначала открывается <strong>таблица предпросмотра</strong>: редактирование, проверка и
              предупреждение о дубликатах (красным). Запись в систему — только после нажатия{" "}
              <strong>«Применить»</strong>.
            </CardDescription>
          </CardHeader>
        ) : null}
        <CardContent className={showCardHeader ? "space-y-4 text-sm" : "space-y-4 pt-4 text-sm"}>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading === "template"}
              onClick={async () => {
                setDownloading("template");
                try {
                  await downloadBlob("/products/import-template", "import-products-template.xlsx");
                } finally {
                  setDownloading(null);
                }
              }}
            >
              {downloading === "template" ? "…" : "Пустой шаблон (.xlsx)"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={downloading === "export"}
              onClick={async () => {
                setDownloading("export");
                try {
                  await downloadBlob("/products/export-catalog", "products-catalog-export.xlsx");
                } finally {
                  setDownloading(null);
                }
              }}
            >
              {downloading === "export" ? "…" : "Текущие товары (экспорт)"}
            </Button>
            {draft ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearPreview}>
                Закрыть предпросмотр
              </Button>
            ) : null}
          </div>

          {!draft ? (
            <>
              <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
                <p className="font-medium text-foreground">Полный импорт (предпросмотр → подтверждение)</p>
                <p className="text-xs text-muted-foreground">
                  Новые товары добавляются; если <strong>Код</strong> (SKU) или название уже есть —
                  обновляются. Строки-дубликаты выделяются красным.
                </p>
                <ExcelFileDropZone
                  emptyLabel={parsing ? "Чтение…" : "Выберите файл Excel или перетащите его сюда"}
                  dropHint=""
                  className="justify-start px-3 text-xs"
                  onFile={(f) => void openVirtualPreview(f, "full")}
                  onInvalid={(m) => setMsg(m)}
                />
              </div>

              <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
                <p className="font-medium text-foreground">Только обновление (предпросмотр → подтверждение)</p>
                <p className="text-xs text-muted-foreground">
                  Сначала выполните экспорт и отредактируйте файл. Проверьте в предпросмотре, затем
                  подтвердите — новые SKU не создаются.
                </p>
                <ExcelFileDropZone
                  emptyLabel={parsing ? "Чтение…" : "Выберите файл Excel или перетащите его сюда"}
                  dropHint=""
                  className="justify-start px-3 text-xs"
                  onFile={(f) => void openVirtualPreview(f, "update")}
                  onInvalid={(m) => setMsg(m)}
                />
              </div>
            </>
          ) : null}

          {msg ? (
            <p
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                /xato|dublikat|ошиб|дубликат|исправьте|не удалось|отклонено|не найден|не выполнен|failed|tuzating/i.test(msg)
                  ? "border border-destructive/30 bg-destructive/10 text-destructive"
                  : "border border-sky-200 bg-sky-50 text-sky-900"
              )}
              role="alert"
            >
              {msg}
            </p>
          ) : null}

          {draft && stepForApply && tenantSlug ? (
            <div className="space-y-2 rounded-xl border border-sky-200/80 bg-sky-50/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Предпросмотр
                {previewMode === "update" ? " · только обновление" : " · полный импорт"} ·{" "}
                {draft.fileName}
              </p>
              <p className="text-xs text-muted-foreground">
                Отредактируйте ячейки. Дубликаты выделены красным. Когда всё готово, нажмите
                «Применить (в систему)».
              </p>
              <InitialSetupStepTable
                tenantSlug={tenantSlug}
                step={stepForApply}
                enabled
                externalPreview={draft}
                onApplied={(message) => {
                  setMsg(message);
                  clearPreview();
                  onDone();
                  void qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
                }}
                onFailed={(message, errors) => {
                  setMsg(message);
                  if (errors?.length) {
                    setImportDialog({
                      title: "Импорт — ошибки",
                      summary: message,
                      errors
                    });
                  }
                }}
              />
            </div>
          ) : null}
        </CardContent>
        <div className="border-t border-border/60 px-4 py-3">
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Вернуться к списку
          </Link>
        </div>
      </Card>

      <ProductCatalogImportErrorsDialog
        open={importDialog != null}
        onOpenChange={(open) => {
          if (!open) setImportDialog(null);
        }}
        title={importDialog?.title ?? "Ошибки импорта"}
        summary={importDialog?.summary}
        errors={importDialog?.errors ?? []}
      />
    </>
  );
}
