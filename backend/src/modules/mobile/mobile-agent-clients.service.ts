import type { z } from "zod";
import { prisma } from "../../config/database";
import type {
  mobileCreateClientBodySchema,
  mobilePatchClientBodySchema
} from "../../contracts/mobile.schemas";
import {
  createClientPhotoReportRow,
  deleteClientPhotoReport
} from "../clients/client-assets.service";
import { updateClientFields } from "../clients/clients.write.update";
import { createClientMinimal } from "../clients/clients.service";
import {
  assertMobileClientPolicy,
  mobileClientInputToUpdateFields,
  mobileClientPatchToUpdateFields,
  type MobileClientInput
} from "../staff/agent-mobile-config.client-mobile";
import { appendClientToExistingAgentRouteDays } from "../field/field.service";
import {
  agentScopedClientWhereForUser,
  assertAgentScopedClient,
  compactClient,
  clientSyncSelectForAgent,
  loadAgentMobileConfig,
  normalizePhotoBase64Url,
  resolveAgentWorkSlotId,
  type CompactClientRow
} from "./mobile-agent-sync.service";

export async function createMobileClientPhotoReport(
  tenantId: number,
  userId: number,
  clientId: number,
  input: { image_base64: string; caption?: string | null; order_id?: number }
) {
  await assertAgentScopedClient(tenantId, userId, clientId);
  return createClientPhotoReportRow(tenantId, clientId, userId, {
    image_url: normalizePhotoBase64Url(input.image_base64),
    caption: input.caption ?? null,
    order_id: input.order_id ?? null
  });
}

export async function createMobileExpeditorClientPhotoReport(
  tenantId: number,
  userId: number,
  clientId: number,
  input: { image_base64: string; caption?: string | null; order_id?: number }
) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null, is_active: true },
    select: { id: true }
  });
  if (!client) throw new Error("CLIENT_NOT_FOUND");
  return createClientPhotoReportRow(tenantId, clientId, userId, {
    image_url: normalizePhotoBase64Url(input.image_base64),
    caption: input.caption ?? null,
    order_id: input.order_id ?? null
  });
}

export async function deleteMobileClientPhotoReport(
  tenantId: number,
  userId: number,
  clientId: number,
  photoId: number
) {
  await assertAgentScopedClient(tenantId, userId, clientId);
  await deleteClientPhotoReport(tenantId, clientId, photoId, userId);
}

export async function deleteMobileExpeditorClientPhotoReport(
  tenantId: number,
  clientId: number,
  photoId: number,
  actorUserId?: number | null
) {
  await deleteClientPhotoReport(tenantId, clientId, photoId, actorUserId ?? null);
}

export async function linkMobileClientPhotoToOrder(
  tenantId: number,
  userId: number,
  clientId: number,
  photoId: number,
  orderId: number
) {
  await assertAgentScopedClient(tenantId, userId, clientId);
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      tenant_id: tenantId,
      client_id: clientId,
      agent_id: userId
    },
    select: { id: true }
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const row = await prisma.clientPhotoReport.findFirst({
    where: { id: photoId, tenant_id: tenantId, client_id: clientId, deleted_at: null },
    select: { id: true }
  });
  if (!row) throw new Error("NOT_FOUND");

  const updated = await prisma.clientPhotoReport.update({
    where: { id: photoId },
    data: { order_id: orderId }
  });
  return {
    id: updated.id,
    order_id: updated.order_id,
    caption: updated.caption,
    created_at: updated.created_at.toISOString()
  };
}

type CreateClientBody = z.infer<typeof mobileCreateClientBodySchema>;
type PatchClientBody = z.infer<typeof mobilePatchClientBodySchema>;

