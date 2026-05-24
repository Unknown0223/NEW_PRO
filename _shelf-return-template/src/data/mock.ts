import type {
  Customer,
  Agent,
  Warehouse,
  TradeDirection,
  DiscountType,
  Product,
} from "../types/refund";

export const CUSTOMERS: Customer[] = [
  { id: 101, name: "ООО «Баракат Трейд»", phone: "+998 90 123 45 67", address: "ул. Буюк Ипак Йули 15", region: "Тошкент" },
  { id: 102, name: "ИП Каримов А.", phone: "+998 91 234 56 78", address: "ул. Навоий 42", region: "Самарқанд" },
  { id: 103, name: "Супермаркет «Оила»", phone: "+998 93 345 67 89", address: "ул. Чилонзор 9-кв", region: "Тошкент" },
  { id: 104, name: "Магазин «Шаҳзода»", phone: "+998 94 456 78 90", address: "ул. Беруний 12", region: "Бухоро" },
  { id: 105, name: "ООО «Фаровон Савдо»", phone: "+998 95 567 89 01", address: "ул. Мустақиллик 78", region: "Фарғона" },
  { id: 106, name: "ИП Рахмонова Д.", phone: "+998 97 678 90 12", address: "ул. Амир Темур 5", region: "Наманган" },
  { id: 107, name: "Минимаркет «Дўстлик»", phone: "+998 90 789 01 23", address: "ул. Юнусобод 3", region: "Тошкент" },
  { id: 108, name: "ООО «Юлдуз Маркет»", phone: "+998 91 890 12 34", address: "ул. Каттақўрғон 22", region: "Самарқанд" },
  { id: 109, name: "ИП Тошматов Р.", phone: "+998 93 901 23 45", address: "ул. Андижон 14", region: "Андижон" },
  { id: 110, name: "Торговый дом «Ассалом»", phone: "+998 94 012 34 56", address: "ул. Нукус 31", region: "Қорақалпоғистон" },
];

export const AGENTS: Agent[] = [
  { id: 1, name: "Азизов Жасур" },
  { id: 2, name: "Тошпўлатов Ботир" },
  { id: 3, name: "Каримова Дилноза" },
  { id: 4, name: "Собиров Олим" },
];

export const WAREHOUSES: Warehouse[] = [
  { id: 1, name: "Тошкент марказий омбор" },
  { id: 2, name: "Самарқанд филиал" },
  { id: 3, name: "Фарғона филиал" },
  { id: 4, name: "Бухоро филиал" },
];

export const TRADE_DIRECTIONS: TradeDirection[] = [
  { id: 1, name: "Оптом" },
  { id: 2, name: "В розницу" },
  { id: 3, name: "Дистрибьютор" },
  { id: 4, name: "HoReCa" },
];

export const DISCOUNT_TYPES: DiscountType[] = [
  { id: 1, name: "Без скидки" },
  { id: 2, name: "Скидка 3%" },
  { id: 3, name: "Скидка 5%" },
  { id: 4, name: "Скидка 10%" },
  { id: 5, name: "VIP клиент" },
];

export const PRICE_TYPES: { key: "OLD" | "BONUS" | "NAQD" | "TERMINAL" | "PERECHISLENIYE"; label: string }[] = [
  { key: "OLD", label: "Старые цены" },
  { key: "BONUS", label: "Bonus narx" },
  { key: "NAQD", label: "NAQD PUL" },
  { key: "TERMINAL", label: "TERMINAL" },
  { key: "PERECHISLENIYE", label: "PERECHISLENIYE" },
];

export const COMPOSITIONS = [
  "Mini Lipuchka GG",
  "Monno bolalar gigiyena",
  "Monno trusik mega",
  "Monno classic",
  "Lalaku sensitive",
  "Yoyoki ultra",
  "Sof premium",
  "Sahara soft",
];

