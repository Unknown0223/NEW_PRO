// SVR "yangi mijoz" E2E: real HTTPS API orqali (RBAC + marshrut + servis).
// Backend konteyner ichida: node /tmp/svr-e2e.cjs
// Parol o'zgartirilmaydi: vaqtinchalik refresh sessiya qo'shiladi va oxirida o'chiriladi.
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const API = process.env.E2E_API || "https://api.salesarena.sale";
const SLUG = process.env.E2E_SLUG || "aksit";
const DEVICE = "cutover-e2e-test";
const prisma = new PrismaClient();

function b64u(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function signJwt(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 600 };
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const data = `${head}.${b64u(JSON.stringify(body))}`;
  const sig = b64u(crypto.createHmac("sha256", process.env.JWT_ACCESS_SECRET).update(data).digest());
  return `${data}.${sig}`;
}
async function call(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: SLUG } });
  if (!tenant) throw new Error("tenant not found");
  const svrs = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "supervisor", is_active: true },
    select: { id: true, login: true, name: true },
    orderBy: { id: "asc" }
  });
  console.log(`supervisors=${svrs.length}`);

  const tokenIds = [];
  let createdClientId = null;
  try {
    for (const s of svrs) {
      const rt = await prisma.refreshToken.create({
        data: {
          tenant_id: tenant.id,
          user_id: s.id,
          token_hash: crypto.randomBytes(32).toString("hex"),
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
          device_id: DEVICE,
          device_name: "cutover e2e"
        }
      });
      tokenIds.push(rt.id);
      const token = signJwt({ sub: String(s.id), tenantId: tenant.id, role: "supervisor", login: s.login, tenantSlug: SLUG, did: DEVICE });

      const agents = await call(token, "GET", `/api/${SLUG}/mobile/supervisor/agents`);
      const list = Array.isArray(agents.json?.data) ? agents.json.data : [];
      console.log(`SVR #${s.id} ${s.name}: GET agents -> ${agents.status}, count=${list.length}`);
      if (agents.status !== 200 || list.length === 0) continue;
      console.log("  agents sample:", JSON.stringify(list.slice(0, 3)));

      const clients = await call(token, "GET", `/api/${SLUG}/mobile/supervisor/clients?limit=5`);
      console.log(`  GET clients -> ${clients.status}, count=${clients.json?.data?.length ?? "?"}`);

      for (const a of list) {
        const agentId = a.id ?? a.agent_id;
        const body = {
          agent_id: agentId,
          name: `E2E TEST SVR ${Date.now()}`,
          phone: "+998900000000",
          latitude: 41.311081,
          longitude: 69.240562,
          address: "E2E test",
          visit_weekdays: [1]
        };
        const created = await call(token, "POST", `/api/${SLUG}/mobile/supervisor/clients`, body);
        console.log(`  POST client agent=${agentId} -> ${created.status} ${JSON.stringify(created.json).slice(0, 300)}`);
        if (created.status === 201) {
          createdClientId = created.json?.id ?? created.json?.data?.id ?? created.json?.client?.id ?? null;
          if (!createdClientId) {
            const c = await prisma.client.findFirst({ where: { tenant_id: tenant.id, name: body.name }, select: { id: true } });
            createdClientId = c?.id ?? null;
          }
          const db = await prisma.client.findUnique({
            where: { id: createdClientId },
            select: { id: true, name: true, agent_id: true, is_active: true }
          });
          const asg = await prisma.clientAgentAssignment.findMany({ where: { client_id: createdClientId }, select: { slot: true, agent_id: true, work_slot_id: true, visit_weekdays: true } });
          console.log("  DB client:", JSON.stringify(db));
          console.log("  DB assignments:", JSON.stringify(asg));
          const after = await call(token, "GET", `/api/${SLUG}/mobile/supervisor/clients?limit=500&q=${encodeURIComponent("E2E TEST SVR")}`);
          const seen = (after.json?.data ?? []).some((c) => c.id === createdClientId);
          console.log(`  visible in SVR list: ${seen}`);
          console.log(db && db.agent_id === agentId && asg.some((x) => x.agent_id === agentId) ? "E2E_OK" : "E2E_MISMATCH");
          return;
        }
      }
    }
    console.log("E2E_NO_SUCCESS");
  } finally {
    if (createdClientId) {
      await prisma.clientAgentAssignment.deleteMany({ where: { client_id: createdClientId } }).catch((e) => console.log("cleanup asg:", e.message));
      await prisma.client.delete({ where: { id: createdClientId } }).then(
        () => console.log(`cleanup: test client ${createdClientId} deleted`),
        async (e) => {
          console.log("cleanup hard delete failed:", e.message.slice(0, 200));
          await prisma.client.update({ where: { id: createdClientId }, data: { is_active: false, name: `DELETED E2E ${createdClientId}` } }).catch(() => {});
        }
      );
    }
    await prisma.refreshToken.deleteMany({ where: { id: { in: tokenIds } } });
    console.log(`cleanup: ${tokenIds.length} temp sessions removed`);
  }
}

main()
  .catch((e) => { console.error("E2E_ERROR", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
