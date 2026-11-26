import { prisma } from "../../../config/database";
import { canTrustCoverFaceOkMark } from "../mobile-face.shared";
import {
  assertLinkedPair,
  assertOneActivePerDay
} from "./cover-eligibility.pure";
import { COVER_FACE_REQUIRED, CoverError } from "./cover-codes";
import { coverPersonDisplayName } from "./cover-display.pure";
import {
  assertFacesForAccept,
  transitionCover,
  type CoverStatus
} from "./cover-state.pure";

/** markFace(true) uchun recent approved cover_accept oynasi. */
const COVER_FACE_VERIFY_WINDOW_MS = 30 * 60 * 1000;

type CoverRow = {
  id: number;
  tenant_id: number;
  agent_user_id: number;
  svr_user_id: number;
  status: string;
  cover_date: Date;
  requested_by_user_id: number;
  accepted_at: Date | null;
  ended_at: Date | null;
  agent_face_ok: boolean;
  svr_face_ok: boolean;
  created_at: Date;
  updated_at: Date;
};

async function attachCoverNames<T extends CoverRow>(
  tenantId: number,
  rows: T[]
): Promise<Array<T & { agent_name: string; svr_name: string }>> {
  if (rows.length === 0) return [];
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.agent_user_id, r.svr_user_id]))
  );
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, name: true, first_name: true, last_name: true }
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...r,
    agent_name: coverPersonDisplayName(byId.get(r.agent_user_id)),
    svr_name: coverPersonDisplayName(byId.get(r.svr_user_id))
  }));
}

async function withCoverNames<T extends CoverRow>(
  tenantId: number,
  row: T
): Promise<T & { agent_name: string; svr_name: string }> {
  const [one] = await attachCoverNames(tenantId, [row]);
  return one!;
}

