"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  Loader2,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import {
  applyMigrationBackup,
  downloadMigrationBackup,
  exportStatusLabel,
  fetchMigrationInventory,
  importStatusLabel,
  moduleCountTotal,
  previewMigrationBackup,
  type MigrationImportPreview
} from "@/lib/system-migration/api";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
      )}
    >
      {label}
    </span>
  );
}

export function SystemMigrationWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MigrationImportPreview | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [forceNonempty, setForceNonempty] = useState(false);
  const [importMode, setImportMode] = useState<"full" | "profile_only">("full");

  const inventoryQ = useQuery({
    queryKey: ["system-migration-inventory", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated && role === "admin",
    staleTime: STALE.list,
    queryFn: () => fetchMigrationInventory(tenantSlug!)
  });

  const previewMut = useMutation({
    mutationFn: async (file: File) => previewMigrationBackup(tenantSlug!, file),
    onSuccess: (data) => {
      setPreview(data);
      setToast(data.valid ? "Arxiv tekshirildi" : "Arxivda xatolar bor");
    },
    onError: (e) => setToast(getUserFacingError(e))
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Fayl tanlanmagan");
      return applyMigrationBackup(tenantSlug!, selectedFile, { forceNonempty, mode: importMode });
    },
    onSuccess: (data) => {
      setToast(`Qo‘llandi: ${data.applied.join(", ")}`);
      void inventoryQ.refetch();
    },
    onError: (e) => setToast(getUserFacingError(e))
  });

  const onPickFile = useCallback(
    (file: File | null) => {
      setSelectedFile(file);
      setPreview(null);
      if (file) previewMut.mutate(file);
    },
    [previewMut]
  );

  const onExport = useCallback(async () => {
    if (!tenantSlug) return;
    setExportBusy(true);
    try {
      await downloadMigrationBackup(tenantSlug);
      setToast("To‘liq zaxira yuklab olindi");
    } catch (e) {
      setToast(getUserFacingError(e));
    } finally {
      setExportBusy(false);
    }
  }, [tenantSlug]);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>;
  }

  if (role !== "admin") {
    return (
      <p className="text-sm text-muted-foreground">
        Bu bo‘lim faqat administrator uchun.
      </p>
    );
  }

  const modules = inventoryQ.data?.modules ?? [];

  return (
    <div className="space-y-4">
      {toast ? (
        <div
          className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          <span>{toast}</span>
          <button type="button" className="text-emerald-700 underline" onClick={() => setToast(null)}>
            Yopish
          </button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="size-5 text-primary" />
            To‘liq zaxira (eksport)
          </CardTitle>
          <CardDescription>
            Barcha spravochniklar, buyurtmalar, to‘lovlar, audit va boshqa ma’lumotlarni bitta ZIP
            arxivga yig‘adi. Yangi serverga ko‘chirish uchun saqlang.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={exportBusy || !tenantSlug} onClick={() => void onExport()}>
            {exportBusy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            To‘liq zaxira yuklab olish (.salec-backup.zip)
          </Button>
          <p className="text-xs text-muted-foreground">
            Format v5: to‘liq zaxira — katalog, RBAC, narxlar, bog‘lanishlar, bonus/KPI, operatsion tarix va
            mijoz fotolari.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-5 text-primary" />
            Yangi serverga yuklash (import)
          </CardTitle>
          <CardDescription>
            Eski serverdan olingan <code className="text-xs">.salec-backup.zip</code> faylini yuklang.
            Maqsadli tenant bo‘sh bo‘lishi kerak (buyurtma/to‘lov/mijoz/mahsulot yo‘q).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.salec-backup.zip,application/zip"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <FileArchive className="mr-2 size-4" />
              ZIP tanlash
            </Button>
            {selectedFile ? (
              <span className="self-center text-sm text-muted-foreground">{selectedFile.name}</span>
            ) : null}
          </div>

          {previewMut.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Tekshirilmoqda…
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {preview.valid ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="size-4 text-amber-600" />
                )}
                <span className="font-medium">
                  Manba: {preview.source?.tenant_slug ?? "—"} ({preview.source?.tenant_name ?? "—"})
                </span>
                <StatusBadge
                  ok={preview.target_empty}
                  label={preview.target_empty ? "Maqsad tenant bo‘sh" : "Maqsad tenant bo‘sh emas"}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <StatusBadge
                  ok={(preview.format_version ?? 0) >= 5}
                  label={`Format v${preview.format_version ?? "?"}`}
                />
                <StatusBadge ok={preview.has_reference_json} label="Spravochnik JSON" />
                <StatusBadge ok={preview.has_transactional_json} label="Operatsion JSON" />
                <StatusBadge ok={preview.has_field_activity_json} label="Agent/xarajat JSON" />
              </div>
              {preview.errors.length > 0 ? (
                <ul className="list-inside list-disc text-amber-800">
                  {preview.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              {!preview.target_empty ? (
                <p className="text-amber-800">
                  Bloklovchilar:{" "}
                  {Object.entries(preview.target_blockers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === "full"}
                    onChange={() => setImportMode("full")}
                  />
                  To‘liq import (profil + spravochniklar + tarix)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === "profile_only"}
                    onChange={() => setImportMode("profile_only")}
                  />
                  Faqat profil
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={forceNonempty}
                  onChange={(e) => setForceNonempty(e.target.checked)}
                />
                Bo‘sh bo‘lmasa ham import (xavfli)
              </label>
              <Button
                type="button"
                disabled={!preview.valid || applyMut.isPending || (!preview.target_empty && !forceNonempty)}
                onClick={() => applyMut.mutate()}
              >
                {applyMut.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {importMode === "full" ? "To‘liq importni qo‘llash" : "Profilni qo‘llash"}
              </Button>
              {importMode === "full" && (preview.format_version ?? 0) < 5 ? (
                <p className="text-xs text-amber-800">
                  Format v{preview.format_version} — to‘liq zaxira (katalog, RBAC, bog‘lanishlar) uchun yangi
                  eksport oling (v5).
                </p>
              ) : null}
              {importMode === "full" && preview.format_version === 1 && !preview.has_reference_json ? (
                <p className="text-xs text-amber-800">
                  Eski format (v1) — to‘liq import uchun avval yangi zaxira eksport qiling.
                </p>
              ) : null}
              {importMode === "profile_only" && preview.has_initial_setup_xlsx ? (
                <p className="text-xs text-muted-foreground">
                  Keyin{" "}
                  <Link href="/settings/initial-setup" className="text-primary underline">
                    Boshlang‘ich sozlash
                  </Link>{" "}
                  orqali arxivdagi Excel (initial-setup.xlsx) ni import qiling.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ma’lumotlar qamrovi</CardTitle>
          <CardDescription>
            Joriy tenantdagi yozuvlar soni. «Rejada» — keyingi bosqichlarda qo‘shiladi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Hisoblanmoqda…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Modul</th>
                    <th className="py-2 pr-3 font-medium">Yozuvlar</th>
                    <th className="py-2 pr-3 font-medium">Eksport</th>
                    <th className="py-2 font-medium">Import</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{m.label_uz}</div>
                        <div className="text-xs text-muted-foreground">{m.label_ru}</div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {moduleCountTotal(m.counts) > 0
                          ? Object.entries(m.counts)
                              .filter(([, v]) => v > 0)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusBadge
                          ok={m.export_status === "included"}
                          label={exportStatusLabel(m.export_status)}
                        />
                      </td>
                      <td className="py-2">
                        <StatusBadge
                          ok={m.import_status === "included"}
                          label={importStatusLabel(m.import_status)}
                        />
                        {m.import_note_uz ? (
                          <p className="mt-1 text-xs text-muted-foreground">{m.import_note_uz}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
