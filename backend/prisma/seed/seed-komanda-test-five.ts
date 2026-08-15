/**
 * KOMANDA: har bir roldan 5 ta foydalanuvchi + bog‘lanishlar.
 * Asosiy seed (`prisma db seed`) oxirida chaqiriladi.
 */
import bcrypt from "bcryptjs";
import { createStaff } from "../../src/modules/staff/staff.crud.create";
import type { CreateStaffInput, StaffKind } from "../../src/modules/staff/staff.shared";
import {
  kindRole,
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  normalizePositiveIntIds
} from "../../src/modules/staff/staff.shared";
import { syncTenantUserRolesFromProfile } from "../../src/modules/access/rbac.roles";
import { prisma } from "./helpers";

const TEST_PASSWORD = "test123456";
const LOGIN_PREFIX = "test_komanda_";
const PROTECTED_LOGINS = new Set(["admin", "operator", "agent", "supervisor"]);
const KOMANDA_ROLES = ["agent", "expeditor", "supervisor", "skladchik", "collector", "auditor"] as const;

type KomandaRole = (typeof KOMANDA_ROLES)[number];

const ROLE_SPECS: Array<{
  kind: StaffKind;
  role: KomandaRole;
  loginKey: string;
  codePrefix: string;
  familyLabel: string;
  position: string;
}> = [
  { kind: "agent", role: "agent", loginKey: "ag", codePrefix: "T-AG", familyLabel: "Agent", position: "Test agent" },
  {
    kind: "expeditor",
    role: "expeditor",
    loginKey: "exp",
    codePrefix: "T-EXP",
    familyLabel: "Dastavchik",
    position: "Test ekspeditor"
  },
  {
    kind: "supervisor",
    role: "supervisor",
    loginKey: "svr",
    codePrefix: "T-SVR",
    familyLabel: "Supervizor",
    position: "Test supervizor"
  },
  {
    kind: "skladchik",
    role: "skladchik",
    loginKey: "sklad",
    codePrefix: "T-SKL",
    familyLabel: "Skladchi",
    position: "Test skladchi"
  },
  {
    kind: "collector",
    role: "collector",
    loginKey: "ink",
    codePrefix: "T-INK",
    familyLabel: "Inkassator",
    position: "Test inkassator"
  },
  {
    kind: "auditor",
    role: "auditor",
    loginKey: "aud",
    codePrefix: "T-AUD",
    familyLabel: "Auditor",
    position: "Test auditor"
  }
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildLogin(loginKey: string, index: number) {
  return `${LOGIN_PREFIX}${loginKey}_${pad2(index)}`;
}

function baseInput(
  spec: (typeof ROLE_SPECS)[number],
  index: number,
  warehouseId: number | null
): CreateStaffInput {
  const n = pad2(index);
  const body: CreateStaffInput = {
    first_name: "TEST",
    last_name: `${spec.familyLabel} ${n}`,
    middle_name: null,
    login: buildLogin(spec.loginKey, index),
    password: TEST_PASSWORD,
    phone: `+99890000${spec.loginKey === "ag" ? "10" : "20"}${n}`,
    code: `${spec.codePrefix}-${n}`,
    pinfl: null,
    branch: "TEST filial",
    position: spec.position,
    can_authorize: true,
    app_access: true,
    consignment: false,
    is_active: true,
    kpi_color: "#0d9488"
  };
  if (spec.kind === "agent" || spec.kind === "expeditor") {
    body.warehouse_id = warehouseId;
  }
  if (spec.kind === "skladchik" && warehouseId != null) {
    body.warehouse_ids = [warehouseId];
    body.app_access = false;
  }
  return body;
}

async function upsertTestUser(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput
): Promise<{ id: number; login: string; created: boolean }> {
  const login = input.login.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { tenant_id: tenantId, login }
  });
  if (existing) {
    const passwordHash =
      input.password.length >= 6 ? await bcrypt.hash(input.password, 10) : existing.password_hash;
    const whIds = normalizePositiveIntIds(input.warehouse_ids ?? []);
    const primaryWhId = input.warehouse_id ?? (whIds.length > 0 ? whIds[0]! : null);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        first_name: input.first_name.trim(),
        last_name: input.last_name?.trim() || null,
        middle_name: input.middle_name?.trim() || null,
        name: [input.last_name, input.first_name].filter(Boolean).join(" ").trim() || input.first_name.trim(),
        phone: input.phone?.trim() || null,
        code: input.code?.trim() || null,
        branch: input.branch?.trim() || null,
        position: input.position?.trim() || null,
        role: kindRole(kind),
        is_active: true,
        can_authorize: input.can_authorize ?? true,
        app_access: input.app_access ?? true,
        kpi_color: input.kpi_color?.trim() || null,
        warehouse_id: primaryWhId,
        password_hash: passwordHash
      }
    });
    if (kind === "skladchik" && whIds.length > 0) {
      await prisma.warehouseUserLink.deleteMany({ where: { user_id: existing.id } });
      await prisma.warehouseUserLink.createMany({
        data: whIds.map((warehouse_id) => ({
          warehouse_id,
          user_id: existing.id,
          link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE
        }))
      });
    }
    return { id: existing.id, login, created: false };
  }
  const row = await createStaff(tenantId, kind, input, null);
  return { id: row.id, login, created: true };
}

