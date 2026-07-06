import JSZip from "jszip";
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_KIND,
  INITIAL_SETUP_XLSX_PATH,
  MANIFEST_PATH,
  PROFILE_JSON_PATH
} from "./system-migration.constants";
import { isTargetTenantEmptyForImport } from "./system-migration.inventory";
import { importBonusPlansTables } from "./system-migration.import.bonus-plans";
import { importReferenceTables } from "./system-migration.import.references";
import { importTransactionalTables } from "./system-migration.import.transactional";
import { importExtendedPhases } from "./system-migration.extended.import";
import { prisma } from "../../config/database";
import { patchTenantProfile } from "../tenant-settings/tenant-settings.service";
import type { TenantProfileDto } from "../tenant-settings/tenant-settings.types";

export type ParsedBackupPreview = {
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

export type ApplyBackupResult = {
  applied: string[];
  skipped: string[];
  warnings: string[];
  next_steps: string[];
};

export type ApplyBackupMode = "full" | "profile_only";

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
    return emptyPreview(["Fayl yaroqli ZIP arxiv emas"]);
  }

  const manifestRaw = await readZipText(zip, MANIFEST_PATH);
  if (!manifestRaw) errors.push("manifest.json topilmadi");

  let manifest: Record<string, unknown> | null = null;
  let formatVersion: number | null = null;
  if (manifestRaw) {
    try {
      manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
      formatVersion = Number(manifest.format_version);
      if (manifest.kind !== BACKUP_KIND) errors.push("Noto‘g‘ri arxiv turi (kind)");
      if (formatVersion !== BACKUP_FORMAT_VERSION && formatVersion !== 4 && formatVersion !== 3 && formatVersion !== 2 && formatVersion !== 1) {
        errors.push(`Format versiyasi mos emas (kutilgan: ${BACKUP_FORMAT_VERSION} … 1)`);
      }
    } catch {
      errors.push("manifest.json o‘qib bo‘lmadi");
    }
  }

  const source =
    manifest?.source && typeof manifest.source === "object"
      ? (manifest.source as { tenant_slug?: string; tenant_name?: string })
      : null;

  const modules = Array.isArray(manifest?.modules)
    ? (manifest.modules as ParsedBackupPreview["modules"])
    : [];

  const has_profile = Boolean(zip.file(PROFILE_JSON_PATH));
  const has_initial_setup_xlsx = Boolean(zip.file(INITIAL_SETUP_XLSX_PATH));
  const has_reference_json = Boolean(
    zip.file("data/clients.json") && zip.file("data/users.json")
  );
  const has_transactional_json = Boolean(zip.file("data/orders.json"));
  const has_field_activity_json = Boolean(
    zip.file("data/client_refusals.json") ||
      zip.file("data/agent_visits.json") ||
      zip.file("data/expenses.json")
  );
  if (!has_profile) errors.push("spravochniki/tenant-profile.json topilmadi");

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

function profilePatchFromBackup(profile: TenantProfileDto) {
  return {
    name: profile.name,
    phone: profile.phone,
    address: profile.address,
    logo_url: profile.logo_url,
    feature_flags: profile.feature_flags,
    return_filter: profile.return_filter,
    references: profile.references
  };
}

