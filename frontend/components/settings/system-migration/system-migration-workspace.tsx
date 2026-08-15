"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import {
  applyMigrationBackup,
  downloadMigrationBackup,
  exportStatusLabel,
  fetchMigrationInventory,
  groupModulesByPhase,
  importStatusLabel,
  isLikelyBackupZip,
  MIGRATION_IMPORT_STAGE_LABELS,
  MIGRATION_ZIP_ACCEPT,
  moduleCountTotal,
  previewMigrationBackup,
  type MigrationApplyResult,
  type MigrationConflictPolicy,
  type MigrationImportPreview,
  type MigrationImportProgress,
  type MigrationPreviewModule
} from "@/lib/system-migration/api";

/** Prisma yo‘li / inglizcha stack — hech qachon toastga chiqmasin. */
function sanitizeMigrationUserMessage(raw: string, fallback: string): string {
  const m = (raw || "").trim();
  if (!m) return fallback;
  if (
    /Invalid `?\w+\.create\(\)`?|Argument [`']?\w+[`']? is missing|PrismaClient|invocation in|node_modules|[A-Za-z]:\\|\.ts:\d+/i.test(
      m
    )
  ) {
    if (/product/i.test(m)) {
      return "Mahsulot narxi import qilinmadi: mahsulot topilmadi. Avval asosiy spravochniklarni belgilang.";
    }
    return "Import amalga oshmadi: ba’zi bog‘lanishlar topilmadi. Spravochniklarni tekshirib qayta urinib ko‘ring.";
  }
  return m;
}

const TARGET_BLOCKER_LABELS_UZ: Record<string, string> = {
  orders: "buyurtmalar",
  payments: "to‘lovlar",
  clients: "mijozlar",
  products: "mahsulotlar",
  users: "foydalanuvchilar",
  warehouses: "omborlar"
};

