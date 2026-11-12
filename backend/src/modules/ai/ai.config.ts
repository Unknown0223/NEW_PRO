/** AI Assistant — sozlamalar (env orqali boshqariladi). */
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function flag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
}

export const AI_CONFIG = {
  /** Umumiy kill-switch. */
  get enabled(): boolean {
    return flag(process.env.AI_ASSISTANT_ENABLED, true);
  },
  /** Yozish tool’lari yoqilganmi. */
  get writeEnabled(): boolean {
    return flag(process.env.AI_WRITE_ENABLED, true);
  },
  /** Jadvaldagi maksimal qator. */
  get maxRows(): number {
    return num(process.env.AI_MAX_ROWS, 50);
  },
  /** Eksportdagi maksimal qator. */
  get maxExportRows(): number {
    return num(process.env.AI_MAX_EXPORT_ROWS, 5000);
  },
  /** Bitta tool uchun timeout. */
  get toolTimeoutMs(): number {
    return num(process.env.AI_TOOL_TIMEOUT_MS, 15_000);
  },
  /** Eksport tokeni TTL (sekund). */
  get exportTtlSec(): number {
    return num(process.env.AI_EXPORT_TTL_SEC, 600);
  },
  /** Tasdiqlash tokeni TTL (sekund). */
  get confirmTtlSec(): number {
    return num(process.env.AI_CONFIRM_TTL_SEC, 300);
  },
  /** Savol/min (route darajasida). */
  get askRateMax(): number {
    return num(process.env.AI_ASK_RATE_MAX, 30);
  },
  /** Yozish tool’lariga ruxsat etilgan rollar. */
  get writeRoles(): ReadonlySet<string> {
    return new Set<string>([...ADMIN_AND_OPERATOR_LIKE_ROLES]);
  },
  /** O‘z ma’lumotidan tashqariga chiqa olmaydigan rollar. */
  get selfScopedRoles(): ReadonlySet<string> {
    return new Set(["agent", "expeditor", "collector", "auditor"]);
  }
};
