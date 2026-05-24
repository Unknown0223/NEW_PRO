export const CATEGORIES: string[] = [
  '2-SORT',
  'Anatomic (Lipuchka)',
  'Arzon Lipuchka',
  'Arzon Trusik',
  'Barberry',
  'Bonus',
  'Dielux lipuchka',
  'Dielux trusik',
  "DRY (Qo'ltiq qistirma)",
  'Econom lipuchka',
  'Ejednevka',
  'Giga Eski',
  'Grudnoy',
  'Jonny Eski',
  'Jonny Trusik',
  'Jonny Ultra',
  'Kattalar tagligi (max)',
  'Kattalar tagligi (mini)',
  'Lalaku Devochka',
  'Lalaku ECONOM (trusik )',
  'Lalaku ECONOM (trusik ) 2026',
  'LALAKU GIGA',
  'Lalaku Lipuchka mini Devochka',
  'Lalaku Lipuchka mini Malchik',
  'Lalaku Lipuchka Super mini',
  'Lalaku Malchik',
  'Lalaku premium trusik',
  'Lalaku Super anatomik (trusik)',
  'LALAKU TRUSIK',
  'LALAKU TRUSIK 2026',
  'LALAKU TRUSIK MINI PAK',
  'Lalaku Trusik Super mini',
  'Lalaku Trusiki mini Devochka',
  'Lalaku Trusiki mini Malchik',
  'Lalaku universal trusik',
  'Maska',
  'Mini Lipuchka GG',
  'Monno bolalar gigiyena',
  'Monno lipuchka',
  'Monno lipuchka mega',
  'Monno trusik mega',
  'Monno trusik mini',
  'Muzlatgich',
  'Sof Anatomic (Lipuchka)',
  'Sof ESKI',
  'Sof trusik',
  'Super anatomik Giga',
  'Ultra Giga',
  'Yoyoki lipuchka',
  'Yoyoki trusik',
];

export const PRICE_TYPES = [
  { id: 'bonus', label: 'Bonus narx' },
  { id: 'naqd_pul', label: 'NAQD PUL' },
  { id: 'naqd_tenge', label: 'NAQD Tenge' },
  { id: 'orikzor', label: "O'RIKZOR NAQT" },
  { id: 'perech', label: 'PERECHISLENIYE' },
  { id: 'riyal', label: 'RIYAL' },
  { id: 'terminal', label: 'TERMINAL' },
];

export const CLIENTS = [
  'NODIRBEK-BIBISORA ORZULARI XK',
  'ALISHER SAVDO MCHJ',
  'GULNARA MARKET',
  'TASHKENT TRADE LLC',
  'SAMARKAND OPT BAZA',
];

export const AGENTS = [
  'MONNONV01 - [SHUKUROV MIRALISHER] 19/0...',
  'MONNONV02 - [KARIMOV BEKZOD] 22/0...',
  'MONNONV03 - [TOSHEV ULUGBEK] 14/0...',
];

export const WAREHOUSES = [
  'Navoiy SKLAD',
  'Tashkent CENTRAL SKLAD',
  'Samarkand SKLAD',
  'Bukhara SKLAD',
];

export const DIRECTIONS = ['MONNO', 'LALAKU', 'SOF', 'YOYOKI', 'DIELUX'];

export const DISCOUNTS = ['Без скидки', '5%', '10%', '15%', '20%'];

export type Product = {
  id: string;
  category: string;
  name: string;
  price: number;
  perBlock: number; // pieces per block
  volume: number; // m3 per piece
};

// Generate a realistic catalogue per category
const blockCounts: Record<string, number[]> = {
  'Arzon Lipuchka': [82, 74, 60, 50, 44, 36],
  'Bonus': [40, 30, 20],
  'Dielux trusik': [56, 48, 40],
  "DRY (Qo'ltiq qistirma)": [20, 16, 12],
};

export function generateProducts(): Product[] {
  const out: Product[] = [];
  CATEGORIES.forEach((cat) => {
    const counts = blockCounts[cat] ?? [80, 60, 50, 40, 30];
    const basePrice = 35000 + Math.floor(Math.random() * 60000);
    counts.forEach((c, i) => {
      out.push({
        id: `${cat}-${i + 1}`,
        category: cat,
        name: `${cat} N${i + 1}.(${c})`,
        price: cat === 'Arzon Lipuchka' ? 53000 : basePrice + i * 1500,
        perBlock: c,
        volume: 0.018 + i * 0.002,
      });
    });
    // Add two extra numbered SKUs
    for (let k = counts.length + 1; k <= counts.length + 2; k++) {
      out.push({
        id: `${cat}-${k}`,
        category: cat,
        name: `${cat} № ${k}`,
        price: cat === 'Arzon Lipuchka' ? 53000 : basePrice + k * 1500,
        perBlock: 30,
        volume: 0.02,
      });
    }
  });
  return out;
}

export const formatMoney = (n: number) =>
  n.toLocaleString('ru-RU').replace(/,/g, ' ');
