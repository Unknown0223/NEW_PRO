import { api } from "@/lib/api";

export type MigrationInventoryModule = {
  id: string;
  label_uz: string;
  label_ru: string;
  phase: number;
  export_status: string;
  import_status: string;
  import_note_uz?: string;
  counts: Record<string, number>;
};

export type MigrationInventory = {
  tenant_id: number;
  generated_at: string;
  modules: MigrationInventoryModule[];
  totals: { records: number };
};

export type MigrationPreviewModule = {
  id: string;
  label_uz?: string;
  label_ru?: string;
  phase?: number;
  counts?: Record<string, number>;
  export_status?: string;
  import_status?: string;
};

export type MigrationImportPreview = {
  valid: boolean;
  errors: string[];
  manifest: Record<string, unknown> | null;
  source: { tenant_slug?: string; tenant_name?: string } | null;
  modules: MigrationPreviewModule[];
  has_profile: boolean;
  has_initial_setup_xlsx: boolean;
  has_reference_json: boolean;
  has_transactional_json: boolean;
  has_field_activity_json: boolean;
  format_version: number | null;
  target_empty: boolean;
  target_blockers: Record<string, number>;
};

export type MigrationApplyMode = "full" | "profile_only";
export type MigrationConflictPolicy = "keep" | "replace";

export type MigrationApplyResult = {
  applied: string[];
  skipped: string[];
  warnings: string[];
  next_steps: string[];
};

export type MigrationImportProgress = {
  stage: string;
  percent: number;
  message: string;
  updated_at?: string;
};

export type MigrationImportSession = {
  id: string;
  tenant_id: number;
  state: "active" | "completed" | "failed";
  progress: MigrationImportProgress;
  result?: MigrationApplyResult;
  error?: string;
};

export type MigrationApplyAsyncAccepted = {
  async: true;
  jobId?: string;
  queue?: string;
  sessionId?: string;
  message?: string;
};

export const MIGRATION_IMPORT_STAGE_LABELS: Record<string, string> = {
  queued: "Navbatda",
  validate: "Tekshirish",
  profile: "Profil",
  references: "Spravochniklar",
  bonus: "Bonus / KPI",
  transactional: "Operatsion tarix",
  extended: "Kengaytirilgan",
  done: "Tayyor",
  failed: "Xato",
  waiting: "Navbatda",
  active: "Ishlamoqda",
  completed: "Tayyor"
};

export const MIGRATION_PHASE_LABELS_UZ: Record<number, string> = {
  1: "Profil va boshlang‘ich sozlamalar",
  2: "Operatsion (buyurtma, to‘lov, ombor)",
  3: "Agent faoliyati",
  4: "KPI, fayllar va kengaytirilgan"
};

/** Fayl tanlash dialogeni uchun (Windows `application/x-zip-compressed` ham). */
export const MIGRATION_ZIP_ACCEPT =
  ".zip,application/zip,application/x-zip-compressed,application/octet-stream";

export async function fetchMigrationInventory(tenantSlug: string): Promise<MigrationInventory> {
  const { data } = await api.get<MigrationInventory>(`/api/${tenantSlug}/system-migration/inventory`);
  return data;
}

/** Brauzer MIME ishonchsiz — kengaytma + ZIP magic (PK\\x03\\x04 / PK\\x05\\x06). */
export async function isLikelyBackupZip(file: File): Promise<{ ok: boolean; reason?: string }> {
  const name = (file.name || "").toLowerCase();
  const looksZipName =
    name.endsWith(".zip") || name.endsWith(".salec-backup.zip") || name.includes(".salec-backup");
  if (!looksZipName && file.type && !/zip|octet-stream/i.test(file.type)) {
    return {
      ok: false,
      reason: "Faqat tizim zaxira ZIP fayli qabul qilinadi (.zip / .salec-backup.zip)."
    };
  }
  if (file.size < 4) {
    return { ok: false, reason: "Fayl bo‘sh yoki juda kichik." };
  }
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isPk = head[0] === 0x50 && head[1] === 0x4b;
    if (!isPk) {
      return {
        ok: false,
        reason: "Fayl yaroqli ZIP emas. Avval «To‘liq zaxira yuklab olish» dan olingan arxivni tanlang."
      };
    }
  } catch {
    /* magic o‘qilmasa — server preview tekshiradi */
  }
  return { ok: true };
}

