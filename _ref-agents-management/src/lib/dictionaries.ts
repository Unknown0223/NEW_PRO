export const BRANCHES = [
  "Sergeli",
  "Andijon",
  "Farg'ona",
  "Jizzah",
  "Qo'qon",
  "Namangan",
  "Nukus",
  "Navoi",
  "Xorazm",
  "Shimkent",
];

export const WAREHOUSES = [
  "Sergeli sklad",
  "Andijon SKLAD",
  "Farg'ona SKLAD",
  "Jizzax SKLAD",
  "Qoqon SKLAD",
  "Namangan SKLAD",
  "Nukus Sklad",
  "Navoiy SKLAD",
  "Xorazm SKLAD",
  "Shimkent SKLAD",
];

export const TRADE_DIRECTIONS = ["GIGA", "UMUMIY", "HORECA", "VANSELLING"];

export const POSITIONS = [
  "Торговый представитель",
  "Супервайзер",
  "Мерчендайзер",
  "Экспедитор",
];

export const AGENT_TYPES = [
  "Торговый представитель",
  "Ван-селлинг агент",
  "Пресейлер",
];

export const PRICE_TYPES = [
  "NAQD PUL",
  "TERMINAL",
  "PERECHISLENIYE",
  "Bonus narx",
  "NAQD Tenge",
  "O'RIKZOR NAQT",
  "RIYAL",
];

export const PRODUCT_GROUPS = [
  "Super anatomik Giga",
  "Anatomic (Lipuchka)",
  "2-SORT",
  "Arzon Lipuchka",
  "Arzon Trusik",
  "Barberry",
  "LLK Anatomic lipuchka N3",
  "LLK Anatomic lipuchka N4",
  "LLK Anatomic lipuchka N5",
  "LLK Anatomic lipuchka N6",
  "Bonus Pack",
  "Giga Soft N4",
];

// Hierarchical catalog: category -> products inside it
export interface ProductCategory {
  name: string;
  items: string[];
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    name: "Super anatomik Giga",
    items: [
      "Super anatomik Giga N3",
      "Super anatomik Giga N4",
      "Super anatomik Giga N5",
      "Super anatomik Giga N6",
    ],
  },
  {
    name: "Anatomic (Lipuchka)",
    items: [
      "LLK Anatomic lipuchka N3",
      "LLK Anatomic lipuchka N4",
      "LLK Anatomic lipuchka N5",
      "LLK Anatomic lipuchka N6",
    ],
  },
  {
    name: "2-SORT",
    items: ["2-Sort"],
  },
  {
    name: "Arzon Lipuchka",
    items: ["Arzon Lipuchka N3", "Arzon Lipuchka N4", "Arzon Lipuchka N5"],
  },
  {
    name: "Arzon Trusik",
    items: ["Arzon Trusik N4", "Arzon Trusik N5", "Arzon Trusik N6"],
  },
  {
    name: "Barberry",
    items: ["Barberry N3", "Barberry N4", "Barberry N5"],
  },
  {
    name: "Bonus Pack",
    items: ["Bonus Pack Standart", "Bonus Pack Maxi"],
  },
  {
    name: "Giga Soft",
    items: ["Giga Soft N3", "Giga Soft N4", "Giga Soft N5"],
  },
];