/** Seed mijozlari, zakazlari va agent sozlamalarini test agentlariga bog‘lash. */
async function linkKomandaSeedRelations(tenantId: number) {
  const testAgents = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      login: { startsWith: `${LOGIN_PREFIX}ag_` },
      is_active: true
    },
    orderBy: { login: "asc" }
  });
  if (testAgents.length === 0) return;

  const primaryAgent = testAgents[0]!;
  const entitlementsSource = await prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      agent_entitlements: { not: null }
    },
    select: { agent_entitlements: true },
    orderBy: { id: "asc" }
  });
  const entitlements = entitlementsSource?.agent_entitlements ?? null;

  const warehouses = await prisma.warehouse.findMany({
    where: { tenant_id: tenantId },
    orderBy: { id: "asc" }
  });

  for (const agent of testAgents) {
    if (entitlements != null) {
      await prisma.user.update({
        where: { id: agent.id },
        data: { agent_entitlements: entitlements }
      });
    }
    for (const wh of warehouses) {
      const link = await prisma.warehouseUserLink.findFirst({
        where: { warehouse_id: wh.id, user_id: agent.id }
      });
      if (!link) {
        await prisma.warehouseUserLink.create({
          data: { warehouse_id: wh.id, user_id: agent.id, link_role: "agent" }
        });
      }
    }
  }

  const clients = await prisma.client.findMany({
    where: { tenant_id: tenantId, merged_into_client_id: null },
    orderBy: { id: "asc" }
  });
  for (let i = 0; i < clients.length; i++) {
    const agent = testAgents[i % testAgents.length]!;
    await prisma.client.update({
      where: { id: clients[i]!.id },
      data: { agent_id: agent.id }
    });
  }

  await prisma.order.updateMany({
    where: { tenant_id: tenantId, number: "ORD-SEED-001" },
    data: { agent_id: primaryAgent.id }
  });

  await prisma.clientRefusal.updateMany({
    where: { tenant_id: tenantId },
    data: { agent_id: primaryAgent.id }
  });
}

export async function seedKomandaTestFive(tenantSlug = "test1") {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    throw new Error(`Tenant topilmadi: ${tenantSlug}`);
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id },
    orderBy: { id: "asc" }
  });
  const warehouseId = warehouse?.id ?? null;

  const deactivated = await prisma.user.updateMany({
    where: {
      tenant_id: tenant.id,
      role: { in: [...KOMANDA_ROLES] },
      login: { notIn: [...PROTECTED_LOGINS] }
    },
    data: {
      is_active: false,
      can_authorize: false
    }
  });

  console.log(`[seed] komanda: deaktivatsiya ${deactivated.count} ta`);

  let created = 0;
  let updated = 0;

  for (const spec of ROLE_SPECS) {
    for (let i = 1; i <= 5; i++) {
      const input = baseInput(spec, i, warehouseId);
      const result = await upsertTestUser(tenant.id, spec.kind, input);
      if (result.created) created++;
      else updated++;
    }
  }

  const testAgents = await prisma.user.findMany({
    where: {
      tenant_id: tenant.id,
      role: "agent",
      login: { startsWith: `${LOGIN_PREFIX}ag_` },
      is_active: true
    },
    orderBy: { login: "asc" }
  });
  const testSupervisors = await prisma.user.findMany({
    where: {
      tenant_id: tenant.id,
      role: "supervisor",
      login: { startsWith: `${LOGIN_PREFIX}svr_` },
      is_active: true
    },
    orderBy: { login: "asc" }
  });
  for (let i = 0; i < testAgents.length; i++) {
    const sup = testSupervisors[i % testSupervisors.length];
    if (!sup) break;
    await prisma.user.update({
      where: { id: testAgents[i]!.id },
      data: { supervisor_user_id: sup.id }
    });
  }

  await linkKomandaSeedRelations(tenant.id);
  await syncTenantUserRolesFromProfile(tenant.id);

  const revived = await prisma.user.updateMany({
    where: {
      tenant_id: tenant.id,
      login: { in: ["agent", "supervisor"] }
    },
    data: { is_active: true, can_authorize: true, app_access: true }
  });
  if (revived.count > 0) {
    console.log(`[seed] komanda: dev loginlar faollashtirildi (agent/supervisor): ${revived.count}`);
  }

  console.log(
    `[seed] komanda: ${created} yaratildi, ${updated} yangilandi (har roldan 5 ta, jami ${ROLE_SPECS.length * 5})`
  );
  console.log(`[seed] komanda kirish: login test_komanda_ag_01 … parol ${TEST_PASSWORD}`);
}
