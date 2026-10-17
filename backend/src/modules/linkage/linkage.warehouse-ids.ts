/**
 * Ishchi o‘rin omborlari — `warehouseUserLink` + User.warehouse_id + faol slot.
 * Dastavchik/agent joyga bog‘langanda zakaz formasi omborni topishi uchun.
 */

import { prisma } from "../../config/database";

export function mergeWarehouseIdSources(args: {
  linkIds: number[];
  userPrimary: number | null | undefined;
  slotPrimary: number | null | undefined;
  slotIds: number[];
}): number[] {
  const out = new Set<number>();
  const add = (n: number | null | undefined) => {
    if (n != null && Number.isInteger(n) && n > 0) out.add(n);
  };
  for (const id of args.linkIds) add(id);
  add(args.userPrimary);
  add(args.slotPrimary);
  for (const id of args.slotIds) add(id);
  return [...out];
}

/** Bir nechta xodim (agent/dastavchik) uchun ombor id lari. */
export async function collectWarehouseIdsForUsers(
  tenantId: number,
  userIds: number[]
): Promise<number[]> {
  const uniq = [...new Set(userIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniq.length === 0) return [];

  const [links, users, slotLinks] = await Promise.all([
    prisma.warehouseUserLink.findMany({
      where: { user_id: { in: uniq }, warehouse: { tenant_id: tenantId, is_active: true } },
      select: { warehouse_id: true }
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: uniq } },
      select: { warehouse_id: true }
    }),
    prisma.slotUserLink.findMany({
      where: {
        tenant_id: tenantId,
        user_id: { in: uniq },
        ended_at: null,
        slot: { tenant_id: tenantId, deleted_at: null }
      },
      select: {
        slot: { select: { warehouse_id: true, warehouse_ids: true } }
      }
    })
  ]);

  const extraFromUsersAndSlots: number[] = [];
  for (const u of users) {
    if (u.warehouse_id != null) extraFromUsersAndSlots.push(u.warehouse_id);
  }
  for (const l of slotLinks) {
    if (l.slot.warehouse_id != null) extraFromUsersAndSlots.push(l.slot.warehouse_id);
    for (const id of l.slot.warehouse_ids) extraFromUsersAndSlots.push(id);
  }

  return mergeWarehouseIdSources({
    linkIds: links.map((r) => r.warehouse_id),
    userPrimary: null,
    slotPrimary: null,
    slotIds: extraFromUsersAndSlots
  });
}
