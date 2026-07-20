/**
 * Over-grant audit (READ-ONLY for production behavior — only patches a test operator
 * temporarily, then restores personal allow/deny to empty).
 *
 * Default MODE=db — uses Prisma + same resolveUserPermissionKeys as me-permissions
 * (avoids auth rate-limits). Optional MODE=http for live login/me-permissions.
 *
 * For each sample permission key:
 *   1) lean baseline = deny role/preset universe + clear personal allows
 *   2) grant ONE key
 *   3) resolve effective keys
 *   4) evaluate UI capability flags (mirrors frontend gates)
 *   5) report when grant X also unlocks Y that should need a separate key
 *
 * Usage:
 *   cd backend && npm run access:audit:overgrant
 *   MODE=http npm run access:audit:overgrant
 *
 * Env:
 *   MODE=db|http (default db)
 *   API_BASE=http://127.0.0.1:18080
 *   SLUG=test1
 *   OPERATOR_LOGIN=operator
 *   KEEP_OVERRIDES=1  — do not restore operator personal layer after run
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/config/database";
import { applyAccessUserPatchBody } from "../src/modules/access/access-user-patch.apply";
import { expandPermissionKeyAliases } from "../src/modules/access/legacy-key-map";
import { resolveUserPermissionKeys } from "../src/modules/access/rbac.resolve";
import { buildRoleDefaultKeys, rolesWithPresets } from "../src/modules/access/role-permission-presets";

const MODE = (process.env.MODE ?? "db").toLowerCase();
const BASE = (process.env.API_BASE ?? "http://127.0.0.1:18080").replace(/\/$/, "");
const SLUG = process.env.SLUG ?? "test1";
const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "secret123";
const OPERATOR_LOGIN = process.env.OPERATOR_LOGIN ?? "operator";
const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD ?? "secret123";
const KEEP_OVERRIDES = process.env.KEEP_OVERRIDES === "1";

/** Keys granted one-by-one (warehouse + cash + staff.agent + clients/orders samples). */
const GRANT_PROBE_KEYS = [
  // warehouse.sklady
  "warehouse.sklady.view",
  "warehouse.sklady.create",
  "warehouse.sklady.update",
  "warehouse.sklady.delete",
  "warehouse.sklady.history",
  // warehouse companions / siblings
  "warehouse.view",
  "warehouse.ostatki.view",
  "warehouse.bloki.view",
  "warehouse.postuplenie.view",
  // cash.kassa
  "cash.kassa.view",
  "cash.view",
  "cash.kassa.create",
  "cash.kassa.history",
  "cash.kassa.status",
  // cash payments
  "cash.oplaty_klientov.view",
  "cash.oplaty_klientov.history",
  "cash.oplaty_klientov.create",
  "cash.otchety.view",
  "reports.view",
  // staff.agent
  "staff.agent.view",
  "staff.agent.spisok_agentov",
  "staff.agent.create",
  "staff.agent.update",
  "staff.agent.history",
  "staff.agent.activate",
  "staff.agent.copy",
  // clients / orders / dashboards (nav OR over-open)
  "clients.klient.view",
  "clients.view",
  "orders.zakaz.view",
  "orders.view",
  "orders.zakaz.create",
  "orders.obmen_i_otkaz.view",
  "dashboard.prodazhi.view",
  "dashboard.plan_fakt.view",
  "gps.gps.view"
] as const;

