import { Prisma } from "@prisma/client";

export function serializeForBackup(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
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

export function jsonFileContent(value: unknown): string {
  return `${JSON.stringify(serializeForBackup(value), null, 2)}\n`;
}
