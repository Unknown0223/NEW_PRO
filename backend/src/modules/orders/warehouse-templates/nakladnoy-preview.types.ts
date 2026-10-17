import type { ExpeditorLoading520Document } from "./expeditor-loading-520-document";

export type NakladnoyPreviewCell = {
  v: string;
  bold?: boolean;
  bg?: string;
  align?: "left" | "center" | "right";
  skip?: boolean;
  colSpan?: number;
  rowSpan?: number;
  /** Excelda katakda chegara (border) yo‘q. */
  noBorder?: boolean;
  /** Excel wrapText (sahifalangan varaqlarda). */
  wrap?: boolean;
  /** Shrift o‘lchami, pt (sahifalangan varaqlarda). */
  fs?: number;
};

export type NakladnoyPreviewPage = {
  sheetName: string;
  kind: "structured-520" | "grid";
  loading520?: ExpeditorLoading520Document;
  grid?: {
    colCount: number;
    rows: NakladnoyPreviewCell[][];
    /** Excel qo‘lda sahifa bo‘linishlari: shu indeksli qatordan keyin yangi qog‘oz (0-based). */
    pageBreakAfterRows?: number[];
    /** Kolonka kengliklari (px, Excel bo‘yicha). */
    colWidthsPx?: number[];
    /** Qator balandliklari (pt). */
    rowHeightsPt?: number[];
  };
};

export type NakladnoyPreviewResponse = {
  label: string;
  filename: string;
  pages: NakladnoyPreviewPage[];
};