/** Frontend NAV_PERM mirror (nav-permission-keys.ts). */
const NAV_PERM = {
  stockWarehouses: ["warehouse.sklady.view"],
  stockBlocks: ["warehouse.bloki.view"],
  stockBalances: ["warehouse.ostatki.view", "warehouse.ostatki_tovarov.view"],
  stockReceipts: ["warehouse.postuplenie.view", "warehouse.postuplenie_sklada.view"],
  cashDesks: ["cash.kassa.view", "cash.view"],
  cashPayments: ["cash.oplaty_klientov.view"],
  cashReports: ["cash.otchety.view"],
  cashReportsOrOrders: ["cash.otchety.view"],
  staffAgent: ["staff.agent.view", "staff.agent.spisok_agentov", "staff.agent.prosmotr_agenta"],
  staffSkladchik: ["staff.skladchik.view"],
  staffConsignment: ["staff.konsignatsiya.view"],
  clients: ["clients.klient.view", "clients.view"],
  clientsRetailStock: ["warehouse.ostatki.view"],
  visitPlanner: ["gps.gps.view", "gps.dostup_k_gps"],
  ordersView: ["orders.zakaz.view", "orders.view"],
  ordersCreate: ["orders.zakaz.create", "orders.create"],
  exchangeCreateNav: ["orders.obmen_i_otkaz.create"],
  planFaktMonitoring: ["dashboard.plan_fakt.view", "dashboard.plan_fakt"],
  salesDash: ["dashboard.prodazhi.view", "dashboard.prodazhi"]
} as const;

type CapFlag = { id: string; label: string; okForGrant: (granted: string) => boolean; trueWhen: (keys: Set<string>) => boolean };

function hasAny(keys: Set<string>, list: readonly string[]): boolean {
  return list.some((k) => keys.has(k));
}

