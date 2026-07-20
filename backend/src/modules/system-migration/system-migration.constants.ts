export const BACKUP_FORMAT_VERSION = 5 as const;
export const BACKUP_KIND = "salec-tenant-backup" as const;
export const BACKUP_FILE_EXTENSION = ".zip" as const;

export type MigrationModulePhase = 1 | 2 | 3 | 4;
export type MigrationModuleExportStatus = "included" | "planned";
export type MigrationModuleImportStatus = "included" | "partial" | "planned";

export type MigrationModuleDef = {
  id: string;
  label_uz: string;
  label_ru: string;
  phase: MigrationModulePhase;
  export_status: MigrationModuleExportStatus;
  import_status: MigrationModuleImportStatus;
  import_note_uz?: string;
};

/** Katalog — UI va manifest uchun (eksport/import qamrovi bosqichma-bosqich kengayadi). */
export const MIGRATION_MODULES: MigrationModuleDef[] = [
  {
    id: "profile",
    label_uz: "Kompaniya profili",
    label_ru: "Профиль компании",
    phase: 1,
    export_status: "included",
    import_status: "included",
    import_note_uz: "Nom, telefon, manzil, feature flag va return filter."
  },
  {
    id: "initial_setup",
    label_uz: "Boshlang‘ich sozlamalar",
    label_ru: "Начальные настройки",
    phase: 1,
    export_status: "included",
    import_status: "included",
    import_note_uz:
      "Birliklar, valyuta, to‘lov usullari, narx turlari, mijoz spravochniklari, hudud, kategoriyalar, narxlar, slotlar (Excel + JSON)."
  },
  {
    id: "spravochniki",
    label_uz: "Asosiy spravochniklar (mijoz, mahsulot, user, ombor)",
    label_ru: "Основные справочники (клиент, товар, user, склад)",
    phase: 1,
    export_status: "included",
    import_status: "included",
    import_note_uz: "Mijozlar, mahsulotlar, foydalanuvchilar, omborlar va qoldiqlar."
  },
  {
    id: "orders",
    label_uz: "Buyurtmalar va pozitsiyalar",
    label_ru: "Заказы и позиции",
    phase: 2,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "payments",
    label_uz: "To‘lovlar",
    label_ru: "Платежи",
    phase: 2,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "warehouse",
    label_uz: "Ombor kirimlari va qoldiqlar",
    label_ru: "Поступления и склад",
    phase: 2,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "returns",
    label_uz: "Qaytarishlar",
    label_ru: "Возвраты",
    phase: 2,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "audit",
    label_uz: "Audit va o‘zgarishlar tarixi",
    label_ru: "Аудит и история изменений",
    phase: 2,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "refusals",
    label_uz: "Rad etishlar (refusals)",
    label_ru: "Отказы",
    phase: 3,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "visits",
    label_uz: "Tashriflar va agent faoliyati",
    label_ru: "Визиты и активность агентов",
    phase: 3,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "expenses",
    label_uz: "Xarajatlar va to‘lov taqsimoti",
    label_ru: "Расходы и распределение платежей",
    phase: 3,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "bonus_plans",
    label_uz: "Bonus, KPI va rejalar",
    label_ru: "Бонусы, KPI и планы",
    phase: 4,
    export_status: "included",
    import_status: "included"
  },
  {
    id: "files",
    label_uz: "Fayllar va rasmlar",
    label_ru: "Файлы и изображения",
    phase: 4,
    export_status: "included",
    import_status: "included",
    import_note_uz: "Mijoz foto hisobotlari (data URI) arxivda."
  },
  {
    id: "extended",
    label_uz: "Katalog, RBAC, bog‘lanishlar va qo‘shimcha tarix",
    label_ru: "Каталог, RBAC, связи и доп. история",
    phase: 4,
    export_status: "included",
    import_status: "included",
    import_note_uz:
      "Mahsulot katalogi, narxlar, hududlar, rollar, kassa/ombor bog‘lanishlari, balans harakatlari va boshqalar."
  }
];

export const MANIFEST_PATH = "manifest.json";
export const PROFILE_JSON_PATH = "spravochniki/tenant-profile.json";
export const INITIAL_SETUP_XLSX_PATH = "spravochniki/initial-setup.xlsx";

export type MigrationConflictPolicy = "keep" | "replace";

export const MIGRATION_PHASE_LABELS_UZ: Record<MigrationModulePhase, string> = {
  1: "Profil va boshlang‘ich sozlamalar",
  2: "Operatsion (buyurtma, to‘lov, ombor)",
  3: "Agent faoliyati",
  4: "KPI, fayllar va kengaytirilgan"
};

/** Bo‘lim id → import bosqichi. */
export type MigrationImportStageFlag =
  | "references"
  | "bonus"
  | "transactional"
  | "extended"
  | "initial_setup";

const MODULE_STAGE: Record<string, MigrationImportStageFlag> = {
  initial_setup: "initial_setup",
  spravochniki: "references",
  orders: "transactional",
  payments: "transactional",
  warehouse: "transactional",
  returns: "transactional",
  audit: "transactional",
  refusals: "transactional",
  visits: "transactional",
  expenses: "transactional",
  bonus_plans: "bonus",
  files: "extended",
  extended: "extended"
};

export type ResolvedImportSelection = {
  applyProfile: boolean;
  stages: Set<MigrationImportStageFlag>;
};

/** Tanlangan bo‘limlardan import bosqichlari (profile alohida). */
export function resolveImportSelection(
  modules: string[] | undefined | null
): ResolvedImportSelection {
  if (!modules?.length) {
    return {
      applyProfile: true,
      stages: new Set(["initial_setup", "references", "bonus", "transactional", "extended"])
    };
  }
  const selected = new Set(modules.map((m) => String(m).trim()).filter(Boolean));
  const stages = new Set<MigrationImportStageFlag>();
  for (const id of selected) {
    const stage = MODULE_STAGE[id];
    if (stage) stages.add(stage);
  }
  const applyProfile =
    selected.has("profile") ||
    selected.has("initial_setup") ||
    selected.has("spravochniki") ||
    stages.size > 0;

  if (stages.size === 0 && applyProfile) {
    return { applyProfile, stages };
  }
  if (stages.size === 0) {
    return {
      applyProfile: true,
      stages: new Set(["initial_setup", "references", "bonus", "transactional", "extended"])
    };
  }
  return { applyProfile, stages };
}

export function resolveImportStages(
  modules: string[] | undefined | null
): Set<MigrationImportStageFlag> {
  return resolveImportSelection(modules).stages;
}

export function aggregateMigrationWarnings(warnings: string[]): string[] {
  const counts = new Map<string, number>();
  for (const w of warnings) {
    const key = w.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([msg, n]) => (n > 1 ? `${msg} (${n} ta)` : msg));
}
