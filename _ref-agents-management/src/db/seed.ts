import { count } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions } from "@/db/schema";
import { PRICE_TYPES, PRODUCT_GROUPS } from "@/lib/dictionaries";

const BASE_AGENTS: Array<{
  fullname: string;
  firstName: string;
  lastName: string;
  code: string;
  pinfl?: string;
  phone?: string;
  consignation: boolean;
  apkVersion: string;
  deviceName: string;
  lastSync: string;
  login: string;
  priceTypes: string[];
  productCount: number;
  warehouse: string;
  tradeDirection: string;
  branch: string;
  createdAt: string;
  maxSessions: number;
  active?: boolean;
}> = [
  {
    fullname: "01 (ELDAR) GGTSH005 - [VAKANT] (CHILONZOR)",
    firstName: "[VAKANT] (CHILONZOR)",
    lastName: "01 (ELDAR) GGTSH005 -",
    code: "GGTSH005",
    consignation: true,
    apkVersion: "2.0.8",
    deviceName: "Google emulator OS:14",
    lastSync: "2026-06-07T22:07:18",
    login: "tsh3741",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 40,
    warehouse: "Sergeli sklad",
    tradeDirection: "GIGA",
    branch: "Sergeli",
    createdAt: "2024-07-17",
    maxSessions: 2,
  },
  {
    fullname: "01 - GGAN002 - (SH) [IBRAHIMOV MUHAMMADAAMIN] 28/06/26",
    firstName: "[IBRAHIMOV MUHAMMADAAMIN]",
    lastName: "01 - GGAN002 - (SH)",
    code: "GGAN002",
    pinfl: "30309891370014",
    phone: "998972711222",
    consignation: false,
    apkVersion: "2.0.8",
    deviceName: "Xiaomi Redmi Note 14 OS:16",
    lastSync: "2026-07-02T09:47:33",
    login: "an3652",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 43,
    warehouse: "Andijon SKLAD",
    tradeDirection: "GIGA",
    branch: "Andijon",
    createdAt: "2024-08-20",
    maxSessions: 2,
  },
  {
    fullname: "01 - GGFA002 - (D) [TESHABOYEVA MASHXURA] 10/09",
    firstName: "[TESHABOYEVA MASHXURA]",
    lastName: "01 - GGFA002 - (D)",
    code: "GGFA002",
    pinfl: "40903874310043",
    phone: "998907858718",
    consignation: false,
    apkVersion: "2.0.6",
    deviceName: "HONOR HONOR X7a OS:14",
    lastSync: "2026-07-01T17:05:45",
    login: "fa1362",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 45,
    warehouse: "Farg'ona SKLAD",
    tradeDirection: "GIGA",
    branch: "Farg'ona",
    createdAt: "2024-08-19",
    maxSessions: 1,
  },
  {
    fullname: "01 - GGJZ001 - (A) [XUDAYBERDIYEVA DILDORA] 13/04/26",
    firstName: "[XUDAYBERDIYEVA DILDORA]",
    lastName: "01 - GGJZ001 - (A)",
    code: "GGJZ001",
    pinfl: "40212921580048",
    phone: "998771052227",
    consignation: true,
    apkVersion: "2.0.8",
    deviceName: "Xiaomi Redmi Note 14 OS:15",
    lastSync: "2026-07-02T10:19:26",
    login: "jz7112",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 41,
    warehouse: "Jizzax SKLAD",
    tradeDirection: "GIGA",
    branch: "Jizzah",
    createdAt: "2024-08-20",
    maxSessions: 1,
  },
  {
    fullname: "01 -GGKK002- [SHAMSIDDINOV XAMIDJON] (БЕШАРИК) 12/07",
    firstName: "[SHAMSIDDINOV XAMIDJON]",
    lastName: "01 -GGKK002- (БЕШАРИК)",
    code: "GGKK002",
    phone: "998905673311",
    consignation: false,
    apkVersion: "2.0.8",
    deviceName: "HONOR HONOR X9c OS:16",
    lastSync: "2026-07-02T10:15:01",
    login: "q8834",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 46,
    warehouse: "Qoqon SKLAD",
    tradeDirection: "GIGA",
    branch: "Qo'qon",
    createdAt: "2024-08-15",
    maxSessions: 1,
  },
  {
    fullname: "01 - GGNM002 - (S) [ERGASHOV UMAR] 15/01/26",
    firstName: "[ERGASHOV UMAR]",
    lastName: "01 - GGNM002 - (S)",
    code: "GGNM002",
    pinfl: "52204035960057",
    phone: "998938371161",
    consignation: false,
    apkVersion: "2.0.8",
    deviceName: "LGE VELVET OS:13",
    lastSync: "2026-07-01T17:32:06",
    login: "nm63245",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 44,
    warehouse: "Namangan SKLAD",
    tradeDirection: "GIGA",
    branch: "Namangan",
    createdAt: "2024-08-20",
    maxSessions: 1,
  },
  {
    fullname: "01 - GGNS002 - (G) [VAKANT]",
    firstName: "[VAKANT]",
    lastName: "01 - GGNS002 - (G)",
    code: "GGNS002",
    consignation: false,
    apkVersion: "2.0.8",
    deviceName: "HONOR HONOR X6c OS:15",
    lastSync: "2026-06-08T16:16:14",
    login: "ns63147",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 41,
    warehouse: "Nukus Sklad",
    tradeDirection: "GIGA",
    branch: "Nukus",
    createdAt: "2024-08-16",
    maxSessions: 1,
  },
  {
    fullname: "01 - GGNV002 - [KOMILJONOV KOMILJON] 06/08",
    firstName: "[KOMILJONOV KOMILJON]",
    lastName: "01 - GGNV002 -",
    code: "GGNV002",
    phone: "998953849991",
    consignation: true,
    apkVersion: "2.0.8",
    deviceName: "samsung Galaxy A34 5G OS:16",
    lastSync: "2026-07-02T09:46:28",
    login: "nv64178",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 41,
    warehouse: "Navoiy SKLAD",
    tradeDirection: "GIGA",
    branch: "Navoi",
    createdAt: "2024-08-10",
    maxSessions: 1,
  },
  {
    fullname: "01 - GGXM001 [VAKANT]",
    firstName: "[VAKANT]",
    lastName: "01 - GGXM001",
    code: "GGXM001",
    consignation: false,
    apkVersion: "2.0.8",
    deviceName: "samsung Galaxy A16 OS:16",
    lastSync: "2026-06-29T17:03:21",
    login: "ggxm001",
    priceTypes: ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
    productCount: 41,
    warehouse: "Xorazm SKLAD",
    tradeDirection: "GIGA",
    branch: "Xorazm",
    createdAt: "2024-08-16",
    maxSessions: 1,
  },
  {
    fullname: "01 - KZX001 - [SHIMKENT SVR] 08/10",
    firstName: "[SHIMKENT SVR]",
    lastName: "01 - KZX001 -",
    code: "KZX001",
    consignation: false,
    apkVersion: "2.0.8",
    deviceName: "samsung Galaxy A16 OS:16",
    lastSync: "2026-06-23T12:36:56",
    login: "kzx001",
    priceTypes: ["NAQD Tenge"],
    productCount: 284,
    warehouse: "Shimkent SKLAD",
    tradeDirection: "UMUMIY",
    branch: "Shimkent",
    createdAt: "2025-10-08",
    maxSessions: 1,
  },
];

