"use client";

import { ProductCatalogImportErrorsDialog } from "@/components/products/product-catalog-import-errors-dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { api, formatApiSupportReference } from "@/lib/api";
import { cn } from "@/lib/utils";
import { getUserFacingError } from "@/lib/error-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

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

  function showImportErrors(title: string, summary: string | null, errors: string[]) {
    if (errors.length === 0) return;
    setImportDialog({ title, summary, errors });
  }

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
                : "Yuklab olish rad etildi.";
          const ref = formatApiSupportReference(typeof j.requestId === "string" ? j.requestId.trim() : undefined);
          setMsg(ref ? `${base} — ${ref}` : base);
        } catch {
          setMsg("Yuklab olish rad etildi.");
        }
        return;
      }
      triggerBlobDownload(blob, filename);
      setMsg(null);
    } catch (e) {
      setMsg(getUserFacingError(e, "Yuklab bo‘lmadi — tarmoq yoki ruxsat."));
    }
  }

  const importFullMut = useMutation({
    mutationFn: async (file: File) => {
      if (!tenantSlug) throw new Error("no");
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{ created: number; updated: number; errors: string[] }>(
        `/api/${tenantSlug}/products/import-catalog`,
        fd
      );
      return data;
    },
    onSuccess: (res) => {
      const summary = `Yaratildi: ${res.created}, yangilandi: ${res.updated}.`;
      if (res.errors.length > 0) {
        setMsg(null);
        showImportErrors("Import — xatolar", summary, res.errors);
      } else {
        setMsg(summary);
      }
      onDone();
      void qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e, "Import xatosi — ustunlar yoki faylni tekshiring."))
  });

  const importUpdateMut = useMutation({
    mutationFn: async (file: File) => {
      if (!tenantSlug) throw new Error("no");
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<{
        updated: number;
        skipped_empty: number;
        skipped_unknown_sku: number;
        skipped_no_change: number;
        errors: string[];
      }>(`/api/${tenantSlug}/products/import-catalog-update`, fd);
      return data;
    },
    onSuccess: (res) => {
      const summary = `Yangilandi: ${res.updated}. O‘zgarishsiz: ${res.skipped_no_change}. SKU topilmadi: ${res.skipped_unknown_sku}.`;
      if (res.errors.length > 0) {
        setMsg(null);
        showImportErrors("Yangilash importi — xatolar", summary, res.errors);
      } else {
        setMsg(summary);
      }
      onDone();
      void qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e, "Yangilash importi xatosi."))
  });

  return (
    <>
      <Card className="border-primary/20">
        {showCardHeader ? (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Excel — katalog importi</CardTitle>
            <CardDescription>
              <strong>Название</strong>, <strong>Категория</strong> (nomi),{" "}
              <strong>Единица измерения(код)</strong> majburiy (yangi qatorlar va to‘liq importda).
              Kategoriya spravochnikdagi <strong>nom</strong>i bilan mos bo‘lishi kerak (registr va
              bo‘shliqlar hisobga olinmaydi).
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
              {downloading === "template" ? "…" : "Bo‘sh shablon (.xlsx)"}
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
              {downloading === "export" ? "…" : "Joriy mahsulotlar (eksport)"}
            </Button>
          </div>

          <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
            <p className="font-medium text-foreground">To‘liq import</p>
            <p className="text-xs text-muted-foreground">
              Yangi mahsulotlar qo‘shiladi; <strong>Код</strong> (SKU) allaqachon bo‘lsa — qator
              yangilanadi. Faylda yo‘q mahsulotlarga tegilmaydi.
            </p>
            <ExcelFileDropZone
              emptyLabel="Excel faylni tanlang yoki shu yerga tashlang"
              dropHint=""
              className="justify-start px-3 text-xs"
              onFile={(f) => {
                setMsg(null);
                importFullMut.mutate(f);
              }}
              onInvalid={(m) => setMsg(m)}
            />
          </div>

          <div className="rounded-md border border-border/80 bg-muted/20 p-3 space-y-2">
            <p className="font-medium text-foreground">Faqat yangilash (o‘zgarishlar)</p>
            <p className="text-xs text-muted-foreground">
              Avval «Joriy mahsulotlar»ni yuklab oling, kerakli qatorlarni tahrirlang. Qayta yuklanganda
              faqat faylda qolgan SKU lar yangilanadi va <strong>faqat o‘zgargan</strong> maydonlar yoziladi;
              fayldan olib tashlangan mahsulotlar bazada o‘zgarishsiz qoladi; yangi SKU yaratilmaydi.
            </p>
            <ExcelFileDropZone
              emptyLabel="Excel faylni tanlang yoki shu yerga tashlang"
              dropHint=""
              className="justify-start px-3 text-xs"
              onFile={(f) => {
                setMsg(null);
                importUpdateMut.mutate(f);
              }}
              onInvalid={(m) => setMsg(m)}
            />
          </div>

          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
        </CardContent>
        <div className="border-t border-border/60 px-4 py-3">
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Ro‘yxatga qaytish
          </Link>
        </div>
      </Card>

      <ProductCatalogImportErrorsDialog
        open={importDialog != null}
        onOpenChange={(open) => {
          if (!open) setImportDialog(null);
        }}
        title={importDialog?.title ?? "Import xatolari"}
        summary={importDialog?.summary}
        errors={importDialog?.errors ?? []}
      />
    </>
  );
}