function formatTargetBlockersUz(blockers: Record<string, number> | undefined): string {
  if (!blockers) return "";
  return Object.entries(blockers)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${TARGET_BLOCKER_LABELS_UZ[k] ?? k}: ${v}`)
    .join(", ");
}

const STAGE_ORDER = [
  "validate",
  "profile",
  "references",
  "bonus",
  "transactional",
  "extended",
  "done"
] as const;

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

function ImportProgressPanel({ progress }: { progress: MigrationImportProgress }) {
  const stageKey = progress.stage in MIGRATION_IMPORT_STAGE_LABELS ? progress.stage : progress.stage;
  const label = MIGRATION_IMPORT_STAGE_LABELS[stageKey] ?? progress.stage;
  const pct = Math.max(0, Math.min(100, progress.percent || 0));
  const activeIdx = STAGE_ORDER.findIndex((s) => s === progress.stage);

  return (
    <div
      className="space-y-3 rounded-md border border-sky-200 bg-sky-50/80 p-3 text-sm text-sky-950"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin text-sky-700" />
          Import jarayoni
        </span>
        <span className="tabular-nums font-semibold">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sky-100">
        <div
          className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-sky-900">
        <span className="font-medium">{label}</span>
        {progress.message ? ` — ${progress.message}` : null}
      </p>
      <ol className="flex flex-wrap gap-1.5">
        {STAGE_ORDER.map((id, idx) => {
          const done = activeIdx >= 0 ? idx < activeIdx || progress.stage === "done" : pct >= 100;
          const current = id === progress.stage;
          return (
            <li
              key={id}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                done || current
                  ? "bg-sky-600 text-white"
                  : "bg-white/70 text-sky-800 ring-1 ring-sky-200"
              )}
            >
              {MIGRATION_IMPORT_STAGE_LABELS[id] ?? id}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function selectablePreviewModules(modules: MigrationPreviewModule[]): MigrationPreviewModule[] {
  return modules.filter((m) => (m.import_status ?? "included") !== "planned");
}

export function SystemMigrationWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MigrationImportPreview | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [importMode, setImportMode] = useState<"full" | "profile_only">("full");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<MigrationImportProgress | null>(null);
  const [lastResult, setLastResult] = useState<MigrationApplyResult | null>(null);

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
      const ids = selectablePreviewModules(data.modules).map((m) => m.id);
      setSelectedModules(ids);
      setToast({
        text: data.valid
          ? "Arxiv tekshirildi — endi bo‘limlarni tanlab import qilishingiz mumkin"
          : data.errors.length
            ? `Arxiv yaroqsiz: ${data.errors.slice(0, 2).join("; ")}`
            : "Arxivda xatolar bor — boshqa ZIP tanlang",
        kind: data.valid ? "ok" : "err"
      });
    },
    onError: (e) =>
      setToast({
        text: sanitizeMigrationUserMessage(
          getUserFacingError(e, "Arxivni tekshirib bo‘lmadi"),
          "Arxivni tekshirib bo‘lmadi"
        ),
        kind: "err"
      })
  });

  const applyMut = useMutation({
    mutationFn: async (opts: {
      conflictPolicy: MigrationConflictPolicy;
      forceNonempty: boolean;
    }) => {
      if (!selectedFile) throw new Error("Fayl tanlanmagan");
      return applyMigrationBackup(tenantSlug!, selectedFile, {
        forceNonempty: opts.forceNonempty,
        mode: importMode,
        conflictPolicy: opts.conflictPolicy,
        modules:
          importMode === "full" && selectedModules.length > 0 ? selectedModules : undefined,
        onProgress: (p) => setImportProgress(p)
      });
    },
    onSuccess: (data) => {
      setLastResult(data);
      setImportProgress({ stage: "done", percent: 100, message: "Import yakunlandi" });
      const warnN = data.warnings?.length ?? 0;
      const appliedN = data.applied?.length ?? 0;
      setToast({
        text:
          warnN > 0
            ? `Import yakunlandi (${appliedN} qism). Ogohlantirish: ${warnN} ta — pastda ko‘ring.`
            : `Import muvaffaqiyatli: ${appliedN} qism qo‘llandi.`,
        kind: "ok"
      });
      void inventoryQ.refetch();
    },
    onError: (e) => {
      setImportProgress(null);
      setToast({
        text: sanitizeMigrationUserMessage(
          getUserFacingError(e, "Import amalga oshmadi. Qayta urinib ko‘ring."),
          "Import amalga oshmadi. Qayta urinib ko‘ring."
        ),
        kind: "err"
      });
    }
  });

  const runApply = (conflictPolicy: MigrationConflictPolicy, forceNonempty: boolean) => {
    if (!selectedFile || !tenantSlug) return;
    setConflictOpen(false);
    setImportProgress({ stage: "queued", percent: 1, message: "Yuklanmoqda…" });
    setLastResult(null);
    applyMut.mutate({ conflictPolicy, forceNonempty });
  };

  const onPickFile = useCallback(
    (file: File | null) => {
      setSelectedFile(null);
      setPreview(null);
      setLastResult(null);
      setImportProgress(null);
      setSelectedModules([]);
      setConflictOpen(false);
      if (!file) return;
      void (async () => {
        const check = await isLikelyBackupZip(file);
        if (!check.ok) {
          setToast({ text: check.reason ?? "ZIP qabul qilinmadi", kind: "err" });
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
        setSelectedFile(file);
        previewMut.mutate(file);
      })();
    },
    [previewMut]
  );

  const onExport = useCallback(async () => {
    if (!tenantSlug) return;
    setExportBusy(true);
    try {
      await downloadMigrationBackup(tenantSlug);
      setToast({ text: "To‘liq zaxira yuklab olindi", kind: "ok" });
    } catch (e) {
      setToast({ text: getUserFacingError(e, "Zaxirani yuklab bo‘lmadi"), kind: "err" });
    } finally {
      setExportBusy(false);
    }
  }, [tenantSlug]);

  const previewGroups = useMemo(
    () => groupModulesByPhase(preview?.modules ?? []),
    [preview?.modules]
  );

  const inventoryGroups = useMemo(
    () => groupModulesByPhase(inventoryQ.data?.modules ?? []),
    [inventoryQ.data?.modules]
  );

  const toggleModule = (id: string, enabled: boolean) => {
    setSelectedModules((prev) => {
      if (enabled) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const onApplyClick = () => {
    if (!preview?.valid) return;
    const hasModulePicker = (preview.modules?.length ?? 0) > 0;
    if (importMode === "full" && hasModulePicker && selectedModules.length === 0) {
      setToast({ text: "Kamida bitta bo‘limni tanlang", kind: "err" });
      return;
    }
    if (!preview.target_empty && importMode === "full") {
      setConflictOpen(true);
      return;
    }
    runApply("keep", false);
  };

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>;
  }

  if (role !== "admin") {
    return (
      <p className="text-sm text-muted-foreground">Bu bo‘lim faqat administrator uchun.</p>
    );
  }

  const importBusy = applyMut.isPending;
  const selectedLabels =
    preview?.modules
      .filter((m) => selectedModules.includes(m.id))
      .map((m) => m.label_uz || m.id)
      .slice(0, 6) ?? [];
  const opsBusyOnTarget =
    (preview?.target_blockers?.orders ?? 0) > 0 || (preview?.target_blockers?.payments ?? 0) > 0;
  const blockersSummary = formatTargetBlockersUz(preview?.target_blockers);
  const hasInitialSetupSelected = selectedModules.includes("initial_setup");
  const hasSpravochnikiSelected = selectedModules.includes("spravochniki");
  const priceWithoutProductsRisk =
    importMode === "full" && hasInitialSetupSelected && !hasSpravochnikiSelected;

  return (
    <div className="space-y-4">
      {toast ? (
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
            toast.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          )}
          role="status"
        >
          <span>{toast.text}</span>
          <button
            type="button"
            className={cn("underline", toast.kind === "ok" ? "text-emerald-700" : "text-red-700")}
            onClick={() => setToast(null)}
          >
            Yopish
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="h-full">
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
          <CardContent className="flex flex-col gap-3">
            <Button type="button" disabled={exportBusy || !tenantSlug} onClick={() => void onExport()}>
              {exportBusy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              To‘liq zaxira yuklab olish (.zip)
            </Button>
            <p className="text-xs text-muted-foreground">
              Format v5: profil, boshlang‘ich sozlamalar, katalog, RBAC, narxlar, bonus/KPI, operatsion
              tarix va fotolar — bitta ZIP.
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-5 text-primary" />
              Yangi serverga yuklash (import)
            </CardTitle>
            <CardDescription>
              Tizimdan yuklab olingan ZIP ni tanlang yoki shu yerga tashlang. Keyin bo‘limlarni
              (jumladan boshlang‘ich sozlamalarni) alohida belgilang.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept={MIGRATION_ZIP_ACCEPT}
              className="hidden"
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <div
              className={cn(
                "rounded-md border border-dashed px-3 py-4 text-sm transition-colors",
                importBusy
                  ? "pointer-events-none opacity-60"
                  : "cursor-pointer hover:border-primary/50 hover:bg-muted/40"
              )}
              onClick={() => !importBusy && fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (importBusy) return;
                onPickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={importBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileRef.current?.click();
                  }}
                >
                  <FileArchive className="mr-2 size-4" />
                  ZIP tanlash
                </Button>
                {selectedFile ? (
                  <span className="truncate text-muted-foreground">{selectedFile.name}</span>
                ) : (
                  <span className="text-muted-foreground">
                    yoki .zip faylni shu yerga tashlang
                  </span>
                )}
              </div>
            </div>

            {previewMut.isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Tekshirilmoqda…
              </p>
            ) : null}

            {importBusy && importProgress ? <ImportProgressPanel progress={importProgress} /> : null}

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
                  <StatusBadge ok={preview.has_profile} label="Profil" />
                  <StatusBadge
                    ok={preview.has_initial_setup_xlsx}
                    label="Boshlang‘ich sozlamalar (Excel)"
                  />
                  <StatusBadge ok={preview.has_reference_json} label="Spravochnik JSON" />
                  <StatusBadge ok={preview.has_transactional_json} label="Operatsion JSON" />
                  <StatusBadge ok={preview.has_field_activity_json} label="Agent/xarajat JSON" />
                </div>
                {preview.errors.length > 0 ? (
                  <ul className="list-inside list-disc text-amber-800">
                    {preview.errors.map((e, i) => (
                      <li key={`err-${i}`}>{e}</li>
                    ))}
                  </ul>
                ) : null}
                {!preview.target_empty ? (
                  <p className="text-amber-800">
                    Maqsadda allaqachon bor:{" "}
                    {formatTargetBlockersUz(preview.target_blockers) || "ma’lumotlar"}. Import oldidan
                    dublikat siyosatini tanlaysiz; buyurtma/to‘lov bo‘lsa operatsion tarix o‘tkazib
                    yuboriladi.
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={importMode === "full"}
                      disabled={importBusy}
                      onChange={() => setImportMode("full")}
                    />
                    To‘liq import (tanlangan bo‘limlar)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={importMode === "profile_only"}
                      disabled={importBusy}
                      onChange={() => setImportMode("profile_only")}
                    />
                    Faqat profil
                  </label>
                </div>

                {importMode === "full" && previewGroups.length > 0 ? (
                  <div className="space-y-3 rounded-md border bg-background/80 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">Arxiv bo‘limlari</p>
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          className="text-primary underline disabled:opacity-50"
                          disabled={importBusy}
                          onClick={() =>
                            setSelectedModules(
                              selectablePreviewModules(preview.modules).map((m) => m.id)
                            )
                          }
                        >
                          Hammasini
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground underline disabled:opacity-50"
                          disabled={importBusy}
                          onClick={() => setSelectedModules([])}
                        >
                          Hech qaysi
                        </button>
                      </div>
                    </div>
                    {previewGroups.map((group) => (
                      <div key={group.phase} className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </p>
                        <ul className="space-y-1">
                          {group.items.map((m) => {
                            const planned = (m.import_status ?? "included") === "planned";
                            const checked = selectedModules.includes(m.id);
                            const total = moduleCountTotal(m.counts);
                            return (
                              <li key={m.id}>
                                <label
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60",
                                    planned && "cursor-not-allowed opacity-50"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    disabled={importBusy || planned}
                                    checked={checked && !planned}
                                    onChange={(e) => toggleModule(m.id, e.target.checked)}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="font-medium text-foreground">
                                      {m.label_uz || m.id}
                                    </span>
                                    <span className="mt-0.5 block text-muted-foreground">
                                      {total > 0 && m.counts
                                        ? Object.entries(m.counts)
                                            .filter(([, v]) => v > 0)
                                            .map(([k, v]) => `${k}: ${v}`)
                                            .join(", ")
                                        : "yozuvlar yo‘q / rejada"}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}

                <Button
                  type="button"
                  disabled={
                    !preview.valid ||
                    importBusy ||
                    (importMode === "full" &&
                      (preview.modules?.length ?? 0) > 0 &&
                      selectedModules.length === 0)
                  }
                  onClick={onApplyClick}
                >
                  {importBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {importMode === "full" ? "To‘liq importni qo‘llash" : "Profilni qo‘llash"}
                </Button>
                {!preview.target_empty && importMode === "full" ? (
                  <p className="text-xs text-muted-foreground">
                    Qo‘llashdan oldin dublikatlar oynasi ochiladi: eskisini qoldirish (xavfsiz) yoki
                    yangisini almashtirish.
                  </p>
                ) : null}
                {importMode === "full" &&
                selectedModules.includes("initial_setup") &&
                !selectedModules.includes("spravochniki") ? (
                  <p className="text-xs text-amber-800">
                    Maslahat: narxlar uchun «Asosiy spravochniklar»ni ham belgilang — aks holda ba’zi
                    narxlar o‘tkazib yuborilishi mumkin.
                  </p>
                ) : null}
                {importMode === "full" && (preview.format_version ?? 0) < 5 ? (
                  <p className="text-xs text-amber-800">
                    Format v{preview.format_version} — to‘liq zaxira (katalog, RBAC, bog‘lanishlar) uchun
                    yangi eksport oling (v5).
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

            {lastResult && !importBusy ? (
              <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
                <p className="font-medium text-sm">Oxirgi natija</p>
                <p className="text-muted-foreground">
                  Qo‘llandi: {lastResult.applied.length} qism
                  {lastResult.skipped.length ? ` · o‘tkazib yuborildi: ${lastResult.skipped.length}` : ""}
                  {lastResult.warnings.length ? ` · ogohlantirish: ${lastResult.warnings.length}` : ""}
                </p>
                {lastResult.warnings.length ? (
                  <ul className="list-inside list-disc text-amber-800">
                    {lastResult.warnings.slice(0, 12).map((w, i) => (
                      <li key={`warn-${i}-${w.slice(0, 24)}`}>{w}</li>
                    ))}
                    {lastResult.warnings.length > 12 ? (
                      <li>… yana {lastResult.warnings.length - 12} ta</li>
                    ) : null}
                  </ul>
                ) : null}
                {lastResult.skipped.length ? (
                  <p className="text-muted-foreground">
                    O‘tkazib yuborildi: {lastResult.skipped.join(", ")}
                  </p>
                ) : null}
                {lastResult.next_steps.length ? (
                  <ul className="list-inside list-disc text-muted-foreground">
                    {lastResult.next_steps.map((s, i) => (
                      <li key={`step-${i}`}>{s}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ma’lumotlar qamrovi</CardTitle>
          <CardDescription>
            Joriy tenantdagi yozuvlar soni — bo‘limlar bo‘yicha. «Rejada» — keyingi bosqichlarda
            qo‘shiladi.
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
                  {inventoryGroups.map((group) => (
                    <Fragment key={`phase-${group.phase}`}>
                      <tr className="bg-muted/40">
                        <td
                          colSpan={4}
                          className="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {group.label}
                        </td>
                      </tr>
                      {group.items.map((m) => (
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
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="sm:max-w-lg" overlayClassName="bg-black/40">
          <DialogHeader>
            <DialogTitle>Dublikatlar: qanday davom etamiz?</DialogTitle>
            <DialogDescription>
              Bu kompaniyada allaqachon ma’lumot bor. Bir xil kod/SKU/login bo‘lgan yozuvlar uchun
              quyidagidan birini tanlang.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5">
              <p className="font-medium text-foreground">Eskisini qoldirish</p>
              <p className="text-xs text-muted-foreground">
                Mavjud mijoz, mahsulot, user va boshqalar o‘zgarmaydi. Arxivdagi yangi qiymatlar
                yozilmaydi — xavfsizroq tanlov (odatda shuni tanlang).
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5">
              <p className="font-medium text-foreground">Yangisini almashtirish</p>
              <p className="text-xs text-muted-foreground">
                Bir xil kalitli yozuvlar arxivdagi ma’lumot bilan yangilanadi (nom, narx, telefon va
                hokazo). Faqat arxivdagi ma’lumot to‘g‘ri ekaniga ishonchingiz komil bo‘lsa.
              </p>
            </div>

            {(blockersSummary || opsBusyOnTarget || priceWithoutProductsRisk) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-1">
                <p className="font-medium flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Import oldidan eslatma
                </p>
                {blockersSummary ? <p>Maqsadda bor: {blockersSummary}.</p> : null}
                {opsBusyOnTarget ? (
                  <p>
                    Maqsadda buyurtmalar yoki to‘lovlar bor — operatsion tarix (buyurtma/to‘lov)
                    import qilinmaydi (dublikatdan saqlanish).
                  </p>
                ) : null}
                {priceWithoutProductsRisk ? (
                  <p>
                    «Boshlang‘ich sozlamalar» tanlangan, lekin «Asosiy spravochniklar» yo‘q —
                    mahsulot narxlari uchun mahsulotlar topilmasa, ular o‘tkazib yuboriladi.
                  </p>
                ) : null}
              </div>
            )}

            {selectedLabels.length ? (
              <p className="text-xs text-muted-foreground">
                Tanlangan bo‘limlar: {selectedLabels.join(", ")}
                {selectedModules.length > selectedLabels.length ? "…" : ""}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={importBusy}
              onClick={() => runApply("keep", true)}
            >
              Eskisini qoldirish
            </Button>
            <Button
              type="button"
              className="w-full"
              disabled={importBusy}
              onClick={() => runApply("replace", true)}
            >
              Yangisini almashtirish
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={importBusy}
              onClick={() => setConflictOpen(false)}
            >
              Bekor qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
