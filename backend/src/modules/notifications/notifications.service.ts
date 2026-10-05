import { prisma } from "../../config/database";
import { notifyClientOrderStatus, pushStaffNotificationSoon, soon } from "../tg-app/tg-notify";

export async function listNotifications(
  tenantId: number,
  userId: number,
  opts: { unread_only?: boolean; limit: number }
) {
  const where: { tenant_id: number; user_id: number; read_at?: null } = {
    tenant_id: tenantId,
    user_id: userId
  };
  if (opts.unread_only) where.read_at = null;
  const [rows, unread] = await Promise.all([
    prisma.inAppNotification.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: opts.limit
    }),
    prisma.inAppNotification.count({
      where: { tenant_id: tenantId, user_id: userId, read_at: null }
    })
  ]);
  return {
    data: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link_href: n.link_href,
      read_at: n.read_at?.toISOString() ?? null,
      created_at: n.created_at.toISOString()
    })),
    unread_count: unread
  };
}

export async function markNotificationRead(tenantId: number, userId: number, id: number) {
  const row = await prisma.inAppNotification.findFirst({
    where: { id, tenant_id: tenantId, user_id: userId }
  });
  if (!row) return null;
  if (!row.read_at) {
    await prisma.inAppNotification.update({
      where: { id },
      data: { read_at: new Date() }
    });
  }
  return { ok: true };
}

export async function markAllRead(tenantId: number, userId: number) {
  await prisma.inAppNotification.updateMany({
    where: { tenant_id: tenantId, user_id: userId, read_at: null },
    data: { read_at: new Date() }
  });
  return { ok: true };
}

/** Ichki chaqiriqlar (masalan buyurtma holati o‘zgarganda). */
export async function createNotification(input: {
  tenant_id: number;
  user_id: number;
  title: string;
  body?: string | null;
  link_href?: string | null;
}) {
  const row = await prisma.inAppNotification.create({
    data: {
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      title: input.title.slice(0, 500),
      body: input.body?.slice(0, 4000) ?? null,
      link_href: input.link_href?.slice(0, 512) ?? null
    }
  });
  pushStaffNotificationSoon(input);
  return row;
}

/** Zakaz statusi o‘zgaganda agent va ekspeditorga (o‘zgartirgan shaxsga emas). */
export async function notifyOrderParticipantsStatusChange(params: {
  tenant_id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  from_status: string;
  to_status: string;
  actor_user_id: number | null;
  agent_id: number | null;
  expeditor_user_id: number | null;
}): Promise<void> {
  soon(() => notifyClientOrderStatus(params.tenant_id, params.order_id, params.to_status));
  const recipients = new Set<number>();
  if (params.agent_id != null && params.agent_id > 0) recipients.add(params.agent_id);
  if (params.expeditor_user_id != null && params.expeditor_user_id > 0) {
    recipients.add(params.expeditor_user_id);
  }
  if (params.actor_user_id != null && params.actor_user_id > 0) {
    recipients.delete(params.actor_user_id);
  }
  if (recipients.size === 0) return;

  const title = `Заказ ${params.order_number}: ${params.from_status} → ${params.to_status}`;
  const body = `Клиент: ${params.client_name}`.slice(0, 4000);
  const link_href = `/orders/${params.order_id}`;

  for (const user_id of recipients) {
    try {
      await createNotification({
        tenant_id: params.tenant_id,
        user_id,
        title,
        body,
        link_href
      });
    } catch {
      /* bildirishnoma xatosi zakazni buzmasin */
    }
  }
}

/** Yangi klient operator tomonidan aktivlashtirilganda bog‘langan agent(lar)ga. */
export async function notifyAgentsClientActivated(params: {
  tenant_id: number;
  client_id: number;
  client_name: string;
  actor_user_id?: number | null;
}): Promise<void> {
  const { clientActivationNotifyRecipientIds } = await import("./client-activation-notify");
  const client = await prisma.client.findFirst({
    where: {
      id: params.client_id,
      tenant_id: params.tenant_id,
      merged_into_client_id: null
    },
    select: {
      agent_id: true,
      agent_assignments: { select: { agent_id: true }, take: 8 }
    }
  });
  if (!client) return;

  const recipients = clientActivationNotifyRecipientIds({
    agent_id: client.agent_id,
    assignment_agent_ids: client.agent_assignments.map((a) => a.agent_id),
    actor_user_id: params.actor_user_id
  });
  if (recipients.length === 0) return;

  const title = "Клиент подтверждён";
  const body = `«${params.client_name.trim() || `#${params.client_id}`}» активирован оператором. Можно принимать заказы.`.slice(
    0,
    4000
  );
  const link_href = `/clients/${params.client_id}`;

  for (const user_id of recipients) {
    try {
      await createNotification({
        tenant_id: params.tenant_id,
        user_id,
        title,
        body,
        link_href
      });
    } catch {
      /* ignore */
    }
  }
}
