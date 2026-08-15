import JSZip from "jszip";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_KIND,
  INITIAL_SETUP_XLSX_PATH,
  MANIFEST_PATH,
  MIGRATION_MODULES,
  PROFILE_JSON_PATH
} from "./system-migration.constants";
import { isTargetTenantEmptyForImport } from "./system-migration.inventory";

export type ParsedBackupPreview = {
  valid: boolean;
  errors: string[];
  manifest: Record<string, unknown> | null;
  source: { tenant_slug?: string; tenant_name?: string } | null;
  modules: Array<{
    id: string;
    label_uz?: string;
    label_ru?: string;
    phase?: number;
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

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  return entry.async("string");
}

function emptyPreview(errors: string[]): ParsedBackupPreview {
  return {
    valid: false,
    errors,
    manifest: null,
    source: null,
    modules: [],
    has_profile: false,
    has_initial_setup_xlsx: false,
    has_reference_json: false,
    has_transactional_json: false,
    has_field_activity_json: false,
    format_version: null,
    target_empty: false,
    target_blockers: {}
  };
}

export async function parseBackupZip(buf: Buffer, targetTenantId: number): Promise<ParsedBackupPreview> {
  const errors: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return emptyPreview(["Fayl yaroqli ZIP arxiv emas. Faqat .zip zaxira faylini yuklang."]);
  }

  const manifestRaw = await readZipText(zip, MANIFEST_PATH);
  if (!manifestRaw) errors.push("manifest.json topilmadi — bu to‘liq SALEC zaxira emas.");

  let manifest: Record<string, unknown> | null = null;
  let formatVersion: number | null = null;
  if (manifestRaw) {
    try {
      manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
      formatVersion = Number(manifest.format_version);
      if (manifest.kind !== BACKUP_KIND) {
        errors.push("Bu SALEC zaxira arxivi emas. «To‘liq zaxira yuklab olish» dan olingan ZIP ni tanlang.");
      }
      if (
        formatVersion !== BACKUP_FORMAT_VERSION &&
        formatVersion !== 4 &&
        formatVersion !== 3 &&
        formatVersion !== 2 &&
        formatVersion !== 1
      ) {
        errors.push(
          `Arxiv formati eskirgan yoki noma’lum (versiya: ${String(manifest.format_version)}). Yangi zaxira yuklab oling.`
        );
      }
    } catch {
      errors.push("manifest.json buzilgan — arxivni qayta eksport qiling.");
    }
  }

  const source =
    manifest?.source && typeof manifest.source === "object"
      ? (manifest.source as { tenant_slug?: string; tenant_name?: string })
      : null;

  const manifestModules = Array.isArray(manifest?.modules)
    ? (manifest.modules as ParsedBackupPreview["modules"])
    : [];
  const byId = new Map(manifestModules.map((m) => [m.id, m]));
  // Eski arxivlarda ham yangi bo‘limlar (profile, initial_setup) checkboxda ko‘rinsin.
  const modules: ParsedBackupPreview["modules"] = MIGRATION_MODULES.map((def) => {
    const fromManifest = byId.get(def.id);
    return {
      id: def.id,
      label_uz: fromManifest?.label_uz ?? def.label_uz,
      label_ru: fromManifest?.label_ru ?? def.label_ru,
      phase: fromManifest?.phase ?? def.phase,
      counts: fromManifest?.counts ?? {},
      export_status: fromManifest?.export_status ?? def.export_status,
      import_status: fromManifest?.import_status ?? def.import_status
    };
  });

  const has_profile = Boolean(zip.file(PROFILE_JSON_PATH));
  const has_initial_setup_xlsx = Boolean(zip.file(INITIAL_SETUP_XLSX_PATH));
  const has_reference_json = Boolean(zip.file("data/clients.json") && zip.file("data/users.json"));
  const has_transactional_json = Boolean(zip.file("data/orders.json"));
  const has_field_activity_json = Boolean(
    zip.file("data/client_refusals.json") ||
      zip.file("data/agent_visits.json") ||
      zip.file("data/expenses.json")
  );
  if (!has_profile) {
    errors.push("Kompaniya profili topilmadi (tenant-profile.json). Arxiv to‘liq emas.");
  } else {
    const profileRaw = await readZipText(zip, PROFILE_JSON_PATH);
    if (profileRaw) {
      try {
        JSON.parse(profileRaw);
      } catch {
        errors.push("Kompaniya profili buzilgan (JSON). Arxivni qayta eksport qiling.");
      }
    }
  }

  const { empty, blockers } = await isTargetTenantEmptyForImport(targetTenantId);

  return {
    valid: errors.length === 0,
    errors,
    manifest,
    source,
    modules,
    has_profile,
    has_initial_setup_xlsx,
    has_reference_json,
    has_transactional_json,
    has_field_activity_json,
    format_version: formatVersion,
    target_empty: empty,
    target_blockers: blockers
  };
}
