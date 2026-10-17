import { prisma } from "../../config/database";
import { SLOT_TYPE_CODE_PREFIX, isWorkSlotType } from "./work-slots.constants";

function normalizeBranch(branchCode?: string | null): string {
  const b = (branchCode ?? "MAIN").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  return (b || "MAIN").slice(0, 8);
}

/** Keyingi bo‘sh smart kod: `A-SERGEli-001` (rol + filial + raqam). */
export async function suggestNextSlotCode(
  tenantId: number,
  slotType: string,
  branchCode?: string | null
): Promise<string> {
  const role = isWorkSlotType(slotType) ? SLOT_TYPE_CODE_PREFIX[slotType] : "A";
  const branch = normalizeBranch(branchCode);
  const basePrefix = `${role}-${branch}-`;

  const existing = await prisma.workSlot.findMany({
    where: {
      tenant_id: tenantId,
      slot_code: { startsWith: basePrefix, mode: "insensitive" }
    },
    select: { slot_code: true },
    take: 2000
  });

  let max = 0;
  for (const row of existing) {
    const tail = row.slot_code.slice(basePrefix.length);
    const n = Number.parseInt(tail.replace(/\D/g, ""), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }

  const next = String(max + 1).padStart(3, "0");
  return `${basePrefix}${next}`.slice(0, 32);
}

export function normalizeSlotCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidSlotCode(code: string): boolean {
  return /^[A-Z0-9-]{1,32}$/.test(code);
}

/** Smart format: `V-ANDIJON-001` — birinchi harf slot tipiga mos kelishi shart. Custom kodlar (PMXRZ002) ruxsat. */
const SMART_CODE_RE = /^([A-Z])-([A-Z0-9]+)-(\d{1,6})$/;

export function parseSmartSlotCodePrefix(code: string): string | null {
  const m = SMART_CODE_RE.exec(normalizeSlotCode(code));
  return m?.[1] ?? null;
}

export function expectedSmartPrefixForSlotType(slotType: string): string | null {
  if (!isWorkSlotType(slotType)) return null;
  return SLOT_TYPE_CODE_PREFIX[slotType];
}

/**
 * Agar kod smart formatda bo‘lsa — prefiks slot_type bilan mos kelishi shart.
 * Mos kelmasa BAD_SLOT_CODE_PREFIX (masalan sales_director o‘rniga N-...).
 */
export function assertSlotCodeMatchesType(code: string, slotType: string): void {
  const prefix = parseSmartSlotCodePrefix(code);
  if (!prefix) return;
  const expected = expectedSmartPrefixForSlotType(slotType);
  if (!expected) return;
  if (prefix !== expected) throw new Error("BAD_SLOT_CODE_PREFIX");
}
