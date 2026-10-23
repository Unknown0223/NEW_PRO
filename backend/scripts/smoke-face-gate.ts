/**
 * Face hard-gate: face yoqilganda payment API log siz 403.
 * Vaqtincha agent misc.face_verification_enabled ni yoqadi, keyin qaytaradi.
 *   npx tsx scripts/smoke-face-gate.ts
 */
import { prisma } from "../src/config/database";

const API = process.env.API_BASE || "http://127.0.0.1:18080";
const SLUG = process.env.TENANT_SLUG || "test1";
const AGENT_LOGIN = process.env.AGENT_LOGIN || "agent";
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || "111111";

async function json(res: Response) {
  const t = await res.text();
  try {
    return { status: res.status, body: JSON.parse(t) as Record<string, unknown> };
  } catch {
    return { status: res.status, body: { raw: t } as Record<string, unknown> };
  }
}

async function login(login: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: SLUG,
      login,
      password,
      device_name: "face-gate-smoke",
      device_id: `face-gate-smoke-${login}`
    })
  });
  const out = await json(res);
  const token = (out.body.accessToken || out.body.access_token) as string | undefined;
  if (out.status >= 400 || !token) {
    throw new Error(`login ${out.status} ${JSON.stringify(out.body)}`);
  }
  return token;
}

async function main() {
  const agent = await prisma.user.findFirst({
    where: { login: AGENT_LOGIN, tenant: { slug: SLUG } },
    select: { id: true, agent_entitlements: true }
  });
  if (!agent) throw new Error("agent not found");

  const prev = agent.agent_entitlements;
  const ent =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? (structuredClone(prev) as Record<string, unknown>)
      : {};
  const mc =
    ent.mobile_config && typeof ent.mobile_config === "object" && !Array.isArray(ent.mobile_config)
      ? (ent.mobile_config as Record<string, unknown>)
      : { schema_version: 1 };
  const misc =
    mc.misc && typeof mc.misc === "object" && !Array.isArray(mc.misc)
      ? (mc.misc as Record<string, unknown>)
      : {};
  misc.face_verification_enabled = true;
  mc.misc = misc;
  ent.mobile_config = mc;

  try {
    await prisma.user.update({
      where: { id: agent.id },
      data: { agent_entitlements: ent }
    });

    const token = await login(AGENT_LOGIN, AGENT_PASSWORD);
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    };

    const status = await json(await fetch(`${API}/api/${SLUG}/mobile/me/face/status`, { headers }));
    console.log("face enabled?", (status.body.policy as { enabled?: boolean })?.enabled);

    const check = await json(
      await fetch(`${API}/api/${SLUG}/mobile/me/face/check-required`, {
        method: "POST",
        headers,
        body: JSON.stringify({ context: "payment_accept" })
      })
    );
    console.log("check payment_accept", check.status, check.body);
    if (check.body.required !== true) {
      throw new Error("expected required=true after enabling face");
    }

    const pay = await json(
      await fetch(`${API}/api/${SLUG}/mobile/payments/order-cash-in`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          client_id: 1,
          lines: [{ order_id: 1, payment_type: "cash", amount: 1 }]
        })
      })
    );
    console.log("payment without face", pay.status, pay.body.error || pay.body.code || pay.body);
    if (pay.status !== 403) {
      throw new Error(`expected FACE gate 403, got ${pay.status}`);
    }
    const code = String(pay.body.error || pay.body.code || "");
    if (!code.includes("FACE")) {
      throw new Error(`expected FACE_* error code, got ${code}`);
    }
    console.log("SMOKE PASS face-gate");
  } finally {
    await prisma.user.update({
      where: { id: agent.id },
      data: { agent_entitlements: prev as object }
    });
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
