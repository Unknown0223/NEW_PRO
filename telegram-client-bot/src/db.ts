import pg from "pg";
import type { BotUser, ClientDraft, SessionData, StoredClient } from "./types.js";
import { EMPTY_SESSION } from "./types.js";

let pool: pg.Pool | null = null;

export function getPool(databaseUrl: string): pg.Pool {
  if (!pool) {
    const publicProxy = /rlwy\.net/i.test(databaseUrl);
    pool = new pg.Pool({
      connectionString: databaseUrl.replace(/[?&]sslmode=[^&]+/g, "").replace(/\?$/, ""),
      max: 8,
      ssl: publicProxy ? { rejectUnauthorized: false } : undefined
    });
  }
  return pool;
}

export async function ensureBotSchema(databaseUrl: string): Promise<void> {
  const db = getPool(databaseUrl);
  await db.query(`CREATE SCHEMA IF NOT EXISTS client_intake`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS client_intake.bot_users (
      telegram_id BIGINT PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      salec_user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      login TEXT NOT NULL,
      smart_code TEXT NOT NULL,
      agent_code TEXT,
      display_name TEXT,
      supervisor_user_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, salec_user_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS client_intake.bot_clients (
      id BIGSERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      agent_user_id INTEGER NOT NULL,
      agent_telegram_id BIGINT NOT NULL,
      agent_smart_code TEXT NOT NULL,
      agent_code TEXT,
      agent_name TEXT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS bot_clients_agent ON client_intake.bot_clients (tenant_id, agent_user_id)`
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS client_intake.bot_sessions (
      telegram_id BIGINT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function loadSession(databaseUrl: string, telegramId: number): Promise<SessionData> {
  const r = await getPool(databaseUrl).query<{ data: SessionData }>(
    `SELECT data FROM client_intake.bot_sessions WHERE telegram_id = $1`,
    [telegramId]
  );
  const data = r.rows[0]?.data;
  if (!data || typeof data !== "object") return EMPTY_SESSION();
  return { ...EMPTY_SESSION(), ...data, draft: data.draft ?? {} };
}

export async function saveSession(
  databaseUrl: string,
  telegramId: number,
  data: SessionData
): Promise<void> {
  await getPool(databaseUrl).query(
    `INSERT INTO client_intake.bot_sessions (telegram_id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (telegram_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [telegramId, JSON.stringify(data)]
  );
}

export async function upsertBotUser(databaseUrl: string, user: BotUser): Promise<void> {
  await getPool(databaseUrl).query(
    `INSERT INTO client_intake.bot_users
      (telegram_id, tenant_id, salec_user_id, role, login, smart_code, agent_code, display_name, supervisor_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (telegram_id) DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       salec_user_id = EXCLUDED.salec_user_id,
       role = EXCLUDED.role,
       login = EXCLUDED.login,
       smart_code = EXCLUDED.smart_code,
       agent_code = EXCLUDED.agent_code,
       display_name = EXCLUDED.display_name,
       supervisor_user_id = EXCLUDED.supervisor_user_id`,
    [
      user.telegram_id,
      user.tenant_id,
      user.salec_user_id,
      user.role,
      user.login,
      user.smart_code,
      user.agent_code,
      user.display_name,
      user.supervisor_user_id
    ]
  );
}

export async function deleteBotUser(databaseUrl: string, telegramId: number): Promise<void> {
  const dbp = getPool(databaseUrl);
  await dbp.query(`DELETE FROM client_intake.bot_sessions WHERE telegram_id = $1`, [telegramId]);
  await dbp.query(`DELETE FROM client_intake.bot_users WHERE telegram_id = $1`, [telegramId]);
}

export async function getBotUser(databaseUrl: string, telegramId: number): Promise<BotUser | null> {
  const r = await getPool(databaseUrl).query<{
    telegram_id: number;
    tenant_id: number;
    salec_user_id: number;
    role: string;
    login: string;
    smart_code: string;
    agent_code: string | null;
    display_name: string | null;
    supervisor_user_id: number | null;
  }>(
    `SELECT telegram_id, tenant_id, salec_user_id, role, login, smart_code, agent_code, display_name, supervisor_user_id
     FROM client_intake.bot_users WHERE telegram_id = $1`,
    [telegramId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const role = String(row.role ?? "");
  return {
    ...row,
    telegram_id: Number(row.telegram_id),
    role,
    can_add_clients: role === "agent",
    can_download_intake: role !== "agent"
  };
}

export async function insertClient(
  databaseUrl: string,
  row: {
    tenant_id: number;
    agent_user_id: number;
    agent_telegram_id: number;
    agent_smart_code: string;
    agent_code: string | null;
    agent_name: string | null;
    payload: ClientDraft;
  }
): Promise<void> {
  await getPool(databaseUrl).query(
    `INSERT INTO client_intake.bot_clients
      (tenant_id, agent_user_id, agent_telegram_id, agent_smart_code, agent_code, agent_name, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      row.tenant_id,
      row.agent_user_id,
      row.agent_telegram_id,
      row.agent_smart_code,
      row.agent_code,
      row.agent_name,
      JSON.stringify(row.payload)
    ]
  );
}

export async function listClientsForTenant(
  databaseUrl: string,
  tenantId: number
): Promise<StoredClient[]> {
  const r = await getPool(databaseUrl).query<StoredClient>(
    `SELECT id, agent_user_id, agent_telegram_id, agent_smart_code, agent_code, agent_name, payload, created_at::text
     FROM client_intake.bot_clients WHERE tenant_id = $1 ORDER BY id`,
    [tenantId]
  );
  return r.rows;
}

export async function listClientsByAgents(
  databaseUrl: string,
  tenantId: number,
  agentUserIds: number[]
): Promise<StoredClient[]> {
  if (agentUserIds.length === 0) return [];
  const r = await getPool(databaseUrl).query<StoredClient>(
    `SELECT id, agent_user_id, agent_telegram_id, agent_smart_code, agent_code, agent_name, payload, created_at::text
     FROM client_intake.bot_clients
     WHERE tenant_id = $1 AND agent_user_id = ANY($2::int[])
     ORDER BY agent_user_id, id`,
    [tenantId, agentUserIds]
  );
  return r.rows;
}

export async function deleteClientsByIds(databaseUrl: string, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await getPool(databaseUrl).query(`DELETE FROM client_intake.bot_clients WHERE id = ANY($1::bigint[])`, [
    ids
  ]);
}

export async function countByAgent(
  databaseUrl: string,
  tenantId: number,
  agentUserId: number
): Promise<number> {
  const r = await getPool(databaseUrl).query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM client_intake.bot_clients WHERE tenant_id = $1 AND agent_user_id = $2`,
    [tenantId, agentUserId]
  );
  return Number(r.rows[0]?.n ?? 0);
}