/** UI capability flags — must match frontend pages/workspaces. */
const CAP_FLAGS: CapFlag[] = [
  {
    id: "nav.stock.warehouses",
    label: "Sidebar: Склад",
    okForGrant: (g) => g === "warehouse.sklady.view" || g === "warehouse.sklady.spisok",
    trueWhen: (k) => hasAny(k, NAV_PERM.stockWarehouses)
  },
  {
    id: "ui.warehouse.addViaCanWrite",
    label: "Склад: Add button (canCreate only)",
    okForGrant: (g) => g === "warehouse.sklady.create",
    trueWhen: (k) => k.has("warehouse.sklady.create")
  },
  {
    id: "ui.warehouse.editViaCanWrite",
    label: "Склад: Edit/Pencil (canUpdate only)",
    okForGrant: (g) => g === "warehouse.sklady.update",
    trueWhen: (k) => k.has("warehouse.sklady.update")
  },
  {
    id: "ui.warehouse.canExport",
    label: "Склад: Excel (history|copy)",
    okForGrant: (g) => g === "warehouse.sklady.history" || g === "warehouse.sklady.copy",
    trueWhen: (k) => k.has("warehouse.sklady.history") || k.has("warehouse.sklady.copy")
  },
  {
    id: "nav.staff.skladchik",
    label: "Sidebar: Пользователи → Складчик",
    okForGrant: (g) => g === "staff.skladchik.view",
    trueWhen: (k) => hasAny(k, NAV_PERM.staffSkladchik)
  },
  {
    id: "nav.stock.balances",
    label: "Sidebar: Остатки",
    okForGrant: (g) => g === "warehouse.ostatki.view" || g === "warehouse.view",
    trueWhen: (k) => hasAny(k, NAV_PERM.stockBalances)
  },
  {
    id: "nav.cash.desks",
    label: "Sidebar: Касса",
    okForGrant: (g) => g === "cash.kassa.view" || g === "cash.view" || g === "cash.spisok_kassy",
    trueWhen: (k) => hasAny(k, NAV_PERM.cashDesks)
  },
  {
    id: "ui.cash.canWrite",
    label: "Касса: Add/Edit (canWrite=create)",
    okForGrant: (g) => g === "cash.kassa.create",
    trueWhen: (k) => k.has("cash.kassa.create")
  },
  {
    id: "ui.cash.canHistory",
    label: "Касса: History",
    okForGrant: (g) => g === "cash.kassa.history",
    trueWhen: (k) => k.has("cash.kassa.history")
  },
  {
    id: "ui.cash.canExport",
    label: "Касса: Excel (create||history)",
    okForGrant: (g) => g === "cash.kassa.create" || g === "cash.kassa.history",
    trueWhen: (k) => k.has("cash.kassa.create") || k.has("cash.kassa.history")
  },
  {
    id: "ui.payments.historyFromView",
    label: "Оплаты: History button (history only)",
    okForGrant: (g) => g === "cash.oplaty_klientov.history",
    trueWhen: (k) => k.has("cash.oplaty_klientov.history")
  },
  {
    id: "nav.cash.reports",
    label: "Sidebar: Касса отчёты",
    okForGrant: (g) => g === "cash.otchety.view" || g.startsWith("cash.otchety."),
    trueWhen: (k) => hasAny(k, NAV_PERM.cashReports)
  },
  {
    id: "nav.cash.reportWithOrders",
    label: "Sidebar: one cash-report item (cash.otchety only)",
    okForGrant: (g) => g === "cash.otchety.view" || g.startsWith("cash.otchety."),
    trueWhen: (k) => hasAny(k, NAV_PERM.cashReportsOrOrders)
  },
  {
    id: "nav.staff.agent",
    label: "Sidebar: Агенты",
    okForGrant: (g) =>
      g === "staff.agent.view" || g === "staff.agent.spisok_agentov" || g === "staff.agent.prosmotr_agenta",
    trueWhen: (k) => hasAny(k, NAV_PERM.staffAgent)
  },
  {
    id: "ui.agent.canCreate",
    label: "Агенты: Add",
    okForGrant: (g) => g === "staff.agent.create",
    trueWhen: (k) => k.has("staff.agent.create")
  },
  {
    id: "ui.agent.canUpdate",
    label: "Агенты: Edit",
    okForGrant: (g) => g === "staff.agent.update",
    trueWhen: (k) => k.has("staff.agent.update")
  },
  {
    id: "ui.agent.canExport",
    label: "Агенты: Excel (history||copy)",
    okForGrant: (g) => g === "staff.agent.history" || g === "staff.agent.copy",
    trueWhen: (k) => k.has("staff.agent.history") || k.has("staff.agent.copy")
  },
  {
    id: "ui.agent.canDeactivate",
    label: "Агенты: Deactivate UI (deactivate only)",
    okForGrant: (g) => g === "staff.agent.deactivate",
    trueWhen: (k) => k.has("staff.agent.deactivate")
  },
  {
    id: "nav.clients",
    label: "Sidebar: Клиенты",
    okForGrant: (g) => g === "clients.klient.view" || g === "clients.view" || g.startsWith("clients.klient."),
    trueWhen: (k) => hasAny(k, NAV_PERM.clients)
  },
  {
    id: "nav.visitPlanner",
    label: "Sidebar: Visit planner (GPS keys)",
    okForGrant: (g) => g === "gps.gps.view" || g === "gps.dostup_k_gps",
    trueWhen: (k) => hasAny(k, NAV_PERM.visitPlanner)
  },
  {
    id: "nav.consignment",
    label: "Sidebar: Консигнация",
    okForGrant: (g) => g === "staff.konsignatsiya.view",
    trueWhen: (k) => hasAny(k, NAV_PERM.staffConsignment)
  },
  {
    id: "nav.retailStock",
    label: "Sidebar: Retail stock (ostatki.view)",
    okForGrant: (g) => g === "warehouse.ostatki.view" || g === "warehouse.view",
    trueWhen: (k) => hasAny(k, NAV_PERM.clientsRetailStock)
  },
  {
    id: "nav.orders.view",
    label: "Sidebar: Заявки",
    okForGrant: (g) => g === "orders.zakaz.view" || g === "orders.view",
    trueWhen: (k) => hasAny(k, NAV_PERM.ordersView)
  },
  {
    id: "nav.orders.create",
    label: "Sidebar: Создать заказ",
    okForGrant: (g) => g === "orders.zakaz.create" || g === "orders.create",
    trueWhen: (k) => hasAny(k, NAV_PERM.ordersCreate)
  },
  {
    id: "nav.exchange.createOrView",
    label: "Sidebar: Обмен create-entry (create only)",
    okForGrant: (g) => g === "orders.obmen_i_otkaz.create",
    trueWhen: (k) => hasAny(k, NAV_PERM.exchangeCreateNav)
  },
  {
    id: "nav.planFakt",
    label: "Sidebar: Plan/fakt monitoring",
    okForGrant: (g) => g === "dashboard.plan_fakt.view" || g === "dashboard.plan_fakt",
    trueWhen: (k) => hasAny(k, NAV_PERM.planFaktMonitoring)
  }
];

