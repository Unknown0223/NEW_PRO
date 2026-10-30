import type { PermissionSectionDef } from "./permission-model";

export const TABEL_GROUP_RU = "Табель и посещаемость";

/**
 * «Табель и посещаемость» bo'limi ruxsatlari.
 * Mavjud `staff.tabel`, `staff.rabochie_dni`, `staff.tabel_normativ` va `audit.tabel`
 * kalitlari buzilmagan holda Access («Доступ») daraxtida bitta guruhga yig'iladi.
 */
export const TABEL_PERMISSION_SECTIONS: PermissionSectionDef[] = [
  {
    module: "staff",
    section: "tabel",
    labelRu: "Табель (посещаемость)",
    actions: ["view", "update", "export", "history"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "otmetki",
    labelRu: "Журнал отметок и нарушения",
    actions: ["view", "update", "approve", "export"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "staff",
    section: "rabochie_dni",
    labelRu: "Рабочие дни (график)",
    actions: ["view", "update", "create", "delete", "status", "history"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "smeny",
    labelRu: "Смены и часы работы",
    actions: ["view", "create", "update", "delete"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "staff",
    section: "tabel_normativ",
    labelRu: "Табель · Норматив агентов",
    actions: ["view", "update"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "zayavki",
    labelRu: "Заявки на отпуск, больничный и сверхурочные",
    actions: ["view", "create", "approve", "delete"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "obhodnye",
    labelRu: "Обходные листы (увольнение)",
    actions: ["view", "create", "update", "approve"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "statistika",
    labelRu: "Статистика посещаемости",
    actions: ["view", "export"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "mobilnaya_otmetka",
    labelRu: "Мобильная отметка (фото / видео / киоск)",
    actions: ["view", "create"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "tabel",
    section: "ustroystva",
    labelRu: "Терминалы Face ID и киоск",
    actions: ["view", "create", "update", "assign"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "settings",
    section: "tabel_pravila",
    labelRu: "Настройки табеля, Face ID и анти-фрода",
    actions: ["view", "update"],
    groupRu: TABEL_GROUP_RU
  },
  {
    module: "audit",
    section: "tabel",
    labelRu: "Аудит табеля и рабочих дней",
    actions: ["view"],
    groupRu: TABEL_GROUP_RU
  }
];
