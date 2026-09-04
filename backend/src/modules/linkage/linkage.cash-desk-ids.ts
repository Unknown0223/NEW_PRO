/**
 * Ishchi o‘rin kassalari — `cashDeskUserLink` + faol slot.
 * Dastavchik/agent joyga bog‘langanda zakaz formasi kassani topishi uchun.
 */

import { prisma } from "../../config/database";

export function mergeCashDeskIdSources(args: {
  linkIds: number[];
  slotPrimary: number | null | undefined;
  slotIds: number[];
}): number[] {
  const out = new Set<number>();
  const add = (n: number | null | undefined) => {
    if (n != null && Number.isInteger(n) && n > 0) out.add(n);
  };
  for (const id of args.linkIds) add(id);
  add(args.slotPrimary);
  for (const id of args.slotIds) add(id);
  return [...out];
}

export async function collectCashDeskIdsForUsers(
  tenantId: number,
  userIds: number[]
): Promise<number[]> {
  const uniq = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniq.length === 0) return [];

  const [links, slotLinks] = await Promise.all([
    prisma.cashDeskUserLink.findMany({
      where: { user_id: { in: uniq }, cash_desk: { tenant_id: tenantId, is_active: true } },
      select: { cash_desk_id: true }
    }),
    prisma.slotUserLink.findMany({
      where: {
        tenant_id: tenantId,
        user_id: { in: uniq },
        ended_at: null,
        slot: { tenant_id: tenantId, deleted_at: null }
      },
      select: {
        slot: { select: { cash_desk_id: true, cash_desk_ids: true } }
      }
    })
  ]);

  const extraFromSlots: number[] = [];
  for (const l of slotLinks) {
    if (l.slot.cash_desk_id != null) extraFromSlots.push(l.slot.cash_desk_id);
    for (const id of l.slot.cash_desk_ids) extraFromSlots.push(id);
  }

  return mergeCashDeskIdSources({
    linkIds: links.map((r) => r.cash_desk_id),
    slotPrimary: null,
    slotIds: extraFromSlots
  });
}
