import { prisma } from "../../../config/database";

export async function listExpeditorSharePartners(
  tenantId: number,
  ownerExpeditorUserId: number
) {
  const rows = await prisma.expeditorSharePartner.findMany({
    where: {
      tenant_id: tenantId,
      owner_expeditor_user_id: ownerExpeditorUserId
    },
    orderBy: { id: "asc" }
  });
  if (rows.length === 0) return { partners: [], mode: "own_warehouse" as const };

  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: rows.map((r) => r.partner_expeditor_user_id) }
    },
    select: { id: true, name: true, first_name: true, last_name: true }
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    mode: "partners" as const,
    partners: rows.map((r) => {
      const u = byId.get(r.partner_expeditor_user_id);
      const name =
        [u?.last_name, u?.first_name].filter(Boolean).join(" ").trim() ||
        u?.name ||
        "";
      return {
        id: r.id,
        partner_user_id: r.partner_expeditor_user_id,
        name
      };
    })
  };
}

export async function addExpeditorSharePartner(input: {
  tenantId: number;
  ownerExpeditorUserId: number;
  partnerExpeditorUserId: number;
}) {
  if (input.ownerExpeditorUserId === input.partnerExpeditorUserId) {
    throw new Error("SAME_USER");
  }
  const partner = await prisma.user.findFirst({
    where: {
      tenant_id: input.tenantId,
      id: input.partnerExpeditorUserId,
      role: "expeditor",
      is_active: true
    },
    select: { id: true }
  });
  if (!partner) throw new Error("NOT_FOUND");
  return prisma.expeditorSharePartner.create({
    data: {
      tenant_id: input.tenantId,
      owner_expeditor_user_id: input.ownerExpeditorUserId,
      partner_expeditor_user_id: input.partnerExpeditorUserId
    }
  });
}

export async function removeExpeditorSharePartner(input: {
  tenantId: number;
  ownerExpeditorUserId: number;
  partnerRowId: number;
}) {
  const row = await prisma.expeditorSharePartner.findFirst({
    where: {
      tenant_id: input.tenantId,
      id: input.partnerRowId,
      owner_expeditor_user_id: input.ownerExpeditorUserId
    }
  });
  if (!row) throw new Error("NOT_FOUND");
  await prisma.expeditorSharePartner.delete({ where: { id: row.id } });
  return { ok: true };
}

export const SHARE_PARTNER_EDITOR_ROLES = new Set([
  "admin",
  "manager",
  "regional_manager",
  "logist",
  "dispatcher",
  "warehouse_manager"
]);
