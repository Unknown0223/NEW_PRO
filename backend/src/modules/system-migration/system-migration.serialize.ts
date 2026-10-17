import { Prisma } from "@prisma/client";

export function serializeForBackup(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  // Decimal.js / Prisma.Decimal — instanceof ba’zan package duplicate da yiqiladi
  if (value instanceof Prisma.Decimal) return value.toString();
  if (
    typeof value === "object" &&
    value !== null &&
    "toFixed" in value &&
    typeof (value as { toFixed?: unknown }).toFixed === "function" &&
    "d" in value
  ) {
    try {
      return String(value);
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(value)) return value.map(serializeForBackup);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeForBackup(v);
    }
    return out;
  }
  return value;
}

/** Compact JSON — katta tenantda pretty-print RAM/CPU ni ortiqcha yeydi. */
export function jsonFileContent(value: unknown): string {
  return `${JSON.stringify(serializeForBackup(value))}\n`;
}