type Finding = {
  granted: string;
  aliasExpanded: string[];
  unexpectedKeys: string[];
  overOpenCaps: { id: string; label: string }[];
  expectedCaps: { id: string; label: string }[];
  meCount: number;
};

async function jsonFetch(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

async function login(loginName: string, password: string): Promise<string> {
  const { status, body } = await jsonFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ slug: SLUG, login: loginName, password, device_id: "overgrant-audit" })
  });
  if (status !== 200) throw new Error(`login ${loginName} → ${status} ${JSON.stringify(body).slice(0, 200)}`);
  const tok = String(body.accessToken ?? body.access_token ?? "");
  if (!tok) throw new Error(`login ${loginName}: no accessToken`);
  return tok;
}

async function loginWithFallback(loginName: string, passwords: string[]): Promise<string> {
  let last: Error | null = null;
  for (const pw of passwords.filter(Boolean)) {
    try {
      return await login(loginName, pw);
    } catch (e) {
      last = e as Error;
    }
  }
  throw last ?? new Error(`login ${loginName} failed`);
}

async function meKeys(tok: string): Promise<string[]> {
  const { status, body } = await jsonFetch(`/api/${SLUG}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${tok}` }
  });
  if (status !== 200) throw new Error(`me-permissions → ${status}`);
  const data = body.data as { keys?: string[] } | undefined;
  return data?.keys ?? [];
}

async function patchUser(
  adminTok: string,
  userId: number,
  patch: Record<string, unknown>
): Promise<void> {
  const { status, body } = await jsonFetch(`/api/${SLUG}/access/users/${userId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminTok}` },
    body: JSON.stringify(patch)
  });
  if (status !== 200 && status !== 204) {
    throw new Error(`PATCH user ${userId} → ${status} ${JSON.stringify(body).slice(0, 300)}`);
  }
}

function moduleBuckets(keys: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const k of keys) {
    const mod = k.split(".")[0] ?? "?";
    m[mod] = (m[mod] ?? 0) + 1;
  }
  return m;
}

/** Keys that alias-expansion of `granted` alone is allowed to add (companions / legacy). */
function expectedAliasExtras(granted: string): Set<string> {
  return new Set(expandPermissionKeyAliases([granted]));
}

function evaluateFinding(granted: string, me: string[]): Finding {
  const keys = new Set(me);
  const expected = expectedAliasExtras(granted);
  const unexpectedKeys = me.filter((k) => !expected.has(k)).sort();

  const overOpenCaps: { id: string; label: string }[] = [];
  const expectedCaps: { id: string; label: string }[] = [];
  for (const cap of CAP_FLAGS) {
    if (!cap.trueWhen(keys)) continue;
    if (cap.okForGrant(granted)) expectedCaps.push({ id: cap.id, label: cap.label });
    else overOpenCaps.push({ id: cap.id, label: cap.label });
  }

  return {
    granted,
    aliasExpanded: [...expected].sort(),
    unexpectedKeys,
    overOpenCaps,
    expectedCaps,
    meCount: me.length
  };
}

function roleDefaultsReport(): string[] {
  const lines: string[] = ["## Role defaults (preset builders)", ""];
  const roles = [
    "admin",
    "operator",
    "supervisor",
    "agent",
    "expeditor",
    "skladchik",
    "collector",
    "auditor",
    "cashier",
    "storekeeper",
    "director"
  ];
  for (const role of roles) {
    const keys = buildRoleDefaultKeys(role);
    const buckets = moduleBuckets(keys);
    const top = Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([m, n]) => `${m}:${n}`)
      .join(", ");
    lines.push(`- **${role}**: ${keys.length} keys | ${top || "(empty)"}`);
  }
  lines.push("");
  lines.push(`Presets available: ${rolesWithPresets().join(", ")}`);
  lines.push("");
  return lines;
}

