import bcrypt from "bcryptjs";
import { getPool } from "./db.js";
import {
  findClientQualityIssue,
  type ClientQualityPeer
} from "./quality.js";
import type { BotRole, BotUser, ClientDraft } from "./types.js";

export type SalecAuthOk = {
  ok: true;
  user: Omit<BotUser, "telegram_id">;
};

export type SalecAuthFail = {
  ok: false;
  reason: "not_found" | "bad_creds" | "inactive" | "bad_role" | "bad_smart" | "empty_password";
  hint?: string;
};

function asRole(role: string): BotRole | null {
  // Lokal fallback: agent yoki yuklab oluvchi rollar (expeditor yo‘q)
  if (role === "agent") return "agent";
  if (role === "expeditor" || role === "gruzchik" || role === "driver") return null;
  if (role.trim()) return role;
  return null;
}

export function normSmart(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-]+/g, "");
}

type StaffRow = {
  id: number;
  tenant_id: number;
  name: string;
  login: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  code: string | null;
  supervisor_user_id: number | null;
};

async function findStaff(
  databaseUrl: string,
  tenantSlug: string,
  identity: string
): Promise<StaffRow | null> {
  const db = getPool(databaseUrl);
  const ident = identity.trim();
  if (!ident) return null;
  const identSql = `(
    lower(btrim(u.login)) = lower($1)
    OR (u.code IS NOT NULL AND lower(btrim(u.code)) = lower($1))
    OR EXISTS (
      SELECT 1
      FROM slot_user_links sul
      JOIN work_slots ws ON ws.id = sul.slot_id
      WHERE sul.user_id = u.id AND sul.ended_at IS NULL AND ws.deleted_at IS NULL
        AND lower(btrim(ws.slot_code)) = lower($1)
    )
  )`;
  const scoped = await db.query<StaffRow>(
    `SELECT u.id, u.tenant_id, u.name, u.login, u.password_hash, u.role, u.is_active, u.code, u.supervisor_user_id
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE t.slug = $2 AND ${identSql}
     LIMIT 1`,
    [ident, tenantSlug]
  );
  if (scoped.rows[0]) return scoped.rows[0];
  const any = await db.query<StaffRow>(
    `SELECT u.id, u.tenant_id, u.name, u.login, u.password_hash, u.role, u.is_active, u.code, u.supervisor_user_id
     FROM users u
     WHERE ${identSql}
     LIMIT 1`,
    [ident]
  );
  return any.rows[0] ?? null;
}

export async function authenticateStaff(
  databaseUrl: string,
  tenantSlug: string,
  login: string,
  password: string,
  smartCode: string
): Promise<SalecAuthOk | SalecAuthFail> {
  const row = await findStaff(databaseUrl, tenantSlug, login);
  if (!row) return { ok: false, reason: "not_found" };
  if (!password) return { ok: false, reason: "empty_password" };
  const passOk = await bcrypt.compare(password, row.password_hash);
  if (!passOk) return { ok: false, reason: "bad_creds" };
  if (!row.is_active) return { ok: false, reason: "inactive" };
  const role = asRole(row.role);
  if (!role) return { ok: false, reason: "bad_role" };

  const want = normSmart(smartCode);
  const db = getPool(databaseUrl);
  const slots = await db.query<{ slot_code: string; slot_type: string }>(
    `SELECT ws.slot_code, ws.slot_type
     FROM slot_user_links sul
     JOIN work_slots ws ON ws.id = sul.slot_id
     WHERE sul.user_id = $1 AND sul.ended_at IS NULL AND ws.deleted_at IS NULL AND ws.tenant_id = $2`,
    [row.id, row.tenant_id]
  );
  const hit = slots.rows.find((s) => normSmart(s.slot_code) === want);
  if (!hit) {
    const codes = slots.rows.map((s) => s.slot_code.trim()).filter(Boolean);
    return { ok: false, reason: "bad_smart", hint: codes.join(", ") };
  }

  return {
    ok: true,
    user: {
      tenant_id: row.tenant_id,
      salec_user_id: row.id,
      role,
      can_add_clients: role === "agent",
      can_download_intake: role !== "agent",
      login: row.login,
      smart_code: hit.slot_code,
      agent_code: row.code,
      display_name: row.name,
      supervisor_user_id: row.supervisor_user_id
    }
  };
}

