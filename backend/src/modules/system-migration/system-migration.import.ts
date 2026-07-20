import JSZip from "jszip";
import {
  aggregateMigrationWarnings,
  BACKUP_FORMAT_VERSION,
  INITIAL_SETUP_XLSX_PATH,
  PROFILE_JSON_PATH,
  resolveImportSelection,
  type MigrationConflictPolicy
} from "./system-migration.constants";
import { importBonusPlansTables } from "./system-migration.import.bonus-plans";
import { importReferenceTables } from "./system-migration.import.references";
import { importTransactionalTables } from "./system-migration.import.transactional";
import { importExtendedPhases } from "./system-migration.extended.import";
import { emptyIdMaps } from "./system-migration.id-maps";
import {
  parseBackupZip,
  type ParsedBackupPreview
} from "./system-migration.import.preview";
import type { MigrationImportStageId } from "./system-migration.progress";
import { prisma } from "../../config/database";
import { patchTenantProfile } from "../tenant-settings/tenant-settings.service";
import type { TenantProfileDto } from "../tenant-settings/tenant-settings.types";

export type { ParsedBackupPreview };
export { parseBackupZip };

export type MigrationImportProgressReport = {
  stage: MigrationImportStageId;
  percent: number;
  message: string;
};

export type ApplyBackupProgressFn = (p: MigrationImportProgressReport) => void | Promise<void>;

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

function countTerritoryRoots(refs: TenantProfileDto["references"] | undefined): number {
  const nodes = refs?.territory_nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

/** Bo‘sh/zaif profil backup orqali jonli spravochnikni o‘chirmasin. */
async function assertBackupProfileNotThin(targetTenantId: number, profile: TenantProfileDto): Promise<void> {
  const row = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: { settings: true }
  });
  const prevRef =
    row?.settings != null && typeof row.settings === "object" && !Array.isArray(row.settings)
      ? ((row.settings as Record<string, unknown>).references as Record<string, unknown> | undefined)
      : undefined;
  const nextRef = (profile.references ?? {}) as Record<string, unknown>;

  const prevNodes = prevRef?.territory_nodes;
  const prevLen = Array.isArray(prevNodes) ? prevNodes.length : 0;
  const nextLen = countTerritoryRoots(profile.references);
  if (prevLen > 0 && nextLen === 0) {
    throw new Error(
      "THIN_PROFILE_BACKUP:Backup dagi territory_nodes bo‘sh — mavjud territoriya o‘chib ketmasin. force yoki to‘liq backup kerak."
    );
  }

  const catalogKeys = [
    "unit_measures",
    "branches",
    "currency_entries",
    "payment_method_entries",
    "price_type_entries",
    "client_format_entries",
    "client_type_entries",
    "client_category_entries",
    "payment_types",
    "regions"
  ] as const;
  for (const key of catalogKeys) {
    const prev = prevRef?.[key];
    const next = nextRef[key];
    const prevN = Array.isArray(prev) ? prev.length : 0;
    const nextN = Array.isArray(next) ? next.length : 0;
    if (prevN > 0 && nextN === 0) {
      throw new Error(
        `THIN_PROFILE_BACKUP:Backup dagi ${key} bo‘sh — mavjud spravochnik o‘chib ketmasin. force yoki to‘liq backup kerak.`
      );
    }
  }
}

