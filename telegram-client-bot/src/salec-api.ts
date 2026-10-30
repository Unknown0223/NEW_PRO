import type { BotUser } from "./types.js";

export type StaffApiFail = {
  ok: false;
  reason: string;
  message: string;
  hint?: string;
};

export type StaffApiOk = { ok: true; user: Omit<BotUser, "telegram_id"> };

export type IntakeScopeDto = {
  unrestricted: boolean;
  agent_ids: number[];
  territory_ids: number[];
  bound_staff_ids: number[];
};

type ApiCfg = { apiUrl: string; apiSecret: string; tenantSlug: string };

async function botFetch(
  cfg: ApiCfg,
  path: string,
  body: Record<string, unknown>
): Promise<{ status: number; json: Record<string, unknown> }> {
  const url = `${cfg.apiUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-secret": cfg.apiSecret
    },
    body: JSON.stringify(body)
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

function failFrom(status: number, json: Record<string, unknown>): StaffApiFail {
  const code = typeof json.error === "string" ? json.error : "";
  const message =
    typeof json.message === "string" && json.message.trim()
      ? json.message
      : "Platforma API xatosi.";
  return {
    ok: false,
    reason: code || `http_${status}`,
    message,
    hint: typeof json.hint === "string" ? json.hint : undefined
  };
}

function userFrom(json: Record<string, unknown>): Omit<BotUser, "telegram_id"> | null {
  const wrapped = json.user as Record<string, unknown> | undefined;
  const u = wrapped ?? json;
  if (typeof u.salec_user_id !== "number" || typeof u.login !== "string") return null;
  const role = String(u.role ?? "");
  const canAdd =
    typeof u.can_add_clients === "boolean" ? u.can_add_clients : role === "agent";
  const canDl =
    typeof u.can_download_intake === "boolean" ? u.can_download_intake : role !== "agent";
  return {
    tenant_id: Number(u.tenant_id),
    salec_user_id: Number(u.salec_user_id),
    role,
    can_add_clients: canAdd,
    can_download_intake: canDl,
    login: String(u.login),
    smart_code: String(u.smart_code ?? ""),
    agent_code: u.agent_code == null ? null : String(u.agent_code),
    display_name: u.display_name == null ? null : String(u.display_name),
    supervisor_user_id: u.supervisor_user_id == null ? null : Number(u.supervisor_user_id)
  };
}

export async function apiLookupStaff(
  cfg: ApiCfg,
  telegramId: number
): Promise<StaffApiOk | StaffApiFail | { ok: false; reason: "unbound"; message: string }> {
  try {
    const { status, json } = await botFetch(cfg, "/api/telegram-bot/staff/lookup", {
      telegram_id: telegramId
    });
    if (status === 200) {
      const user = userFrom(json);
      if (!user) return { ok: false, reason: "bad_payload", message: "API javobi noto‘g‘ri." };
      return { ok: true, user };
    }
    const f = failFrom(status, json);
    if (f.reason === "unbound" || status === 404) {
      return { ok: false, reason: "unbound", message: f.message };
    }
    return f;
  } catch {
    return { ok: false, reason: "api_down", message: "Platforma API ga ulanib bo‘lmadi. Keyinroq urinib ko‘ring." };
  }
}

export async function apiRegisterStaff(
  cfg: ApiCfg,
  input: { login: string; password: string; smartCode: string; telegramId: number }
): Promise<StaffApiOk | StaffApiFail> {
  try {
    const { status, json } = await botFetch(cfg, "/api/telegram-bot/staff/register", {
      slug: cfg.tenantSlug,
      login: input.login,
      password: input.password,
      smart_code: input.smartCode,
      telegram_id: input.telegramId
    });
    if (status === 200) {
      const user = userFrom(json);
      if (!user) return { ok: false, reason: "bad_payload", message: "API javobi noto‘g‘ri." };
      return { ok: true, user };
    }
    return failFrom(status, json);
  } catch {
    return { ok: false, reason: "api_down", message: "Platforma API ga ulanib bo‘lmadi. Keyinroq urinib ko‘ring." };
  }
}

export async function apiIntakeScope(
  cfg: ApiCfg,
  telegramId: number
): Promise<{ ok: true; scope: IntakeScopeDto } | StaffApiFail> {
  try {
    const { status, json } = await botFetch(cfg, "/api/telegram-bot/staff/intake-scope", {
      telegram_id: telegramId
    });
    if (status === 200) {
      const scope = json.scope as IntakeScopeDto | undefined;
      if (!scope || !Array.isArray(scope.agent_ids)) {
        return { ok: false, reason: "bad_payload", message: "Scope javobi noto‘g‘ri." };
      }
      return {
        ok: true,
        scope: {
          unrestricted: Boolean(scope.unrestricted),
          agent_ids: scope.agent_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0),
          territory_ids: Array.isArray(scope.territory_ids)
            ? scope.territory_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
            : [],
          bound_staff_ids: Array.isArray(scope.bound_staff_ids)
            ? scope.bound_staff_ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)
            : []
        }
      };
    }
    return failFrom(status, json);
  } catch {
    return { ok: false, reason: "api_down", message: "Platforma API ga ulanib bo‘lmadi. Keyinroq urinib ko‘ring." };
  }
}
