/** Помощник chaqira oladigan GET yo'llar. Kodlar emas, biznes bo'limlari. */
export const ALLOWED = [
  "/dashboard/stats",
  "/dashboard/finance/summary",
  "/reports/sales",
  "/reports/receivables",
  "/reports/product-sales",
  "/reports/agent-orders",
  "/reports/order-trends",
  "/reports/income-report",
  "/reports/cash-flow",
  "/reports/client-sales-2",
  "/reports/expeditor-returns",
  "/orders",
  "/clients",
  "/users",
  "/agents",
  "/products",
  "/payments",
  "/expenses",
  "/expenses/summary",
  "/expenses/pnl",
  "/cash-desks",
  "/transfers",
  "/stock-takes",
  "/tasks",
  "/payroll/records",
  "/payroll/advances",
  "/payroll/cashier-queue",
  "/work-slots"
];

export function tashkentDay(offset = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Keng savol: boshlang'ich holat — asosiy bo'limlarning joriy ma'lumoti. */
export function isOverviewQuestion(question: string): boolean {
  return /hammasi|barchasi|umumiy|boshlang|obzor|holat|сводк|обзор|всё|все данные|что есть/i.test(question);
}

export function overviewPaths(): string[] {
  const day = tashkentDay(0);
  const from = tashkentDay(-6);
  return [
    "/dashboard/stats",
    `/reports/sales?from=${day}&to=${day}`,
    `/reports/sales?from=${from}&to=${day}`,
    "/reports/receivables?page=1&limit=20",
    "/orders?page=1&limit=10",
    "/payments?page=1&limit=10",
    "/expenses?page=1&limit=10",
    "/expenses/summary",
    "/clients?page=1&limit=10",
    "/cash-desks"
  ];
}

export function assistantGuide(today: string): string {
  const week = tashkentDay(-6);
  return [
    "Sen SalesArena (SALEC) savdo tizimining yordamchisisan.",
    "Faqat shu diler ma'lumotini o'qiysan. Hech narsa o'zgartirma, faqat GET.",
    "Bugungi sana (Toshkent): " + today + ".",
    "Javob FAQAT JSON: {\"calls\":[{\"path\":\"/orders?page=1&limit=15\"}]}.",
    "Savolni to'liq tushun. Bir nechta mavzu bo'lsa, har biriga alohida path. Ko'pi bilan 6 ta.",
    "Sana so'ralsa from va to ni YYYY-MM-DD qilib qo'y. 'shu hafta' = " + week + " dan " + today + " gacha.",
    "Bo'limlar:",
    "bugungi holat=/dashboard/stats",
    "moliya dashbord=/dashboard/finance/summary",
    "savdo=/reports/sales?from=&to=",
    "qarz=/reports/receivables?page=1&limit=30",
    "mahsulot savdosi=/reports/product-sales",
    "agent buyurtmalari=/reports/agent-orders",
    "kirim=/reports/income-report",
    "kassa oqimi=/reports/cash-flow",
    "mijoz savdosi=/reports/client-sales-2",
    "vozvrat=/reports/expeditor-returns",
    "buyurtma=/orders?page=1&limit=15",
    "to'lov=/payments?page=1&limit=15",
    "mijoz=/clients?page=1&limit=15",
    "xodim=/users",
    "agent=/agents",
    "mahsulot=/products?page=1&limit=15",
    "kompaniya rasxodi=/expenses?page=1&limit=20",
    "rasxod jami=/expenses/summary",
    "foyda=/expenses/pnl",
    "kassa=/cash-desks",
    "ombor ko'chirish=/transfers",
    "invent=/stock-takes",
    "vazifa=/tasks",
    "ish haqi=/payroll/records",
    "avans=/payroll/advances",
    "kassir navbati=/payroll/cashier-queue",
    "ish o'rinlari=/work-slots",
    "Noma'lum bo'lsa eng yaqin 2 ta bo'limni tanla. Boshqa matn yozma."
  ].join(" ");
}

export function sanitizeCalls(paths: string[]): string[] {
  const out: string[] = [];
  for (const raw of paths) {
    const path = raw.trim();
    if (!path.startsWith("/") || path.includes("..") || path.includes("://")) continue;
    const only = path.split("?")[0] || "";
    const ok = ALLOWED.some((prefix) => only === prefix || only.startsWith(`${prefix}/`));
    if (!ok || out.includes(path)) continue;
    out.push(path);
    if (out.length >= 6) break;
  }
  return out;
}
