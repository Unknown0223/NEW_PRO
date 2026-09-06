/**
 * Hafta kunlari: import / eksport standarti.
 * - Raqam: faqat 1..7 (1=Du … 7=Ya). `0` va boshqa qiymatlar — qabul qilinmaydi (o‘tkazib yuboriladi).
 * - Matn: Пн…Вс / o‘zbek nomlari (du, shanba, …)
 */

/** 1=Du … 7=Ya */
export const VISIT_WEEKDAY_RU_ABBREV = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const VISIT_WEEKDAY_TOKEN_MAP: Record<string, number> = {
  пн: 1,
  pn: 1,
  mon: 1,
  monday: 1,
  понедельник: 1,
  ду: 1,
  du: 1,
  dushanba: 1,
  вт: 2,
  vt: 2,
  tue: 2,
  tues: 2,
  tuesday: 2,
  вторник: 2,
  се: 2,
  se: 2,
  seshanba: 2,
  ср: 3,
  sr: 3,
  wed: 3,
  wednesday: 3,
  среда: 3,
  чо: 3,
  cho: 3,
  chor: 3,
  chorshanba: 3,
  чт: 4,
  ct: 4,
  ch: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  четверг: 4,
  четвер: 4,
  pa: 4,
  pay: 4,
  payshanba: 4,
  пт: 5,
  pt: 5,
  fri: 5,
  friday: 5,
  пятница: 5,
  ju: 5,
  juma: 5,
  сб: 6,
  sb: 6,
  sat: 6,
  saturday: 6,
  суббота: 6,
  sh: 6,
  sha: 6,
  shanba: 6,
  шанба: 6,
  вс: 7,
  vs: 7,
  vos: 7,
  sun: 7,
  sunday: 7,
  воскресенье: 7,
  вск: 7,
  ya: 7,
  yak: 7,
  yakshanba: 7,
  якшанба: 7
};

function normalizeVisitWeekdayToken(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/\u00a0/g, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, "");
}

/** Excel / matn: «Чт,Сб,Пт,Ср» yoki «1,3,6» (faqat 1..7). `0` — o‘tkazib yuboriladi. */
export function parseVisitWeekdaysFromCell(
  raw: string | null | undefined
): { days: number[]; unknownTokens: string[] } {
  if (raw == null) return { days: [], unknownTokens: [] };
  let normalized = String(raw).trim().replace(/\u00a0/g, " ");
  if (!normalized) return { days: [], unknownTokens: [] };

  normalized = normalized.replace(/;+/g, ",").replace(/\|+/g, ",");
  const compact = normalized.replace(/\s/g, "");
  /** Excel: `1.2` matn sifatida ikki kun (1 va 2); `12` yoki `1.25` bundan mustasno. */
  const dotPair = /^([1-7])\.([1-7])$/.exec(compact);
  if (dotPair) {
    normalized = `${dotPair[1]},${dotPair[2]}`;
  }

  const parts = normalized
    .split(/[,/]+|\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const out: number[] = [];
  const unknownTokens: string[] = [];

  for (const part of parts) {
    const p = normalizeVisitWeekdayToken(part);
    if (!p) continue;

    if (/^\d{1,2}$/.test(p)) {
      const num = Number.parseInt(p, 10);
      if (num >= 1 && num <= 7) {
        out.push(num);
        continue;
      }
      // 0 va boshqa raqamlar — qabul qilinmaydi
      unknownTokens.push(part.trim());
      continue;
    }

    const n = VISIT_WEEKDAY_TOKEN_MAP[p];
    if (n != null && n >= 1 && n <= 7) out.push(n);
    else unknownTokens.push(part.trim());
  }

  return {
    days: [...new Set(out)].sort((a, b) => a - b),
    unknownTokens: [...new Set(unknownTokens)]
  };
}

/** Shablon / eksport: «Ср,Чт,Пт,Сб» (2 harfli rus qisqartma). */
export function formatVisitWeekdaysRuAbbrev(days: number[]): string {
  const uniq = [...new Set(days.filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
  return uniq.map((d) => VISIT_WEEKDAY_RU_ABBREV[d] ?? String(d)).join(",");
}

/** @deprecated alias — import.assign ichida eski nom */
export const parseRussianVisitDaysDetailed = parseVisitWeekdaysFromCell;
