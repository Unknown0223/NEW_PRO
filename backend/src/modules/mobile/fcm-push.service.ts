import { env } from "../../config/env";
import { prisma } from "../../config/database";

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * FCM legacy HTTP API — `FCM_SERVER_KEY` bo‘lsa yuboradi, aks holda stub.
 */
export async function sendPushToUserTokens(
  tenantId: number,
  userId: number,
  payload: PushPayload
): Promise<{ sent: number; skipped: boolean }> {
  const tokens = await prisma.deviceToken.findMany({
    where: { tenant_id: tenantId, user_id: userId },
    select: { fcm_token: true }
  });
  if (tokens.length === 0) return { sent: 0, skipped: false };

  const key = env.FCM_SERVER_KEY?.trim();
  if (!key) return { sent: 0, skipped: true };

  let sent = 0;
  for (const row of tokens) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: row.fcm_token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {}
        })
      });
      if (res.ok) sent++;
    } catch {
      /* ignore per-token failures */
    }
  }
  return { sent, skipped: false };
}

export async function notifyAppUpdateToOutdatedUsers(
  tenantId: number,
  opts: { title?: string; body?: string; latestVersion?: string | null }
): Promise<{ users: number; tokens_sent: number; fcm_configured: boolean }> {
  const { listOutdatedMobileUsers } = await import("./app-release.service");
  const outdated = await listOutdatedMobileUsers(tenantId);
  const title = opts.title?.trim() || "Yangi versiya mavjud";
  const body =
    opts.body?.trim() ||
    (opts.latestVersion ? `Ilovani ${opts.latestVersion} versiyasiga yangilang` : "Ilovani yangilang");

  let tokensSent = 0;
  const key = env.FCM_SERVER_KEY?.trim();
  for (const u of outdated) {
    const r = await sendPushToUserTokens(tenantId, u.id, {
      title,
      body,
      data: { type: "app_update", latest_version: opts.latestVersion ?? "" }
    });
    tokensSent += r.sent;
  }

  return {
    users: outdated.length,
    tokens_sent: tokensSent,
    fcm_configured: Boolean(key)
  };
}