export async function downloadMigrationBackup(tenantSlug: string): Promise<void> {
  const { data } = await api.get(`/api/${tenantSlug}/system-migration/export.backup.zip`, {
    responseType: "blob"
  });
  const blob = data as Blob;
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isPk = head[0] === 0x50 && head[1] === 0x4b;
  if (!isPk) {
    const text = await blob.text().catch(() => "");
    throw new Error(
      text.trim().slice(0, 200) || "Eksport yaroqli ZIP qaytarmadi. Qayta urinib ko‘ring."
    );
  }
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salec-backup-${tenantSlug}-${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewMigrationBackup(
  tenantSlug: string,
  file: File
): Promise<MigrationImportPreview> {
  const form = new FormData();
  // field nomi backend `request.file()` / parts bilan mos
  form.append("file", file, file.name || "salec-backup.zip");
  const { data } = await api.post<MigrationImportPreview>(
    `/api/${tenantSlug}/system-migration/import/preview`,
    form
  );
  return data;
}

async function pollJobUntilDone(
  tenantSlug: string,
  jobId: string,
  onProgress: (p: MigrationImportProgress) => void
): Promise<MigrationApplyResult> {
  const maxAttempts = 4000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const { data: job } = await api.get<{
      state: string;
      progress?: { stage?: string; percent?: number; message?: string };
      returnvalue?: MigrationApplyResult;
      failedReason?: string;
      workersConnected?: number;
    }>(`/api/${tenantSlug}/jobs/${jobId}`);

    const percent = typeof job.progress?.percent === "number" ? job.progress.percent : 0;
    onProgress({
      stage: String(job.progress?.stage ?? job.state),
      percent: job.state === "completed" ? 100 : percent,
      message: job.progress?.message || (job.state === "waiting" ? "Navbatda…" : "Ishlamoqda…")
    });

    if (job.state === "waiting" && job.workersConnected === 0 && i >= 10) {
      throw new Error("Worker ishlamayapti — start-dev-quick yoki worker ni ishga tushiring.");
    }
    if (job.state === "completed") {
      const r = job.returnvalue;
      if (r && typeof r === "object" && Array.isArray(r.applied)) return r;
      return { applied: [], skipped: [], warnings: [], next_steps: [] };
    }
    if (job.state === "failed") {
      throw new Error(job.failedReason || "Import xatosi");
    }
  }
  throw new Error("Import kutish vaqti tugadi");
}

async function pollSessionUntilDone(
  tenantSlug: string,
  sessionId: string,
  onProgress: (p: MigrationImportProgress) => void
): Promise<MigrationApplyResult> {
  const maxAttempts = 4000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const { data } = await api.get<MigrationImportSession>(
      `/api/${tenantSlug}/system-migration/import/sessions/${sessionId}`
    );
    onProgress({
      stage: data.progress.stage,
      percent: data.progress.percent,
      message: data.progress.message,
      updated_at: data.progress.updated_at
    });
    if (data.state === "completed" && data.result) return data.result;
    if (data.state === "failed") throw new Error(data.error || "Import xatosi");
  }
  throw new Error("Import kutish vaqti tugadi");
}

export async function applyMigrationBackup(
  tenantSlug: string,
  file: File,
  opts: {
    forceNonempty?: boolean;
    mode?: MigrationApplyMode;
    conflictPolicy?: MigrationConflictPolicy;
    modules?: string[];
    onProgress?: (p: MigrationImportProgress) => void;
  }
): Promise<MigrationApplyResult> {
  const form = new FormData();
  form.append("file", file, file.name || "salec-backup.zip");
  if (opts.forceNonempty) form.append("force_nonempty", "true");
  if (opts.mode) form.append("mode", opts.mode);
  if (opts.conflictPolicy) form.append("conflict_policy", opts.conflictPolicy);
  if (opts.modules?.length) form.append("modules", JSON.stringify(opts.modules));

  const { data, status } = await api.post<MigrationApplyResult | MigrationApplyAsyncAccepted>(
    `/api/${tenantSlug}/system-migration/import/apply`,
    form,
    {
      validateStatus: (s) => (s >= 200 && s < 300) || s === 202
    }
  );

  if (status === 202 && data && typeof data === "object" && "async" in data && data.async) {
    const accepted = data as MigrationApplyAsyncAccepted;
    const onProgress = opts.onProgress ?? (() => undefined);
    if (accepted.jobId) {
      return pollJobUntilDone(tenantSlug, accepted.jobId, onProgress);
    }
    if (accepted.sessionId) {
      return pollSessionUntilDone(tenantSlug, accepted.sessionId, onProgress);
    }
    throw new Error("Async import javobida jobId/sessionId yo‘q");
  }

  return data as MigrationApplyResult;
}

export function moduleCountTotal(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export function importStatusLabel(status: string): string {
  if (status === "included") return "Import qo‘llab-quvvatlanadi";
  if (status === "partial") return "Qisman import";
  return "Keyingi bosqich";
}

export function exportStatusLabel(status: string): string {
  return status === "included" ? "Arxivga kiritiladi" : "Rejada";
}

export function groupModulesByPhase<T extends { id: string; phase?: number }>(
  modules: T[]
): Array<{ phase: number; label: string; items: T[] }> {
  const map = new Map<number, T[]>();
  for (const m of modules) {
    const phase = typeof m.phase === "number" && m.phase >= 1 && m.phase <= 4 ? m.phase : 1;
    const list = map.get(phase) ?? [];
    list.push(m);
    map.set(phase, list);
  }
  return [1, 2, 3, 4]
    .filter((p) => map.has(p))
    .map((phase) => ({
      phase,
      label: MIGRATION_PHASE_LABELS_UZ[phase] ?? `Bosqich ${phase}`,
      items: map.get(phase) ?? []
    }));
}
