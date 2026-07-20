import { randomBytes } from "crypto";
import type { ApplyBackupResult } from "./system-migration.import";

export type MigrationImportStageId =
  | "queued"
  | "validate"
  | "profile"
  | "references"
  | "bonus"
  | "transactional"
  | "extended"
  | "done"
  | "failed";

export type MigrationImportProgress = {
  stage: MigrationImportStageId;
  percent: number;
  message: string;
  updated_at: string;
};

export type MigrationImportSession = {
  id: string;
  tenant_id: number;
  state: "active" | "completed" | "failed";
  progress: MigrationImportProgress;
  result?: ApplyBackupResult;
  error?: string;
  created_at: string;
};

const sessions = new Map<string, MigrationImportSession>();
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - Date.parse(s.created_at) > MAX_AGE_MS) sessions.delete(id);
  }
}

export function createMigrationImportSession(tenantId: number): MigrationImportSession {
  pruneSessions();
  const id = `mig-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const session: MigrationImportSession = {
    id,
    tenant_id: tenantId,
    state: "active",
    progress: {
      stage: "queued",
      percent: 0,
      message: "Navbatda…",
      updated_at: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  };
  sessions.set(id, session);
  return session;
}

export function getMigrationImportSession(
  sessionId: string,
  tenantId: number
): MigrationImportSession | null {
  const s = sessions.get(sessionId);
  if (!s || s.tenant_id !== tenantId) return null;
  return s;
}

export function reportMigrationImportProgress(
  sessionId: string,
  patch: { stage: MigrationImportStageId; percent: number; message: string }
): void {
  const s = sessions.get(sessionId);
  if (!s || s.state !== "active") return;
  s.progress = {
    stage: patch.stage,
    percent: Math.max(0, Math.min(100, Math.round(patch.percent))),
    message: patch.message,
    updated_at: new Date().toISOString()
  };
}

export function completeMigrationImportSession(sessionId: string, result: ApplyBackupResult): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.state = "completed";
  s.result = result;
  s.progress = {
    stage: "done",
    percent: 100,
    message: "Import yakunlandi",
    updated_at: new Date().toISOString()
  };
}

export function failMigrationImportSession(sessionId: string, error: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.state = "failed";
  s.error = error;
  s.progress = {
    stage: "failed",
    percent: s.progress.percent,
    message: error,
    updated_at: new Date().toISOString()
  };
}

export const MIGRATION_IMPORT_STAGES: Array<{
  id: MigrationImportStageId;
  label_uz: string;
  percent: number;
}> = [
  { id: "validate", label_uz: "Tekshirish", percent: 5 },
  { id: "profile", label_uz: "Profil", percent: 15 },
  { id: "references", label_uz: "Spravochniklar", percent: 40 },
  { id: "bonus", label_uz: "Bonus / KPI", percent: 55 },
  { id: "transactional", label_uz: "Operatsion tarix", percent: 80 },
  { id: "extended", label_uz: "Kengaytirilgan jadvallar", percent: 95 },
  { id: "done", label_uz: "Tayyor", percent: 100 }
];
