export type InitialSetupStepKind = "manual" | "excel-import" | "info";

export type InitialSetupStepStatus = "pending" | "ready" | "done" | "skipped";

export type InitialSetupImportApi = {
  templatePath?: string;
  templateFilename?: string;
  importPath: string;
  importAsyncPath?: string;
  method?: "POST";
};

export type InitialSetupStep = {
  id: string;
  title: string;
  description: string;
  /** Qaysi qadamlar bajarilishi kerak (id ro‘yxati) */
  dependsOn: string[];
  /** Bog‘lanish tushuntirishi */
  dependencyHint?: string;
  kind: InitialSetupStepKind;
  /** Sozlamalar sahifasi (qo‘lda to‘ldirish) */
  settingsHref?: string;
  /** Excel import */
  importApi?: InitialSetupImportApi;
  /** Majburiy ustunlar (preview validatsiyasi) */
  requiredColumns?: string[];
  /** Qadamlar tartibi (kichik = oldin) */
  order: number;
};

export type InitialSetupGroup = {
  id: string;
  title: string;
  subtitle: string;
  stepIds: string[];
  /** false = alohida «sozlamalar» ro‘yxatida, boshlang‘ich importda emas */
  inColdStartFlow: boolean;
};

export type InitialSetupPreviewRow = {
  rowIndex: number;
  cells: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export type InitialSetupPreviewState = {
  columns: string[];
  rows: InitialSetupPreviewRow[];
  fileName: string;
};
