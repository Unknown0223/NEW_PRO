import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type WorkplaceMark = {
  slotCode: string;
  /** Joydan chiqarilgan: hozir boshqa xodim o‘tiradi, eski buyurtmalar shu odamda. */
  replaced: boolean;
};

const HAS_LETTER = /\p{L}/u;

export function readableAgentName(parts: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
}): string {
  const name = (parts.name ?? "").trim();
  if (HAS_LETTER.test(name)) return name;
  const fio = [parts.first_name, parts.last_name, parts.middle_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (HAS_LETTER.test(fio)) return fio;
  return name || "—";
}

/** Shaxsiy kod bo‘sh bo‘lsa ish joyining smart kodi. */
export function resolveAgentSmartCode(
  userCode: string | null | undefined,
  mark: WorkplaceMark | undefined
): string {
  const personal = (userCode ?? "").trim();
  if (personal) return personal;
  return (mark?.slotCode ?? "").trim();
}

export async function loadWorkplaceMarks(
  tenantId: number,
  userIds: number[]
): Promise<Map<number, WorkplaceMark>> {
  const ids = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map<number, WorkplaceMark>();
  if (ids.length === 0) return map;

  const rows = await prisma.$queryRaw<Array<{ user_id: number; slot_code: string; open: boolean }>>`
    SELECT DISTINCT ON (l.user_id)
      l.user_id,
      ws.slot_code,
      (l.ended_at IS NULL) AS open
    FROM slot_user_links l
    JOIN work_slots ws ON ws.id = l.slot_id
    WHERE l.tenant_id = ${tenantId}
      AND l.user_id IN (${Prisma.join(ids)})
      AND ws.deleted_at IS NULL
      AND ws.slot_type = 'agent'
    ORDER BY l.user_id, (l.ended_at IS NULL) DESC, l.ended_at DESC NULLS FIRST, l.started_at DESC
  `;

  for (const row of rows) {
    const open = row.open === true || (row.open as unknown) === "t";
    map.set(row.user_id, {
      slotCode: row.slot_code,
      replaced: !open
    });
  }
  return map;
}
