import type { ExpeditorLoading520Document } from "./expeditor-loading-520-document";

export type NakladnoyPreviewCell = {
  v: string;
  bold?: boolean;
  bg?: string;
  align?: "left" | "center" | "right";
  skip?: boolean;
  colSpan?: number;
  rowSpan?: number;
};

export type NakladnoyPreviewPage = {
  sheetName: string;
  kind: "structured-520" | "grid";
  loading520?: ExpeditorLoading520Document;
  grid?: {
    colCount: number;
    rows: NakladnoyPreviewCell[][];
  };
};

export type NakladnoyPreviewResponse = {
  label: string;
  filename: string;
  pages: NakladnoyPreviewPage[];
};
