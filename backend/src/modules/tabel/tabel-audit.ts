import type { Prisma } from "@prisma/client";

/**
 * Единый журнал аудита для модулей «Табель» и «Рабочие дни».
 *
 * Хранится в `tenant.settings.tabel_audit` (JSON), чтобы читаться разделом
 * «Аудит» и пополняться из мутаций табеля и графиков в рамках того же
 * `tenant.update`, что и изменяемая секция настроек (без гонок записи).
 */

export type TabelAuditModule = "timesheet" | "workdays";
export type TabelAuditKind = "status" | "schedule" | "exception" | "override";

export interface TabelAuditRecord {
  id: string;
  module: TabelAuditModule;
  kind: TabelAuditKind;
  title: string;
  subtitle?: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
  changedBy: string;
  changedAt: string;
}

export interface NewTabelAuditRecord {
  module: TabelAuditModule;
  kind: TabelAuditKind;
  title: string;
  subtitle?: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
  changedBy: string;
}

const MAX_AUDIT_RECORDS = 3000;

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function isModule(v: unknown): v is TabelAuditModule {
  return v === "timesheet" || v === "workdays";
}

function isKind(v: unknown): v is TabelAuditKind {
  return v === "status" || v === "schedule" || v === "exception" || v === "override";
}

export function readTabelAudit(settings: Prisma.JsonValue): TabelAuditRecord[] {
  const root = asObj(settings);
  const raw = root.tabel_audit;
  if (!Array.isArray(raw)) return [];
  const out: TabelAuditRecord[] = [];
  for (const item of raw) {
    const o = asObj(item);
    if (!isModule(o.module) || !isKind(o.kind)) continue;
    const id = str(o.id);
    const title = str(o.title);
    const changedBy = str(o.changedBy);
    const changedAt = str(o.changedAt);
    if (!id || !title || !changedBy || !changedAt) continue;
    out.push({
      id,
      module: o.module,
      kind: o.kind,
      title,
      subtitle: str(o.subtitle),
      oldValue: str(o.oldValue),
      newValue: str(o.newValue),
      comment: str(o.comment),
      changedBy,
      changedAt
    });
  }
  return out;
}

export function genAuditId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Возвращает новый список записей аудита: свежие сверху, ограничение по размеру.
 * Не пишет в БД — вызывающий код собирает итоговый объект настроек.
 */
export function mergeTabelAudit(
  existing: TabelAuditRecord[],
  additions: NewTabelAuditRecord[]
): TabelAuditRecord[] {
  if (additions.length === 0) return existing;
  const now = new Date().toISOString();
  const built: TabelAuditRecord[] = additions.map((r) => ({
    ...r,
    id: genAuditId(),
    changedAt: now
  }));
  return [...built.reverse(), ...existing].slice(0, MAX_AUDIT_RECORDS);
}