export async function applyBackupZip(
  buf: Buffer,
  targetTenantId: number,
  opts: {
    force_nonempty?: boolean;
    actorUserId?: number | null;
    mode?: ApplyBackupMode;
  }
): Promise<ApplyBackupResult> {
  const mode = opts.mode ?? "full";
  const preview = await parseBackupZip(buf, targetTenantId);
  if (!preview.valid) {
    throw new Error(`INVALID_BACKUP:${preview.errors.join("; ")}`);
  }
  if (!preview.target_empty && !opts.force_nonempty) {
    throw new Error("TARGET_NOT_EMPTY");
  }

  const zip = await JSZip.loadAsync(buf);
  const profileRaw = await readZipText(zip, PROFILE_JSON_PATH);
  if (!profileRaw) throw new Error("PROFILE_MISSING");

  const profile = JSON.parse(profileRaw) as TenantProfileDto;
  await patchTenantProfile(targetTenantId, profilePatchFromBackup(profile), opts.actorUserId ?? null);

  const applied = ["spravochniki/tenant-profile.json"];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const next_steps: string[] = [];

  if (mode === "profile_only") {
    if (preview.has_reference_json || preview.has_transactional_json) {
      skipped.push("reference va transactional JSON (profile_only rejimi)");
    }
    if (preview.has_initial_setup_xlsx) {
      next_steps.push(
        "To‘liq migratsiya uchun «To‘liq import» rejimini tanlang yoki initial-setup.xlsx ni qo‘lda import qiling."
      );
    }
    return { applied, skipped, warnings, next_steps };
  }

  if (!preview.has_reference_json) {
    warnings.push(
      "Arxivda reference JSON yo‘q (format v1). Faqat profil qo‘llandi — yangi eksport oling (format v2)."
    );
    if (preview.has_initial_setup_xlsx) {
      next_steps.push("Boshlang‘ich sozlash orqali initial-setup.xlsx import qiling.");
    }
    return { applied, skipped, warnings, next_steps };
  }

  const refResult = await importReferenceTables(zip, targetTenantId);
  applied.push(
    "data/trade_directions.json",
    "data/warehouses.json",
    "data/users.json",
    "data/clients.json",
    "data/products.json",
    "data/cash_desks.json",
    "data/stock.json"
  );
  warnings.push(...refResult.warnings);

  try {
    await prisma.$transaction(
      async (tx) => {
        const bonusCounts = await importBonusPlansTables(tx, zip, targetTenantId, refResult.maps);
        if (bonusCounts.bonus_rules) applied.push("data/bonus_rules.json");
        if (bonusCounts.kpi_groups) applied.push("data/kpi_groups.json");
        if (bonusCounts.sales_kpi_plans) applied.push("data/sales_kpi_plans.json");
      },
      { timeout: 120_000 }
    );
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("MAP_MISSING:")) {
      throw new Error(`IMPORT_MAP_ERROR:${e.message.replace("MAP_MISSING:", "")}`);
    }
    throw e;
  }

  if (!preview.has_transactional_json) {
    warnings.push("Operatsion JSON yo‘q — buyurtmalar import qilinmadi.");
    next_steps.push("Import yakunlandi (spravochniklar + bonus/rejalar).");
    return { applied, skipped, warnings, next_steps };
  }

  try {
    const txResult = await importTransactionalTables(zip, targetTenantId, refResult.maps);
    applied.push(
      "data/orders.json",
      "data/order_items.json",
      "data/payments.json",
      "data/goods_receipts.json",
      "data/sales_returns.json",
      "data/tenant_audit_events.json",
      "data/client_refusals.json",
      "data/agent_visits.json",
      "data/expenses.json",
      "data/client_photo_reports.json"
    );
    warnings.push(...txResult.warnings);

    if ((preview.format_version ?? BACKUP_FORMAT_VERSION) >= 5) {
      await prisma.$transaction(
        async (tx) => {
          const extCounts = await importExtendedPhases(
            tx,
            zip,
            targetTenantId,
            refResult.maps,
            [1, 2, 3, 4],
            warnings
          );
          for (const [file, count] of Object.entries(extCounts)) {
            if (count > 0) applied.push(`data/${file}.json`);
          }
        },
        { timeout: 180_000 }
      );
    } else if ((preview.format_version ?? 0) >= 4) {
      warnings.push(
        "Format v4 — katalog, RBAC va qo‘shimcha jadvallar arxivda yo‘q. To‘liq zaxira uchun v5 eksport oling."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("MAP_MISSING:")) {
      throw new Error(`IMPORT_MAP_ERROR:${e.message.replace("MAP_MISSING:", "")}`);
    }
    throw e;
  }

  if (!preview.target_empty && opts.force_nonempty) {
    warnings.push("Maqsadli tenant bo‘sh emas edi — import xavfli rejimda bajarildi.");
  }

  next_steps.push(
    "Import yakunlandi. To‘liq tarix, bonus qoidalari, KPI rejalar, katalog bog‘lanishlari va qo‘shimcha jadvallar tiklandi."
  );
  return { applied, skipped, warnings, next_steps };
}