function staticAliasReport(): string[] {
  const lines: string[] = ["## Alias expansion samples (offline)", ""];
  const samples = [
    "warehouse.sklady.view",
    "warehouse.view",
    "cash.kassa.view",
    "cash.view",
    "staff.agent.spisok_agentov",
    "staff.agent.view",
    "staff.agent.activate",
    "clients.klient.view",
    "orders.view",
    "dashboard.prodazhi",
    "reports.view",
    "cash.spisok_kassy"
  ];
  for (const k of samples) {
    const exp = expandPermissionKeyAliases([k]);
    lines.push(`- \`${k}\` → ${exp.map((x) => `\`${x}\``).join(", ")}`);
  }
  lines.push("");
  lines.push(
    "- **ACTION_PATTERNS**: leaf `istoriya` maps to **history** (not `view`)."
  );
  lines.push(
    "- **MODULE_VIEW_COMPANIONS**: `warehouse.view` ↔ `warehouse.ostatki.view` (NOT `sklady`); `cash.view` ↔ `cash.kassa.view`."
  );
  lines.push(
    "- **dashboard.view**: faqat aniq `dashboard.view` / bare `dashboard` — section `dashboard.*.view` siblinglarni bog‘lamaydi."
  );
  lines.push("");
  return lines;
}

function staticUiBugs(): string[] {
  return [
    "## Static UI / nav over-open (code review)",
    "",
    "Status after Access over-grant fix (2026-07): warehouse gates split; nav ORs narrowed; payments history; agents export/deactivate; section toggle view-only; lean skladchik/storekeeper; istoriya→history; dashboard.view decoupling; write paths gated by permission keys.",
    "",
    "Remaining intentional / documented:",
    "- **Admin FE bypass** — `usePermissions` / `isNavItemAllowed`: role `admin` always true.",
    "- **Module view companions** — e.g. `warehouse.view` ↔ `warehouse.ostatki.view` (alias expand, not nav OR).",
    "- **cashier** preset still full `mod(\"cash\")` (product choice; lean separately if needed).",
    ""
  ];
}

async function setUserPermLayer(
  tenantId: number,
  userId: number,
  role: string,
  permissions: string[],
  denied: string[]
): Promise<void> {
  await applyAccessUserPatchBody(
    tenantId,
    userId,
    { merge_permissions: false, permissions, denied_permissions: denied },
    { role, is_active: true }
  );
}

async function effectiveKeys(tenantId: number, userId: number, role: string): Promise<string[]> {
  const set = await resolveUserPermissionKeys(tenantId, userId, role);
  return [...set].sort();
}

