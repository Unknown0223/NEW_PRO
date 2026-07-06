import { Prisma } from "@prisma/client";
import JSZip from "jszip";

export async function readZipJson<T>(zip: JSZip, path: string): Promise<T[]> {
  const entry = zip.file(path);
  if (!entry) return [];
  const raw = await entry.async("string");
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function asIsoDate(v: unknown): Date | undefined {
  if (v == null || v === "") return undefined;
  return new Date(String(v));
}

export function asDecimal(v: unknown): Prisma.Decimal | undefined {
  if (v == null || v === "") return undefined;
  return new Prisma.Decimal(String(v));
}

export function asInt(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function remapId(maps: Map<number, number>, v: unknown): number | null | undefined {
  if (v == null) return null;
  const old = Number(v);
  if (!Number.isFinite(old)) return null;
  const mapped = maps.get(old);
  if (mapped == null) return undefined;
  return mapped;
}

/** Prisma create uchun eksport qatoridan `id` va tenant_id ni olib tashlash. */
export function stripIdTenant(row: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, tenant_id: _tid, ...rest } = row;
  return rest;
}

export function hydrateDecimals(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of keys) {
    if (out[k] != null) out[k] = asDecimal(out[k]);
  }
  return out;
}

export function remapIntArray(map: Map<number, number>, ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const out: number[] = [];
  for (const id of ids) {
    const mapped = map.get(Number(id));
    if (mapped != null) out.push(mapped);
  }
  return out;
}

export function hydrateDates(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of keys) {
    if (out[k] != null) out[k] = asIsoDate(out[k]);
  }
  return out;
}