export const PRODUCTS: Product[] = [
  // Monno
  { id: 1001, name: "Monno Kids 4-9 кг (24 sht)", barcode: "4700001001", category: "Monno", composition: "Monno bolalar gigiyena", unitVolume: 0.045, unit: "quti", prices: { OLD: 78000, BONUS: 76000, NAQD: 79000, TERMINAL: 80500, PERECHISLENIYE: 82000 } },
  { id: 1002, name: "Monno Kids 9-14 кг (20 sht)", barcode: "4700001002", category: "Monno", composition: "Monno bolalar gigiyena", unitVolume: 0.05, unit: "quti", prices: { OLD: 92000, BONUS: 89000, NAQD: 93000, TERMINAL: 94500, PERECHISLENIYE: 96000 } },
  { id: 1003, name: "Monno Trusik Mega XL (16 sht)", barcode: "4700001003", category: "Monno", composition: "Monno trusik mega", unitVolume: 0.06, unit: "quti", prices: { OLD: 105000, BONUS: 102000, NAQD: 106000, TERMINAL: 108000, PERECHISLENIYE: 110000 } },
  { id: 1004, name: "Monno Classic S (30 sht)", barcode: "4700001004", category: "Monno", composition: "Monno classic", unitVolume: 0.07, unit: "quti", prices: { OLD: 125000, BONUS: 120000, NAQD: 127000, TERMINAL: 129000, PERECHISLENIYE: 132000 } },
  // Lalaku
  { id: 1005, name: "Lalaku Sensitive M (24 sht)", barcode: "4700002001", category: "Lalaku", composition: "Lalaku sensitive", unitVolume: 0.04, unit: "quti", prices: { OLD: 68000, BONUS: 65000, NAQD: 69000, TERMINAL: 70500, PERECHISLENIYE: 72000 } },
  { id: 1006, name: "Lalaku Sensitive L (20 sht)", barcode: "4700002002", category: "Lalaku", composition: "Lalaku sensitive", unitVolume: 0.045, unit: "quti", prices: { OLD: 75000, BONUS: 72000, NAQD: 76500, TERMINAL: 78000, PERECHISLENIYE: 79500 } },
  // Yoyoki
  { id: 1007, name: "Yoyoki Ultra Dry S (32 sht)", barcode: "4700003001", category: "Yoyoki", composition: "Yoyoki ultra", unitVolume: 0.06, unit: "quti", prices: { OLD: 88000, BONUS: 85000, NAQD: 89500, TERMINAL: 91000, PERECHISLENIYE: 93000 } },
  { id: 1008, name: "Yoyoki Ultra Dry M (28 sht)", barcode: "4700003002", category: "Yoyoki", composition: "Yoyoki ultra", unitVolume: 0.065, unit: "quti", prices: { OLD: 96000, BONUS: 93000, NAQD: 97500, TERMINAL: 99000, PERECHISLENIYE: 101000 } },
  { id: 1009, name: "Yoyoki Night XL (18 sht)", barcode: "4700003003", category: "Yoyoki", composition: "Yoyoki ultra", unitVolume: 0.055, unit: "quti", prices: { OLD: 110000, BONUS: 107000, NAQD: 112000, TERMINAL: 114000, PERECHISLENIYE: 116000 } },
  // Sof
  { id: 1010, name: "Sof Premium S (26 sht)", barcode: "4700004001", category: "Sof", composition: "Sof premium", unitVolume: 0.04, unit: "quti", prices: { OLD: 72000, BONUS: 69000, NAQD: 73500, TERMINAL: 75000, PERECHISLENIYE: 76500 } },
  { id: 1011, name: "Sof Premium M (22 sht)", barcode: "4700004002", category: "Sof", composition: "Sof premium", unitVolume: 0.045, unit: "quti", prices: { OLD: 81000, BONUS: 78000, NAQD: 82500, TERMINAL: 84000, PERECHISLENIYE: 85500 } },
  { id: 1012, name: "Sof Premium L (18 sht)", barcode: "4700004003", category: "Sof", composition: "Sof premium", unitVolume: 0.05, unit: "quti", prices: { OLD: 89000, BONUS: 86000, NAQD: 90500, TERMINAL: 92000, PERECHISLENIYE: 94000 } },
  // Sahara
  { id: 1013, name: "Sahara Soft M (24 sht)", barcode: "4700005001", category: "Sahara", composition: "Sahara soft", unitVolume: 0.05, unit: "quti", prices: { OLD: 94000, BONUS: 91000, NAQD: 95500, TERMINAL: 97000, PERECHISLENIYE: 99000 } },
  { id: 1014, name: "Sahara Soft L (20 sht)", barcode: "4700005002", category: "Sahara", composition: "Sahara soft", unitVolume: 0.055, unit: "quti", prices: { OLD: 102000, BONUS: 99000, NAQD: 104000, TERMINAL: 106000, PERECHISLENIYE: 108000 } },
  { id: 1015, name: "Sahara Soft XL (16 sht)", barcode: "4700005003", category: "Sahara", composition: "Sahara soft", unitVolume: 0.06, unit: "quti", prices: { OLD: 115000, BONUS: 112000, NAQD: 117000, TERMINAL: 119000, PERECHISLENIYE: 121000 } },
  // Mini Lipuchka
  { id: 1016, name: "Mini Lipuchka GG S (40 sht)", barcode: "4700006001", category: "Monno", composition: "Mini Lipuchka GG", unitVolume: 0.07, unit: "quti", prices: { OLD: 135000, BONUS: 132000, NAQD: 137000, TERMINAL: 139000, PERECHISLENIYE: 142000 } },
  { id: 1017, name: "Mini Lipuchka GG M (34 sht)", barcode: "4700006002", category: "Monno", composition: "Mini Lipuchka GG", unitVolume: 0.075, unit: "quti", prices: { OLD: 145000, BONUS: 142000, NAQD: 147000, TERMINAL: 149000, PERECHISLENIYE: 152000 } },
];

export const SIDEBAR_MENU = [
  { key: "dashboard", label: "Дашборды", icon: "grid" },
  {
    key: "requests",
    label: "Заявки",
    icon: "inbox",
    children: [
      { key: "create-order", label: "Создать заказ" },
      { key: "create-refund", label: "Создать возврат с полки", active: true },
      { key: "create-refund-by-order", label: "Создать возврат с полки по заказу" },
    ],
  },
  {
    key: "orders",
    label: "Управление заказами",
    icon: "package",
    children: [
      { key: "applications", label: "Заявки" },
      { key: "refusals", label: "Отказы" },
      { key: "offers", label: "Предложение для создания заказа" },
      { key: "automation", label: "Автоматизация заявок" },
    ],
  },
  { key: "customers", label: "Клиенты", icon: "users" },
  { key: "invoices", label: "Накладные", icon: "file-text" },
  { key: "cashier", label: "Касса", icon: "wallet" },
  { key: "warehouse", label: "Склад", icon: "archive" },
  { key: "suppliers", label: "Поставщики", icon: "truck" },
  { key: "plans", label: "Планы", icon: "target" },
  { key: "reports", label: "Отчёт", icon: "chart" },
  { key: "pivot", label: "Pivot отчеты", icon: "table" },
  { key: "users", label: "Пользователи", icon: "user-cog" },
  { key: "audit", label: "Аудит", icon: "shield" },
  { key: "access", label: "Доступ", icon: "lock" },
  { key: "settings", label: "Настройки", icon: "settings" },
  { key: "gps", label: "GPS", icon: "map" },
] as const;