const EXTRA_DEVICES = [
  "samsung Galaxy A54 5G OS:16",
  "Xiaomi Redmi Note 14 Pro+ 5G OS:15",
  "HONOR X8b OS:14",
  "samsung Galaxy A34 OS:15",
  "Vivo Y36 OS:14",
  "Google emulator OS:14",
];

export async function ensureSeeded() {
  const [{ value }] = await db.select({ value: count() }).from(agents);
  if (value > 0) return;

  const rows: (typeof agents.$inferInsert)[] = BASE_AGENTS.map((a) => ({
    fullname: a.fullname,
    firstName: a.firstName,
    lastName: a.lastName,
    middleName: "",
    code: a.code,
    phone: a.phone ?? "",
    pinfl: a.pinfl ?? "",
    agentType: "Торговый представитель",
    productCount: a.productCount,
    consignation: a.consignation,
    apkVersion: a.apkVersion,
    deviceName: a.deviceName,
    lastSync: new Date(a.lastSync),
    login: a.login,
    priceTypes: a.priceTypes,
    products: PRODUCT_GROUPS.slice(0, Math.min(a.productCount, 8)),
    warehouse: a.warehouse,
    tradeDirection: a.tradeDirection,
    branch: a.branch,
    position: "Торговый представитель",
    appAccess: true,
    active: a.active ?? true,
    maxSessions: a.maxSessions,
    createdAt: new Date(a.createdAt),
  }));

  // Generate extra agents so pagination is meaningful
  for (let i = 0; i < 28; i++) {
    const base = BASE_AGENTS[i % BASE_AGENTS.length];
    const idx = i + 1;
    const active = i % 5 !== 4; // every 5th inactive
    rows.push({
      fullname: `02 - ${base.code}X${String(idx).padStart(2, "0")} - [AGENT ${idx}]`,
      firstName: `[AGENT ${idx}]`,
      lastName: `02 - ${base.code}X${String(idx).padStart(2, "0")} -`,
      middleName: "",
      code: `${base.code}X${String(idx).padStart(2, "0")}`,
      phone: `99890${String(1000000 + idx * 3517).slice(0, 7)}`,
      pinfl: i % 2 === 0 ? `4${String(1000000000000 + idx * 7919)}` : "",
      agentType: "Торговый представитель",
      productCount: 30 + (idx % 20),
      consignation: idx % 3 === 0,
      apkVersion: idx % 4 === 0 ? "2.0.6" : "2.0.8",
      deviceName: EXTRA_DEVICES[idx % EXTRA_DEVICES.length],
      lastSync: new Date(Date.now() - idx * 3600_000 * 5),
      login: `${base.login}${idx}`,
      priceTypes:
        idx % 4 === 0
          ? [PRICE_TYPES[0], PRICE_TYPES[2]]
          : ["NAQD PUL", "PERECHISLENIYE", "TERMINAL"],
      products: PRODUCT_GROUPS.slice(0, 6),
      warehouse: base.warehouse,
      tradeDirection: idx % 6 === 0 ? "UMUMIY" : base.tradeDirection,
      branch: base.branch,
      position: "Торговый представитель",
      appAccess: idx % 7 !== 0,
      active,
      maxSessions: idx % 3 === 0 ? 2 : 1,
      createdAt: new Date(Date.now() - idx * 86400_000 * 9),
    });
  }

  const inserted = await db.insert(agents).values(rows).returning({
    id: agents.id,
    maxSessions: agents.maxSessions,
    deviceName: agents.deviceName,
    apkVersion: agents.apkVersion,
    lastSync: agents.lastSync,
  });

  const sessionRows: (typeof agentSessions.$inferInsert)[] = [];
  for (const a of inserted) {
    sessionRows.push({
      agentId: a.id,
      device: a.deviceName || "Unknown device",
      ip: `185.139.${(a.id * 7) % 255}.${(a.id * 13) % 255}`,
      os: `Android (${14 + (a.id % 3)})`,
      appInfo: `Agent/${a.apkVersion} (Android ${14 + (a.id % 3)}; arm64-v8a)`,
      createdAt: a.lastSync ?? new Date(),
    });
    if (a.maxSessions > 1) {
      sessionRows.push({
        agentId: a.id,
        device: "Google emulator OS:14",
        ip: `144.124.${(a.id * 11) % 255}.${(a.id * 17) % 255}`,
        os: "Android (14)",
        appInfo: `Agent/${a.apkVersion} (Android 14; sdk_gphone64_x86_64; x86_64)`,
        createdAt: new Date(Date.now() - 3600_000 * 30),
      });
    }
  }
  await db.insert(agentSessions).values(sessionRows);
}