function todayDate(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function asDateOnly(iso?: string | null): Date {
  if (!iso) return todayDate();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayDate();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function createCover(input: {
  tenantId: number;
  actorUserId: number;
  actorRole: string;
  agentUserId?: number | null;
  svrUserId?: number | null;
  coverDateIso?: string | null;
}) {
  // Agent: o‘zi uchun so‘rov — SVR `users.supervisor_user_id` dan.
  // SVR: agent_user_id majburiy; svr_user_id o‘zi.
  const agentUserId =
    input.actorRole === "agent" ? input.actorUserId : input.agentUserId ?? null;
  if (!agentUserId || agentUserId < 1) {
    throw new CoverError("COVER_FORBIDDEN_ACTOR", "agent_user_id kerak");
  }

  const agent = await prisma.user.findFirst({
    where: {
      id: agentUserId,
      tenant_id: input.tenantId,
      role: "agent",
      is_active: true
    },
    select: { id: true, supervisor_user_id: true }
  });
  if (!agent) throw new CoverError("NOT_FOUND", "Agent topilmadi");

  const svrUserId =
    input.actorRole === "supervisor"
      ? input.actorUserId
      : input.svrUserId ?? agent.supervisor_user_id ?? null;
  if (!svrUserId || svrUserId < 1) {
    throw new CoverError("NOT_FOUND", "SVR biriktirilmagan");
  }

  const svr = await prisma.user.findFirst({
    where: {
      id: svrUserId,
      tenant_id: input.tenantId,
      role: "supervisor",
      is_active: true
    },
    select: { id: true }
  });
  if (!svr) throw new CoverError("NOT_FOUND", "SVR topilmadi");

  assertLinkedPair(agent.supervisor_user_id, svr.id);

  if (
    input.actorUserId !== agent.id &&
    input.actorUserId !== svr.id
  ) {
    throw new CoverError("COVER_FORBIDDEN_ACTOR");
  }

  const coverDate = asDateOnly(input.coverDateIso);
  const existing = await prisma.agentSvrCover.findFirst({
    where: {
      tenant_id: input.tenantId,
      agent_user_id: agent.id,
      cover_date: coverDate,
      status: "faol"
    },
    select: { id: true }
  });
  assertOneActivePerDay(Boolean(existing));

  const created = await prisma.agentSvrCover.create({
    data: {
      tenant_id: input.tenantId,
      agent_user_id: agent.id,
      svr_user_id: svr.id,
      status: "kutilmoqda",
      cover_date: coverDate,
      requested_by_user_id: input.actorUserId
    }
  });
  return withCoverNames(input.tenantId, created);
}

export async function markCoverFace(input: {
  tenantId: number;
  userId: number;
  coverId: number;
  faceOk: boolean;
}) {
  const row = await prisma.agentSvrCover.findFirst({
    where: { id: input.coverId, tenant_id: input.tenantId }
  });
  if (!row) throw new CoverError("NOT_FOUND");
  if (row.status !== "kutilmoqda") {
    throw new CoverError("COVER_INVALID_TRANSITION");
  }

  if (input.faceOk) {
    const since = new Date(Date.now() - COVER_FACE_VERIFY_WINDOW_MS);
    const recent = await prisma.faceVerificationLog.findFirst({
      where: {
        tenant_id: input.tenantId,
        user_id: input.userId,
        context: "cover_accept",
        status: "approved",
        created_at: { gte: since }
      },
      select: { id: true }
    });
    if (!canTrustCoverFaceOkMark(true, Boolean(recent))) {
      throw new CoverError(
        COVER_FACE_REQUIRED,
        "cover_accept uchun haqiqiy Face ID verify kerak"
      );
    }
  }

  const data: { agent_face_ok?: boolean; svr_face_ok?: boolean } = {};
  if (input.userId === row.agent_user_id) data.agent_face_ok = input.faceOk;
  else if (input.userId === row.svr_user_id) data.svr_face_ok = input.faceOk;
  else throw new CoverError("COVER_FORBIDDEN_ACTOR");

  const updated = await prisma.agentSvrCover.update({
    where: { id: row.id },
    data
  });
  return withCoverNames(input.tenantId, updated);
}

export async function acceptCover(input: {
  tenantId: number;
  userId: number;
  coverId: number;
}) {
  const row = await prisma.agentSvrCover.findFirst({
    where: { id: input.coverId, tenant_id: input.tenantId }
  });
  if (!row) throw new CoverError("NOT_FOUND");

  const isAgent = input.userId === row.agent_user_id;
  const isSvr = input.userId === row.svr_user_id;
  if (!isAgent && !isSvr) throw new CoverError("COVER_FORBIDDEN_ACTOR");
  if (input.userId === row.requested_by_user_id) {
    throw new CoverError("COVER_FORBIDDEN_ACTOR", "Qarshi tomon qabul qiladi");
  }

  assertFacesForAccept(row.agent_face_ok, row.svr_face_ok);
  const next = transitionCover(
    row.status as CoverStatus,
    "ACCEPT",
    "counterparty"
  );

  const clash = await prisma.agentSvrCover.findFirst({
    where: {
      tenant_id: input.tenantId,
      agent_user_id: row.agent_user_id,
      cover_date: row.cover_date,
      status: "faol",
      NOT: { id: row.id }
    },
    select: { id: true }
  });
  assertOneActivePerDay(Boolean(clash));

  const updated = await prisma.agentSvrCover.update({
    where: { id: row.id },
    data: { status: next, accepted_at: new Date() }
  });
  return withCoverNames(input.tenantId, updated);
}

export async function endCover(input: {
  tenantId: number;
  userId: number;
  coverId: number;
}) {
  const row = await prisma.agentSvrCover.findFirst({
    where: { id: input.coverId, tenant_id: input.tenantId }
  });
  if (!row) throw new CoverError("NOT_FOUND");
  if (
    input.userId !== row.agent_user_id &&
    input.userId !== row.svr_user_id
  ) {
    throw new CoverError("COVER_FORBIDDEN_ACTOR");
  }
  const next = transitionCover(row.status as CoverStatus, "END", "svr");
  const updated = await prisma.agentSvrCover.update({
    where: { id: row.id },
    data: { status: next, ended_at: new Date() }
  });
  return withCoverNames(input.tenantId, updated);
}

export async function listMyCovers(input: {
  tenantId: number;
  userId: number;
}) {
  const rows = await prisma.agentSvrCover.findMany({
    where: {
      tenant_id: input.tenantId,
      OR: [{ agent_user_id: input.userId }, { svr_user_id: input.userId }]
    },
    orderBy: { created_at: "desc" },
    take: 50
  });
  return attachCoverNames(input.tenantId, rows);
}

export async function getActiveCover(input: {
  tenantId: number;
  userId: number;
}) {
  const row = await prisma.agentSvrCover.findFirst({
    where: {
      tenant_id: input.tenantId,
      status: "faol",
      OR: [{ agent_user_id: input.userId }, { svr_user_id: input.userId }]
    },
    orderBy: { accepted_at: "desc" }
  });
  if (!row) return null;
  return withCoverNames(input.tenantId, row);
}

/** Payroll: agent uchun faol cover kunlari (YYYY-MM-DD UTC). */
export async function listActiveCoverDatesForAgent(
  tenantId: number,
  agentUserId: number
): Promise<Set<string>> {
  const rows = await prisma.agentSvrCover.findMany({
    where: {
      tenant_id: tenantId,
      agent_user_id: agentUserId,
      status: { in: ["faol", "tugallandi"] }
    },
    select: { cover_date: true }
  });
  const out = new Set<string>();
  for (const r of rows) {
    const d = r.cover_date;
    out.add(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    );
  }
  return out;
}
