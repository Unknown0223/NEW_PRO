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

export type MigrationImportPreview = {
  valid: boolean;
  errors: string[];
  manifest: Record<string, unknown> | null;
  source: { tenant_slug?: string; tenant_name?: string } | null;
  modules: Array<{
    id: string;
    label_uz?: string;
    counts?: Record<string, number>;
    export_status?: string;
    import_status?: string;
  }>;
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

export type MigrationApplyResult = {
  applied: string[];
  skipped: string[];
  warnings: string[];
  next_steps: string[];
};

export async function fetchMigrationInventory(tenantSlug: string): Promise<MigrationInventory> {
  const { data } = await api.get<MigrationInventory>(`/api/${tenantSlug}/system-migration/inventory`);
  return data;
}

export async function downloadMigrationBackup(tenantSlug: string): Promise<void> {
  const { data } = await api.get(`/api/${tenantSlug}/system-migration/export.backup.zip`, {
    responseType: "blob"
  });
  const blob = data as Blob;
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salec-backup-${tenantSlug}-${date}.salec-backup.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewMigrationBackup(
  tenantSlug: string,
  file: File
): Promise<MigrationImportPreview> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<MigrationImportPreview>(
    `/api/${tenantSlug}/system-migration/import/preview`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function applyMigrationBackup(
  tenantSlug: string,
  file: File,
  opts: { forceNonempty?: boolean; mode?: MigrationApplyMode }
): Promise<MigrationApplyResult> {
  const form = new FormData();
  form.append("file", file);
  if (opts.forceNonempty) form.append("force_nonempty", "true");
  if (opts.mode) form.append("mode", opts.mode);
  const { data } = await api.post<MigrationApplyResult>(
    `/api/${tenantSlug}/system-migration/import/apply`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export function moduleCountTotal(counts: Record<string, number>): number {
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
