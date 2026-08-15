/**
 * Reset operator password + HTTP-verify /orders scope.
 *   npx tsx scripts/fix-operator-http-orders-scope.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/database";

const BASE = process.env.API_BASE ?? "http://127.0.0.1:18080";
const PASS = "secret123";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "test1" } });
  if (!tenant) throw new Error("no tenant");
  const op = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: "operator" }
  });
  if (!op) throw new Error("no operator");

  const hash = await bcrypt.hash(PASS, 10);
  await prisma.user.update({
    where: { id: op.id },
    data: { password_hash: hash, is_active: true }
  });

  // Ensure only agent 5 (named Agent) is bound — matches Diagnose
  await prisma.user.updateMany({
    where: { tenant_id: tenant.id, supervisor_user_id: op.id },
    data: { supervisor_user_id: null }
  });
  const agent = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, role: "agent", name: "Agent" }
  });
  if (!agent) throw new Error("no Agent user");
  await prisma.user.update({
    where: { id: agent.id },
    data: { supervisor_user_id: op.id }
  });
  console.log("bound only", agent.id, agent.name);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "test1", login: "operator", password: PASS })
  });
  const loginBody = await login.json();
  console.log("login", login.status, loginBody.error ?? "ok", "role=", loginBody.user?.role);
  if (login.status !== 200) {
    console.log(JSON.stringify(loginBody));
    process.exit(1);
  }
  const token = loginBody.accessToken as string;

  const agents = await fetch(`${BASE}/api/test1/agents`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const agentsBody = await agents.json();
  const alist = agentsBody.data ?? agentsBody;
  console.log(
    "GET /agents",
    agents.status,
    Array.isArray(alist) ? alist.map((a: any) => `${a.id}:${a.name || a.login}`) : alist
  );

  const orders = await fetch(
    `${BASE}/api/test1/orders?date_from=2026-07-01&date_to=2026-07-31&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const ordersBody = await orders.json();
  const rows = ordersBody.data ?? [];
  const agentSet = [...new Set(rows.map((r: any) => `${r.agent_id}:${r.agent_name ?? "?"}`))];
  console.log("GET /orders", orders.status, "total=", ordersBody.total, "agents=", agentSet);

  const foreign = rows.filter((r: any) => r.agent_id != null && Number(r.agent_id) !== agent.id);
  if (foreign.length) {
    console.error("LEAK", foreign.length, foreign.slice(0, 5).map((r: any) => r.agent_id));
    process.exit(2);
  }
  console.log("HTTP scope OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
