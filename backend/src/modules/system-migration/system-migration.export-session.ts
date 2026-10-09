import { randomBytes } from "crypto";
import { unlink } from "fs/promises";

export type MigrationExportProgress = {
  stage: string;
  percent: number;
  message: string;
  updated_at: string;
};

export type MigrationExportSession = {
  id: string;
  tenant_id: number;
  tenant_slug: string;
  state: "active" | "completed" | "failed";
  progress: MigrationExportProgress;
  file_path?: string;
  filename?: string;
  byte_length?: number;
  error?: string;
  created_at: string;
};

const sessions = new Map<string, MigrationExportSession>();
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - Date.parse(s.created_at) <= MAX_AGE_MS) continue;
    if (s.file_path) void unlink(s.file_path).catch(() => undefined);
    sessions.delete(id);
  }
}

export function createMigrationExportSession(
  tenantId: number,
  tenantSlug: string
): MigrationExportSession {
  pruneSessions();
  const id = `exp-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const session: MigrationExportSession = {
    id,
    tenant_id: tenantId,
    tenant_slug: tenantSlug,
    state: "active",
    progress: {
      stage: "queued",
      percent: 0,
      message: "В очереди…",
      updated_at: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  };
  sessions.set(id, session);
  return session;
}

export function getMigrationExportSession(
  sessionId: string,
  tenantId: number
): MigrationExportSession | null {
  const s = sessions.get(sessionId);
  if (!s || s.tenant_id !== tenantId) return null;
  return s;
}

export function reportMigrationExportProgress(
  sessionId: string,
  patch: { stage: string; percent: number; message: string }
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

export function completeMigrationExportSession(
  sessionId: string,
  filePath: string,
  filename: string,
  byteLength: number
): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.state = "completed";
  s.file_path = filePath;
  s.filename = filename;
  s.byte_length = byteLength;
  s.progress = {
    stage: "done",
    percent: 100,
    message: "Резервная копия готова",
    updated_at: new Date().toISOString()
  };
}

export function failMigrationExportSession(sessionId: string, error: string): void {
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

/** Yuklab olingandan keyin faylni o‘chirish (ixtiyoriy). */
export async function consumeMigrationExportFile(sessionId: string, tenantId: number): Promise<void> {
  const s = getMigrationExportSession(sessionId, tenantId);
  if (!s?.file_path) return;
  const path = s.file_path;
  s.file_path = undefined;
  await unlink(path).catch(() => undefined);
}