export async function createMobileAgentClient(
  tenantId: number,
  userId: number,
  input: CreateClientBody
) {
  const cfg = await loadAgentMobileConfig(tenantId, userId);
  assertMobileClientPolicy(cfg?.client, input as MobileClientInput, "create");

  const { id } = await createClientMinimal(tenantId, userId, {
    name: input.name,
    phone: input.phone,
    category: input.category ?? null,
    client_type_code: input.client_type_code ?? null,
    region: input.region ?? null,
    city: input.city ?? null,
    zone: input.zone ?? null,
    sales_channel: input.sales_channel ?? null
  });

  const extra = mobileClientInputToUpdateFields(input as MobileClientInput);
  await updateClientFields(tenantId, id, extra, userId);

  await prisma.client.update({
    where: { id },
    data: { agent_id: userId }
  });

  const workSlotId = await resolveAgentWorkSlotId(userId);

  if (input.visit_weekdays?.length) {
    await prisma.clientAgentAssignment.upsert({
      where: { client_id_slot: { client_id: id, slot: 1 } },
      create: {
        tenant_id: tenantId,
        client_id: id,
        agent_id: userId,
        slot: 1,
        work_slot_id: workSlotId,
        visit_weekdays: input.visit_weekdays
      },
      update: {
        agent_id: userId,
        work_slot_id: workSlotId,
        visit_weekdays: input.visit_weekdays
      }
    });
  }

  const row = await prisma.client.findFirst({
    where: { id, tenant_id: tenantId },
    select: clientSyncSelectForAgent(userId, workSlotId)
  });
  const compact = compactClient(row as unknown as CompactClientRow, { agentId: userId, workSlotId });
  if (input.visit_weekdays?.length) {
    await appendClientToExistingAgentRouteDays(
      tenantId,
      userId,
      {
        client_id: id,
        client_name: compact.name,
        latitude: compact.latitude,
        longitude: compact.longitude
      },
      input.visit_weekdays
    );
  }
  return compact;
}

export async function patchMobileAgentClient(
  tenantId: number,
  userId: number,
  clientId: number,
  patch: PatchClientBody
) {
  const cfg = await loadAgentMobileConfig(tenantId, userId);
  if (cfg?.client?.can_edit === false) throw new Error("CLIENT_EDIT_FORBIDDEN");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, ...(await agentScopedClientWhereForUser(tenantId, userId)) },
    select: { id: true }
  });
  if (!existing) throw new Error("NOT_FOUND");

  assertMobileClientPolicy(cfg?.client, patch as MobileClientInput, "patch");
  const fields = mobileClientPatchToUpdateFields(patch as Partial<MobileClientInput>);
  await updateClientFields(tenantId, clientId, fields, userId);

  const workSlotId = await resolveAgentWorkSlotId(userId);
  const row = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: clientSyncSelectForAgent(userId, workSlotId)
  });
  return compactClient(row as unknown as CompactClientRow, { agentId: userId, workSlotId });
}

/** GPS — faqat ushbu supervayzerga bog‘langan agentlar. */
export async function listMobileSupervisorAgentLocations(
  tenantId: number,
  supervisorUserId?: number
) {
  const agents = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      app_access: true,
      ...(supervisorUserId != null && supervisorUserId > 0
        ? { supervisor_user_id: supervisorUserId }
        : {})
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  if (agents.length === 0) return [];

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const pings = await prisma.agentLocationPing.findMany({
    where: {
      tenant_id: tenantId,
      agent_id: { in: agents.map((a) => a.id) },
      recorded_at: { gte: since }
    },
    orderBy: { recorded_at: "desc" },
    take: 5000
  });

  const latest = new Map<number, (typeof pings)[number]>();
  for (const p of pings) {
    if (!latest.has(p.agent_id)) latest.set(p.agent_id, p);
  }

  return agents
    .map((a) => {
      const ping = latest.get(a.id);
      if (!ping) return null;
      return {
        agent_id: a.id,
        agent_name: a.name,
        latitude: ping.latitude != null ? Number(ping.latitude) : null,
        longitude: ping.longitude != null ? Number(ping.longitude) : null,
        recorded_at: ping.recorded_at.toISOString()
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}