export async function applyBackupZip(
  buf: Buffer,
  targetTenantId: number,
  opts: {
    force_nonempty?: boolean;
    actorUserId?: number | null;
    mode?: ApplyBackupMode;
    conflict_policy?: MigrationConflictPolicy;
    modules?: string[];
    onProgress?: ApplyBackupProgressFn;
  }
): Promise<ApplyBackupResult> {
  const mode = opts.mode ?? "full";
  const conflictPolicy: MigrationConflictPolicy = opts.conflict_policy === "replace" ? "replace" : "keep";
  const selection = resolveImportSelection(opts.modules);
  const stages = selection.stages;
  const report = async (stage: MigrationImportStageId, percent: number, message: string) => {
    await opts.onProgress?.({ stage, percent, message });
  };

  await report("validate", 5, "Arxiv tekshirilmoqda…");
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

  let profileDto: TenantProfileDto;
  try {
    profileDto = JSON.parse(profileRaw) as TenantProfileDto;
  } catch {
    throw new Error(
      "INVALID_BACKUP:Kompaniya profili buzilgan (JSON). Arxivni qayta eksport qiling."
    );
  }

  const applied: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const next_steps: string[] = [];

  const finish = (result: ApplyBackupResult): ApplyBackupResult => ({
    ...result,
    warnings: aggregateMigrationWarnings(result.warnings)
  });

  if (selection.applyProfile || mode === "profile_only" || stages.has("initial_setup")) {
    await report("profile", 15, "Profil va boshlang‘ich sozlamalar…");
    await assertBackupProfileNotThin(targetTenantId, profileDto);
    await patchTenantProfile(targetTenantId, profilePatchFromBackup(profileDto), opts.actorUserId ?? null);
    applied.push("spravochniki/tenant-profile.json");
    if (preview.has_initial_setup_xlsx && (stages.has("initial_setup") || mode === "profile_only")) {
      // Excel arxivda — ma’lumotlar profile.references + JSON orqali qo‘llanadi.
      applied.push(INITIAL_SETUP_XLSX_PATH);
    }
  } else {
    skipped.push("kompaniya profili (bo‘lim tanlanmagan)");
  }

  if (mode === "profile_only") {
    if (preview.has_reference_json || preview.has_transactional_json) {
      skipped.push("reference va transactional JSON (profile_only rejimi)");
    }
    if (preview.has_initial_setup_xlsx) {
      next_steps.push(
        "To‘liq migratsiya uchun «To‘liq import» va «Boshlang‘ich sozlamalar» bo‘limini tanlang."
      );
    }
    await report("done", 100, "Profil qo‘llandi");
    return finish({ applied, skipped, warnings, next_steps });
  }

  if (!preview.has_reference_json && !stages.has("initial_setup")) {
    warnings.push(
      "Arxivda reference JSON yo‘q (format v1). Faqat profil qo‘llandi — yangi eksport oling (format v2)."
    );
    await report("done", 100, "Faqat profil qo‘llandi");
    return finish({ applied, skipped, warnings, next_steps });
  }

  let refResult: Awaited<ReturnType<typeof importReferenceTables>> | null = null;

  if (stages.has("references")) {
    await report("references", 35, "Spravochniklar (ombor, user, klient, mahsulot)…");
    refResult = await importReferenceTables(zip, targetTenantId, { conflictPolicy });
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
  } else if (!stages.has("initial_setup")) {
    skipped.push("spravochniklar (bo‘lim tanlanmagan)");
  }

  // Boshlang‘ich sozlamalar: katalog/hudud/narx/slot. «extended» tanlangan bo‘lsa u yerda qoplanadi.
  if (stages.has("initial_setup") && !stages.has("extended")) {
    await report("references", 40, "Boshlang‘ich sozlamalar (katalog, hudud, narx, slot)…");
    const maps = refResult?.maps ?? emptyIdMaps();
    // references allaqachon phase 0 ni olib kelgan bo‘lsa — faqat 1–2.
    const phases = stages.has("references") ? [1, 2] : [0, 1, 2];
    try {
      await prisma.$transaction(
        async (tx) => {
              const extCounts = await importExtendedPhases(
            tx,
            zip,
            targetTenantId,
            maps,
            phases,
            warnings,
            {
              strictFk: false,
              // Bo‘sh tenantda ham seed/RBAC yoki arxiv ichidagi dublikat bo‘lishi mumkin —
              // qisman commit qoldirmaslik uchun har doim dublikatni o‘tkazib yuboramiz.
              skipDuplicateKeys: true,
              conflictPolicy
            }
          );
          for (const [file, count] of Object.entries(extCounts)) {
            if (count > 0) applied.push(`data/${file}.json`);
          }
        },
        { timeout: 180_000 }
      );
      if (preview.has_initial_setup_xlsx && !applied.includes(INITIAL_SETUP_XLSX_PATH)) {
        applied.push(INITIAL_SETUP_XLSX_PATH);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("MAP_MISSING:")) {
        throw new Error(`IMPORT_MAP_ERROR:${e.message.replace("MAP_MISSING:", "")}`);
      }
      throw e;
    }
  } else if (stages.has("initial_setup") && preview.has_initial_setup_xlsx) {
    if (!applied.includes(INITIAL_SETUP_XLSX_PATH)) applied.push(INITIAL_SETUP_XLSX_PATH);
  }

  if (stages.has("bonus")) {
    if (!refResult) {
      skipped.push("bonus/KPI — spravochniklar kerak (avval spravochniklarni tanlang)");
      warnings.push("Bonus/KPI o‘tkazib yuborildi: spravochniklar import qilinmagan.");
    } else {
      try {
        await report("bonus", 50, "Bonus qoidalari va KPI rejalar…");
        await prisma.$transaction(
          async (tx) => {
            const bonusCounts = await importBonusPlansTables(tx, zip, targetTenantId, refResult!.maps);
            if (bonusCounts.bonus_rules) applied.push("data/bonus_rules.json");
            if (bonusCounts.kpi_groups) applied.push("data/kpi_groups.json");
            if (bonusCounts.sales_kpi_plans) applied.push("data/sales_kpi_plans.json");
          },
          { timeout: 180_000 }
        );
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("MAP_MISSING:")) {
          throw new Error(`IMPORT_MAP_ERROR:${e.message.replace("MAP_MISSING:", "")}`);
        }
        throw e;
      }
    }
  } else {
    skipped.push("bonus/KPI (bo‘lim tanlanmagan)");
  }

  if (stages.has("transactional")) {
    if (!preview.has_transactional_json) {
      warnings.push("Operatsion JSON yo‘q — buyurtmalar import qilinmadi.");
    } else if (!refResult) {
      skipped.push("operatsion tarix — spravochniklar kerak");
      warnings.push("Operatsion tarix o‘tkazib yuborildi: spravochniklar import qilinmagan.");
    } else {
      const opsBusy =
        (preview.target_blockers.orders ?? 0) > 0 || (preview.target_blockers.payments ?? 0) > 0;
      if (!preview.target_empty && opts.force_nonempty && opsBusy) {
        skipped.push("operatsion tarix (orders/payments) — maqsadda allaqachon bor");
        warnings.push(
          "Maqsadda buyurtma/to‘lov bor: operatsion tarix import qilinmadi (dublikatdan saqlanish). Spravochniklar merge qilindi."
        );
      } else {
        try {
          await report("transactional", 72, "Buyurtmalar, to‘lovlar, audit…");
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
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("MAP_MISSING:")) {
            throw new Error(`IMPORT_MAP_ERROR:${e.message.replace("MAP_MISSING:", "")}`);
          }
          throw e;
        }
      }
    }
  } else {
    skipped.push("operatsion tarix (bo‘lim tanlanmagan)");
  }

  if (stages.has("extended")) {
    if (!refResult) {
      skipped.push("kengaytirilgan jadvallar — spravochniklar kerak");
      warnings.push("Kengaytirilgan import o‘tkazib yuborildi: spravochniklar import qilinmagan.");
    } else {
      try {
        if ((preview.format_version ?? BACKUP_FORMAT_VERSION) >= 5) {
          await report("extended", 90, "Katalog, RBAC va qo‘shimcha jadvallar…");
          await prisma.$transaction(
            async (tx) => {
              const extCounts = await importExtendedPhases(
                tx,
                zip,
                targetTenantId,
                refResult!.maps,
                [1, 2, 3, 4],
                warnings,
                {
                  strictFk: false,
                  skipDuplicateKeys: true,
                  conflictPolicy
                }
              );
              for (const [file, count] of Object.entries(extCounts)) {
                if (count > 0) applied.push(`data/${file}.json`);
              }
            },
            { timeout: 300_000 }
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
    }
  } else {
    skipped.push("kengaytirilgan jadvallar (bo‘lim tanlanmagan)");
  }

  if (!preview.target_empty && opts.force_nonempty) {
    warnings.push(
      conflictPolicy === "replace"
        ? "Maqsadli tenant bo‘sh emas edi — dublikatlarda arxiv qiymatlari yozildi (almashtirish)."
        : "Maqsadli tenant bo‘sh emas edi — dublikatlarda mavjud yozuvlar saqlandi (eski qoldi)."
    );
  }

  next_steps.push(
    "Import yakunlandi. Tanlangan bo‘limlar va dublikat siyosati bo‘yicha ma’lumotlar qo‘llandi."
  );
  await report("done", 100, "Import yakunlandi");
  return finish({ applied, skipped, warnings, next_steps });
}
