export const BACKUP_FORMAT_VERSION = 5 as const;
export const BACKUP_KIND = "salec-tenant-backup" as const;
export const BACKUP_FILE_EXTENSION = ".salec-backup.zip" as const;

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
    id: "spravochniki",
    label_uz: "Spravochniklar va boshlang‘ich ma’lumotlar",
    label_ru: "Справочники и начальные данные",
    phase: 1,
    export_status: "included",
    import_status: "included",
    import_note_uz: "Profil, mijozlar, mahsulotlar va operatsion tarix to‘liq import."
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
