/**
 * Profil JSON dan tashqari tenant.settings kalitlari (bonus, mobile release, work_slots).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { remapId } from "./system-migration.parse";

export const SETTINGS_EXTRA_JSON_PATH = "spravochniki/tenant-settings-extra.json";

/** Profil DTO ga kirmaydigan, lekin restore kerak bo‘lgan settings kalitlari. */
export const TENANT_SETTINGS_EXTRA_KEYS = [
  "bonus_stack",
  "mobile_app_release",
  "work_slots"
] as const;

function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export async function loadTenantSettingsExtra(
  tenantId: number
): Promise<Record<string, unknown>> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const out: Record<string, unknown> = {};
  for (const key of TENANT_SETTINGS_EXTRA_KEYS) {
    if (st[key] !== undefined) out[key] = st[key];
  }
  return out;
}

export async function applyTenantSettingsExtra(
  tenantId: number,
  extra: Record<string, unknown>
): Promise<void> {
  if (!extra || typeof extra !== "object") return;
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const next = { ...asRecord(row?.settings) };
  let changed = false;
  for (const key of TENANT_SETTINGS_EXTRA_KEYS) {
    if (extra[key] !== undefined) {
      next[key] = extra[key];
      changed = true;
    }
  }
  if (!changed) return;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: next as Prisma.InputJsonValue }
  });
}

/**
 * Filiallardagi cash_desk_ids / user_links — eski ID → yangi map.
 * References (users/cash_desks) importidan keyin chaqiriladi.
 */
export async function remapBranchIdsInTenantSettings(
  tenantId: number,
  maps: MigrationIdMaps
): Promise<number> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const refs = asRecord(st.references);
  const branches = refs.branches;
  if (!Array.isArray(branches) || !branches.length) return 0;

  let touched = 0;
  const nextBranches = branches.map((raw) => {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const b = { ...(raw as Record<string, unknown>) };
    let changed = false;

    if (Array.isArray(b.cash_desk_ids)) {
      const mapped = (b.cash_desk_ids as unknown[])
        .map((id) => remapId(maps.cashDesk, id))
        .filter((id): id is number => id != null);
      b.cash_desk_ids = mapped;
      b.cash_desk_id = mapped[0] ?? null;
      changed = true;
    } else if (b.cash_desk_id != null) {
      const m = remapId(maps.cashDesk, b.cash_desk_id);
      if (m != null) {
        b.cash_desk_id = m;
        changed = true;
      }
    }

    if (Array.isArray(b.user_links)) {
      b.user_links = (b.user_links as unknown[]).map((link) => {
        if (link == null || typeof link !== "object" || Array.isArray(link)) return link;
        const L = { ...(link as Record<string, unknown>) };
        if (Array.isArray(L.user_ids)) {
          L.user_ids = (L.user_ids as unknown[])
            .map((id) => remapId(maps.user, id))
            .filter((id): id is number => id != null);
        }
        return L;
      });
      changed = true;
    }

    if (changed) touched += 1;
    return b;
  });

  if (!touched) return 0;
  refs.branches = nextBranches;
  st.references = refs;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: st as Prisma.InputJsonValue }
  });
  return touched;
}
