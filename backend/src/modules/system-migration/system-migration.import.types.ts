export type MigrationImportStageId =
  | "queued"
  | "validate"
  | "profile"
  | "references"
  | "bonus"
  | "transactional"
  | "extended"
  | "files"
  | "done"
  | "failed";

export type ApplyBackupResult = {
  applied: string[];
  skipped: string[];
  warnings: string[];
  next_steps: string[];
};

export type ApplyBackupMode = "full" | "profile_only";

export type MigrationImportProgressReport = {
  stage: MigrationImportStageId;
  percent: number;
  message: string;
};

export type ApplyBackupProgressFn = (p: MigrationImportProgressReport) => void | Promise<void>;
