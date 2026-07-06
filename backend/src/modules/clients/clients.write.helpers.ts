import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  applyTerritoryAutoAssignAfterAddressChange,
  clientUpdateTouchesAddress
} from "../work-slots/work-slots.territory-auto";
import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";
import { normalizePhoneDigits } from "./clients.types";
import { CONTACT_SLOTS, contactPersonsToJson } from "./clients.helpers";
import {
  replaceClientAgentAssignments,
  syncAssignmentSlotOneWithClientRow
} from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import type { ClientDetailRow } from "./clients.detail";
import { getClientDetail } from "./clients.detail";

/** Seed/import dagi `0` kabi yaroqsiz qiymatlarni `null` ga aylantiradi; 14 raqam — saqlanadi. */
export function normalizeClientPinfl(raw: string | null | undefined): string | null {
  const pf = raw?.replace(/\D/g, "") ?? "";
  if (pf.length === 0 || /^0+$/.test(pf)) return null;
  if (pf.length === 14) return pf.slice(0, 20);
  if (pf.length > 0 && pf.length < 14) {
    throw new Error("VALIDATION");
  }
  return pf.slice(0, 20);
}

export function parseOptionalLatitude(v: string | number | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < -90 || n > 90) throw new Error("VALIDATION");
  return new Prisma.Decimal(s);
}

export function parseOptionalLongitude(v: string | number | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < -180 || n > 180) throw new Error("VALIDATION");
  return new Prisma.Decimal(s);
}
