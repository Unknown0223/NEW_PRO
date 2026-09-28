/**
 * Nakladnoy bloklarini (har klient — bitta blok) A4 sahifalarga joylash.
 *
 * Tartib iloji boricha saqlanadi, lekin sahifada joy qolsa va navbatdagi blok
 * sig‘masa, keyingi sig‘adigan blok shu sahifaga olib o‘tiladi (ordered first-fit).
 * Hech bir blok ikki sahifa orasida bo‘linmaydi; faqat bitta sahifadan katta blok
 * alohida sahifaga yolg‘iz qo‘yiladi.
 */

/** A4 portrait balandligi (pt). */
export const A4_PORTRAIT_HEIGHT_PT = 841.89;
/** A4 portrait kengligi (pt). */
export const A4_PORTRAIT_WIDTH_PT = 595.28;

export type NakladnoyPagePackInput = {
  /** Har blok balandligi (pt), kirish tartibida. */
  heights: number[];
  /** Bitta sahifaga sig‘adigan balandlik (pt). */
  capacity: number;
  /** Bir sahifadagi ikki blok orasidagi bo‘shliq (pt). */
  gap?: number;
};

/** Sahifalar — har biri kirish indekslari ro‘yxati (yozish tartibida). */
export function packNakladnoyBlocksIntoPages(input: NakladnoyPagePackInput): number[][] {
  const { heights, capacity } = input;
  const gap = Math.max(0, input.gap ?? 0);
  const remaining = heights.map((_, i) => i);
  const pages: number[][] = [];

  while (remaining.length > 0) {
    const page: number[] = [];
    let used = 0;
    for (let k = 0; k < remaining.length; k++) {
      const idx = remaining[k]!;
      const h = Math.max(0, heights[idx] ?? 0);
      if (page.length === 0) {
        page.push(idx);
        used = h;
        continue;
      }
      if (used + gap + h <= capacity) {
        page.push(idx);
        used += gap + h;
      }
    }
    const taken = new Set(page);
    for (let k = remaining.length - 1; k >= 0; k--) {
      if (taken.has(remaining[k]!)) remaining.splice(k, 1);
    }
    pages.push(page);
  }

  return pages;
}

/**
 * Excel kolonka kengligi (belgi) → piksel (Calibri 11, max digit width 7px).
 * Excel formulasi: trunc(((256*w + trunc(128/7)) / 256) * 7).
 */
export function excelColumnWidthToPx(width: number): number {
  return Math.trunc(((256 * width + Math.trunc(128 / 7)) / 256) * 7);
}

/**
 * Qo‘lda sahifa bo‘linishlari ishlashi uchun «Fit to page» emas, aniq `scale` kerak
 * (Excel «Fit to» rejimida manual page break’larni e’tiborsiz qoldiradi).
 */
export function nakladnoyPrintScalePercent(
  columnWidths: number[],
  marginInch: number,
  pageWidthPt = A4_PORTRAIT_WIDTH_PT,
  safety = 0.97
): number {
  const contentPt = columnWidths.reduce((s, w) => s + excelColumnWidthToPx(w), 0) * 0.75;
  const printablePt = pageWidthPt - marginInch * 72 * 2;
  if (contentPt <= 0) return 100;
  const pct = Math.floor((printablePt / contentPt) * 100 * safety);
  return Math.max(40, Math.min(100, pct));
}

/** Sahifaga sig‘adigan qator balandliklari yig‘indisi (pt), scale hisobga olingan. */
export function nakladnoyPageCapacityPt(
  scalePercent: number,
  marginInch: number,
  pageHeightPt = A4_PORTRAIT_HEIGHT_PT,
  safety = 0.97
): number {
  const printablePt = pageHeightPt - marginInch * 72 * 2;
  return (printablePt / (scalePercent / 100)) * safety;
}