async function main(): Promise<void> {
  const outDir = join(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mdPath = join(outDir, `overgrant-audit-${stamp}.md`);

  const md: string[] = [
    `# Over-grant audit report`,
    "",
    `- Mode: **${MODE}**`,
    `- API: ${BASE}`,
    `- Tenant: ${SLUG}`,
    `- When: ${new Date().toISOString()}`,
    `- Probe keys: ${GRANT_PROBE_KEYS.length}`,
    "",
    ...roleDefaultsReport(),
    ...staticAliasReport(),
    ...staticUiBugs()
  ];

  console.log(`=== overgrant audit MODE=${MODE} tenant=${SLUG} ===`);

  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true, slug: true } });
  if (!tenant) throw new Error(`tenant ${SLUG} not found`);
  const op = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: OPERATOR_LOGIN },
    select: { id: true, login: true, role: true }
  });
  if (!op) throw new Error(`user login=${OPERATOR_LOGIN} not found in ${SLUG}`);
  const role = op.role || "operator";
  console.log(`operator id=${op.id} role=${role}`);

  // Role smoke via DB resolve (no login)
  md.push("## Live role smoke (DB resolveUserPermissionKeys)", "");
  const smokeLogins = ["admin", "operator", "supervisor", "agent", "expeditor", "skladchik", "collector", "auditor"];
  for (const loginName of smokeLogins) {
    const u = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, login: loginName },
      select: { id: true, role: true }
    });
    if (!u) {
      md.push(`- **${loginName}**: user missing`);
      continue;
    }
    const keys = await effectiveKeys(tenant.id, u.id, u.role);
    const top = Object.entries(moduleBuckets(keys))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([m, n]) => `${m}:${n}`)
      .join(", ");
    md.push(`- **${loginName}** (role=${u.role}): ${keys.length} keys | ${top}`);
    console.log(`smoke ${loginName}: ${keys.length} keys`);
  }
  md.push("");

  // Role-only baseline
  await setUserPermLayer(tenant.id, op.id, role, [], []);
  const roleBaseline = await effectiveKeys(tenant.id, op.id, role);
  const presetOp = buildRoleDefaultKeys("operator");
  console.log(`operator role-only baseline: ${roleBaseline.length} keys (preset ${presetOp.length})`);
  md.push(`## Operator role-only baseline: ${roleBaseline.length} keys (preset ${presetOp.length})`, "");
  md.push(`Modules: ${Object.entries(moduleBuckets(roleBaseline)).map(([m, n]) => `${m}:${n}`).join(", ")}`);
  md.push("");

  const denyUniverse = [
    ...new Set(
      expandPermissionKeyAliases([
        ...roleBaseline,
        ...presetOp,
        ...GRANT_PROBE_KEYS,
        "orders.view",
        "clients.view",
        "cash.view",
        "warehouse.view",
        "reports.view",
        "dashboard.view"
      ])
    )
  ];

  await setUserPermLayer(tenant.id, op.id, role, [], denyUniverse);
  const emptyKeys = await effectiveKeys(tenant.id, op.id, role);
  console.log(`lean denied baseline: ${emptyKeys.length} keys`);
  md.push(`Lean denied baseline after deny-universe: **${emptyKeys.length}** keys`, "");
  if (emptyKeys.length > 0) {
    md.push(`Remaining (unexpected): ${emptyKeys.slice(0, 40).map((k) => `\`${k}\``).join(", ")}`);
    md.push("");
  }

  md.push("## One-by-one grant probes", "");
  md.push("| Granted | eff# | Alias extras | Over-open UI caps | Unexpected keys |");
  md.push("|---|---:|---|---|---|");

  const findings: Finding[] = [];
  let overOpenCount = 0;
  let unexpectedKeyCount = 0;

  for (const granted of GRANT_PROBE_KEYS) {
    const allowSet = expectedAliasExtras(granted);
    // Drop deny keys whose alias-expansion intersects allow (legacy sibling deny must not wipe grant).
    const denyForGrant = denyUniverse.filter((k) => {
      if (allowSet.has(k)) return false;
      return !expandPermissionKeyAliases([k]).some((e) => allowSet.has(e));
    });
    await setUserPermLayer(tenant.id, op.id, role, [granted], denyForGrant);
    const me = await effectiveKeys(tenant.id, op.id, role);
    const finding = evaluateFinding(granted, me);
    findings.push(finding);
    if (finding.overOpenCaps.length) overOpenCount += finding.overOpenCaps.length;
    if (finding.unexpectedKeys.length) unexpectedKeyCount += finding.unexpectedKeys.length;

    const over = finding.overOpenCaps.map((c) => c.id).join(", ") || "—";
    const unexp = finding.unexpectedKeys.slice(0, 8).join(", ") || "—";
    const aliasExtra = finding.aliasExpanded.filter((k) => k !== granted).slice(0, 6).join(", ") || "—";
    md.push(`| \`${granted}\` | ${finding.meCount} | ${aliasExtra} | ${over} | ${unexp} |`);

    if (finding.overOpenCaps.length || finding.unexpectedKeys.length) {
      console.log(`granted ${granted} → eff=${finding.meCount} OVER=[${over}] UNEXP=[${unexp}]`);
    } else {
      console.log(`granted ${granted} → eff=${finding.meCount} (clean)`);
    }
  }

  // Optional HTTP spot-check (single login) when MODE=http
  if (MODE === "http") {
    md.push("", "## HTTP spot-check", "");
    try {
      const adminTok = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
      const opTok = await loginWithFallback(OPERATOR_LOGIN, [
        process.env.OPERATOR_PASSWORD ?? "",
        OPERATOR_PASSWORD,
        "operator",
        "secret123"
      ]);
      await patchUser(adminTok, op.id, {
        merge_permissions: false,
        permissions: ["warehouse.sklady.view"],
        denied_permissions: denyUniverse.filter((k) => !expectedAliasExtras("warehouse.sklady.view").has(k))
      });
      const httpKeys = await meKeys(opTok);
      md.push(
        `- After HTTP grant \`warehouse.sklady.view\`: me-permissions=${httpKeys.length}, has view=${httpKeys.includes("warehouse.sklady.view")}, has update=${httpKeys.includes("warehouse.sklady.update")}`
      );
      console.log("HTTP spot-check ok, keys=", httpKeys.length);
    } catch (e) {
      md.push(`- HTTP spot-check skipped/failed: ${(e as Error).message}`);
      console.warn("HTTP spot-check fail:", (e as Error).message);
    }
  }

  md.push("");
  md.push("### Over-open detail (granted X → also unlocked Y)", "");
  const detailed = findings.filter((f) => f.overOpenCaps.length > 0 || f.unexpectedKeys.length > 0);
  if (detailed.length === 0) {
    md.push("_No over-open caps detected against CAP_FLAGS expectations._");
  } else {
    let n = 1;
    for (const f of detailed) {
      for (const cap of f.overOpenCaps) {
        md.push(`${n}. **\`${f.granted}\`** → also unlocked **${cap.label}** (\`${cap.id}\`)`);
        n++;
      }
      if (f.unexpectedKeys.length) {
        md.push(
          `${n}. **\`${f.granted}\`** → effective also has unexpected keys: ${f.unexpectedKeys.map((k) => `\`${k}\``).join(", ")}`
        );
        n++;
      }
    }
  }
  md.push("");

  md.push("## Counts", "");
  md.push(`- Probe grants run: **${GRANT_PROBE_KEYS.length}**`);
  md.push(`- Findings with over-open caps and/or unexpected keys: **${detailed.length}**`);
  md.push(`- Total over-open cap hits: **${overOpenCount}**`);
  md.push(`- Total unexpected key hits: **${unexpectedKeyCount}**`);
  md.push("");
  md.push("## Explicit note");
  md.push("");
  md.push("**Tuzatish hali qilinmadi — rozilik kutilyapti.**");
  md.push("");
  md.push(
    "No production RBAC/UI code was changed. This script only temporarily patched the test operator personal allow/deny layer via the same Access patch path."
  );
  md.push("");

  if (!KEEP_OVERRIDES) {
    await setUserPermLayer(tenant.id, op.id, role, [], []);
    console.log("RESTORE: operator personal allow/deny cleared");
    md.push("_Operator personal overrides restored to empty (role-only)._");
  } else {
    console.log("KEEP_OVERRIDES=1 — last grant state left on operator");
    md.push("_KEEP_OVERRIDES=1 — operator personal layer NOT cleared._");
  }

  writeFileSync(mdPath, md.join("\n"), "utf8");
  const jsonPath = join(outDir, `overgrant-audit-${stamp}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        mode: MODE,
        base: BASE,
        slug: SLUG,
        roleBaselineCount: roleBaseline.length,
        emptyBaselineCount: emptyKeys.length,
        findings,
        overOpenCount,
        unexpectedKeyCount
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\nWrote:", mdPath);
  console.log("Wrote:", jsonPath);
  console.log(
    `SUMMARY: probes=${GRANT_PROBE_KEYS.length} dirty=${detailed.length} overOpenHits=${overOpenCount} unexpectedKeyHits=${unexpectedKeyCount}`
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("audit-overgrant FAIL:", e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