export async function loadSuperviseeAgentIds(
  databaseUrl: string,
  tenantId: number,
  supervisorUserId: number
): Promise<number[]> {
  const db = getPool(databaseUrl);
  const byUser = await db.query<{ id: number }>(
    `SELECT id FROM users
     WHERE tenant_id = $1 AND is_active = true AND role = 'agent' AND supervisor_user_id = $2`,
    [tenantId, supervisorUserId]
  );
  const ids = new Set(byUser.rows.map((r) => r.id));
  const bySlot = await db.query<{ user_id: number }>(
    `SELECT sul.user_id
     FROM work_slots ws
     JOIN slot_user_links svr
       ON svr.slot_id = ws.id AND svr.ended_at IS NULL AND svr.user_id = $2
     JOIN slot_user_links sul
       ON sul.slot_id = ANY(ws.supervisee_agent_slot_ids) AND sul.ended_at IS NULL
     WHERE ws.tenant_id = $1 AND ws.slot_type = 'supervisor' AND ws.deleted_at IS NULL`,
    [tenantId, supervisorUserId]
  );
  for (const r of bySlot.rows) ids.add(r.user_id);
  ids.add(supervisorUserId);
  return [...ids];
}

export { loadTenantRefs, refsForField, type TenantRefs } from "./salec-refs.js";

export async function uniquenessPeers(
  databaseUrl: string,
  tenantId: number,
  draft: ClientDraft
): Promise<ClientQualityPeer[]> {
  const db = getPool(databaseUrl);
  const phone = draft.phone.replace(/\D/g, "");
  const inn = draft.inn.trim();
  const pinfl = draft.pinfl.trim();
  const r = await db.query<{
    id: number;
    name: string;
    phone_normalized: string | null;
    inn: string | null;
    client_pinfl: string | null;
    latitude: string | null;
    longitude: string | null;
  }>(
    `SELECT id, name, phone_normalized, inn, client_pinfl, latitude::text, longitude::text
     FROM clients
     WHERE tenant_id = $1 AND merged_into_client_id IS NULL
       AND (
         ($2 <> '' AND phone_normalized = $2)
         OR ($3 <> '' AND lower(inn) = lower($3))
         OR ($4 <> '' AND lower(client_pinfl) = lower($4))
         OR (
           $5::float8 IS NOT NULL AND $6::float8 IS NOT NULL
           AND latitude BETWEEN $5::float8 - 0.002 AND $5::float8 + 0.002
           AND longitude BETWEEN $6::float8 - 0.002 AND $6::float8 + 0.002
         )
       )
     LIMIT 200`,
    [tenantId, phone.length >= 7 ? phone : "", inn, pinfl, draft.lat, draft.lon]
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    phoneDigits: row.phone_normalized,
    inn: row.inn,
    pinfl: row.client_pinfl,
    lat: row.latitude == null ? null : Number(row.latitude),
    lon: row.longitude == null ? null : Number(row.longitude)
  }));
}

export async function checkDraftAgainstSalec(
  databaseUrl: string,
  tenantId: number,
  draft: ClientDraft,
  extra: ClientQualityPeer[]
): Promise<string | null> {
  const peers = [...(await uniquenessPeers(databaseUrl, tenantId, draft)), ...extra];
  const issue = findClientQualityIssue(
    {
      name: draft.name,
      phoneDigits: draft.phone,
      inn: draft.inn,
      pinfl: draft.pinfl,
      lat: draft.lat,
      lon: draft.lon
    },
    peers
  );
  return issue?.message ?? null;
}
